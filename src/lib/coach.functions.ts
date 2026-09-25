import { createServerFn } from "@tanstack/react-start";
import {
  assertSecurityConfiguration,
  rateLimitWindows,
  readAccessSession,
} from "@/lib/access-session.server";
import {
  buildStructuredCoachReply,
  detectCoachIntent,
  parseCoachInput,
  type CoachProvider,
  type CoachStructuredReply,
} from "@/lib/coach-contract";
import { requiresSafetyFirst, classifyCoachTurn } from "@/lib/coach/classify";
import { buildCoachContext } from "@/lib/coach/context.server";
import { evidenceFromContext } from "@/lib/coach/evidence";
import {
  persistCoachProposal,
  touchCoachSession,
  upsertCoachMemory,
} from "@/lib/coach/memory.server";
import {
  actionsForProposal,
  proposalFromDecisions,
  validateProposalAgainstDecisionEngine,
} from "@/lib/coach/proposals";
import { weeklyReviewWorkflow } from "@/lib/coach/workflows/weekly-review";
import { postWorkoutWorkflow } from "@/lib/coach/workflows/post-workout";
import { evaluateSafetyForDate } from "@/lib/engine/safety";
import { EVENT_TAXONOMY } from "@/lib/events/taxonomy";
import type { CoachProposal } from "@/lib/coach/types";
import { todayKey } from "@/lib/types";

export type { CoachProvider, CoachStructuredReply };
export { parseCoachInput, buildCoachSystemPrompt } from "@/lib/coach-contract";

function coachRateLimits() {
  const rpm = Number(process.env["COACH_RPM"] ?? 10);
  const rpd = Number(process.env["COACH_RPD"] ?? 100);
  return {
    rpm: Number.isFinite(rpm) && rpm > 0 ? rpm : 10,
    rpd: Number.isFinite(rpd) && rpd > 0 ? rpd : 100,
  };
}

function logCoachUsage(entry: {
  userId: string;
  provider: string;
  model: string;
  success: boolean;
  latencyMs: number;
  error?: string;
}) {
  console.info(
    JSON.stringify({
      type: "coach_usage",
      user_id: entry.userId,
      provider: entry.provider,
      model: entry.model,
      success: entry.success,
      latency_ms: entry.latencyMs,
      error: entry.error ?? null,
      ts: new Date().toISOString(),
    }),
  );
}

/** Re-export typed builder for tests / other server modules */
export { buildCoachContext };

/**
 * AI Coach — Coach Agent path (Orchestrator → Specialists → FactPack).
 * Client must NOT send critical context (ignored if present).
 */
export const askAiCoach = createServerFn({ method: "POST" })
  .inputValidator(parseCoachInput)
  .handler(async ({ data }) => {
    try {
      assertSecurityConfiguration();
    } catch {
      return { text: "", error: "misconfigured" as const };
    }

    const session = readAccessSession();
    if (!session) {
      return { text: "", error: "unauthorized" as const };
    }

    const limits = coachRateLimits();
    const rl = rateLimitWindows(`coach:${session.email}`, [
      { suffix: "min", limit: limits.rpm, windowMs: 60_000 },
      { suffix: "day", limit: limits.rpd, windowMs: 24 * 60 * 60_000 },
    ]);
    if (!rl.ok) {
      return { text: "", error: "rate_limited" as const, status: 429 as const };
    }

    const deviceId = data.deviceId?.trim() || "";
    if (!deviceId || deviceId.length < 8) {
      return { text: "", error: "unauthorized" as const };
    }

    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true });
    if (!identity?.userId) {
      return { text: "", error: "unauthorized" as const };
    }

    const started = Date.now();
    const day = todayKey();
    const ctx = await buildCoachContext(identity.userId, day);
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const turnKind = classifyCoachTurn(lastUser);
    const intent = detectCoachIntent(lastUser);

    const safetyNotice =
      requiresSafetyFirst(turnKind) || ctx.typed.safety.escalateCare
        ? ctx.safetyNotice
        : ctx.safetyNotice;

    const snap = ctx.state.decisionContextByDate?.[day] ?? null;
    const builtDecisions = snap?.decisions ?? null;
    const safety = snap?.safety ?? evaluateSafetyForDate(ctx.state, day);

    // Coach Agent path (Orchestrator → Specialists → FactPack) — default, no LLM authority
    const { runCoachAgent } = await import("@/ai/agents/coach");
    const contextAvailable = Boolean(snap) || Boolean(ctx.livingSummary);
    const coachOut = await runCoachAgent({
      trustedUserId: identity.userId,
      message: lastUser,
      contextAvailable,
      ...(builtDecisions ? { decisions: builtDecisions } : {}),
      safety,
      forceSafetyBlock: Boolean(safety.escalateCare && turnKind === "actionable"),
    });

    let proposal = null as CoachProposal | null;
    if (coachOut.factPack?.proposal && coachOut.factPack.proposalStatus === "accepted") {
      const p = coachOut.factPack.proposal;
      const typeMap = [
        "REDUCE_VOLUME",
        "DELOAD",
        "REST",
        "CHECKIN",
        "EXPRESS_WORKOUT",
        "FULL_WORKOUT",
        "NUTRITION_FOCUS",
        "SLEEP_FOCUS",
      ] as const;
      const mappedType = typeMap.includes(p.proposed_type as (typeof typeMap)[number])
        ? (p.proposed_type as CoachProposal["type"])
        : ("REDUCE_VOLUME" as const);
      proposal = {
        type: mappedType,
        action: "adapt_workout",
        value: p.proposed_value,
        reasonCodes: p.reason_codes,
        evidence: evidenceFromContext(ctx.typed) as Record<
          string,
          string | number | boolean | null
        >,
        confidence: p.confidence,
      };
      const validated = validateProposalAgainstDecisionEngine(proposal, builtDecisions, safety);
      proposal = validated.proposal;
      if (proposal) {
        void persistCoachProposal({
          userId: identity.userId,
          date: day,
          type: proposal.type,
          action: proposal.action,
          value: proposal.value,
          reasonCodes: proposal.reasonCodes,
          evidence: proposal.evidence,
          confidence: proposal.confidence,
        });
      }
    } else if (builtDecisions && !coachOut.factPack?.proposal) {
      proposal = proposalFromDecisions(
        builtDecisions,
        safety,
        evidenceFromContext(ctx.typed) as Record<string, string | number | boolean | null>,
      );
      const validated = validateProposalAgainstDecisionEngine(proposal, builtDecisions, safety);
      proposal = validated.proposal;
    }

    const actions = actionsForProposal(proposal);
    const structuredKind =
      coachOut.intentKind === "why_plan_changed" || intent === "why"
        ? ("why" as const)
        : intent === "today"
          ? ("today" as const)
          : ("general" as const);

    const structured: CoachStructuredReply = buildStructuredCoachReply({
      kind: structuredKind,
      summary: coachOut.structured.summary || ctx.livingSummary,
      why: coachOut.structured.why.length > 0 ? coachOut.structured.why : ctx.why,
      decisions:
        coachOut.structured.decisions.length > 0
          ? coachOut.structured.decisions.map((d) => ({
              type: "note",
              value: d,
              explanation: d,
            }))
          : ctx.decisions,
      ...(safetyNotice ? { safetyNotice } : {}),
      turnKind,
      ...(proposal ? { proposals: [proposal] } : {}),
      ...(actions.length ? { actions } : {}),
      evidence: evidenceFromContext(ctx.typed),
    });

    try {
      const { trackUserEvent } = await import("@/lib/events/track");
      void trackUserEvent({
        deviceId,
        resolvedUserId: identity.userId,
        eventType: EVENT_TAXONOMY.COACH_REQUESTED,
        source: "coach",
        metadata: {
          provider: data.provider,
          intent,
          turnKind,
          coachAgent: true,
          coachStatus: coachOut.status,
          planId: coachOut.plan_id ?? null,
        },
      });
    } catch {
      /* best-effort */
    }

    void touchCoachSession({
      userId: identity.userId,
      clientId: `chat-${day}`,
      summary: lastUser.slice(0, 200),
      messageCount: data.messages.length,
    });

    if (turnKind === "actionable" && lastUser.length > 8) {
      void upsertCoachMemory({
        userId: identity.userId,
        kind: "coach_notes",
        key: `note-${day}`,
        value: { text: lastUser.slice(0, 240) },
        confidence: 0.4,
      });
    }

    const latencyMs = Date.now() - started;
    logCoachUsage({
      userId: identity.userId,
      provider: "coach_agent",
      model: "runCoachAgent",
      success: coachOut.ok || coachOut.status === "insufficient_context",
      latencyMs,
      ...(coachOut.error_code ? { error: coachOut.error_code } : {}),
    });

    return {
      text: coachOut.text,
      structured,
      coachAgent: true as const,
      status: coachOut.status,
    };
  });

/** Server fn: weekly review without LLM (deterministic). */
export const runWeeklyReviewFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const v = input as { deviceId?: string } | null;
    if (!v?.deviceId || String(v.deviceId).length < 8) throw new Error("deviceId inválido");
    return { deviceId: String(v.deviceId).slice(0, 128) };
  })
  .handler(async ({ data }) => {
    const session = readAccessSession();
    if (!session) return { error: "unauthorized" as const };
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({ deviceId: data.deviceId, requireAccess: true });
    if (!identity?.userId) return { error: "unauthorized" as const };
    const ctx = await buildCoachContext(identity.userId);
    return { result: weeklyReviewWorkflow(ctx.typed) };
  });

/** Server fn: post-workout review without LLM. */
export const runPostWorkoutReviewFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const v = input as { deviceId?: string; sessionId?: string } | null;
    if (!v?.deviceId || String(v.deviceId).length < 8) throw new Error("deviceId inválido");
    return {
      deviceId: String(v.deviceId).slice(0, 128),
      sessionId: typeof v.sessionId === "string" ? v.sessionId.slice(0, 80) : undefined,
    };
  })
  .handler(async ({ data }) => {
    const session = readAccessSession();
    if (!session) return { error: "unauthorized" as const };
    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({ deviceId: data.deviceId, requireAccess: true });
    if (!identity?.userId) return { error: "unauthorized" as const };
    const ctx = await buildCoachContext(identity.userId);
    const sessions = ctx.state.sessions ?? [];
    const target =
      (data.sessionId ? sessions.find((s) => s.id === data.sessionId) : null) ??
      [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0] ??
      null;
    return { result: postWorkoutWorkflow(ctx.typed, target, sessions) };
  });
