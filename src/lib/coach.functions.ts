import { createServerFn } from "@tanstack/react-start";
import {
  assertSecurityConfiguration,
  rateLimitWindows,
  readAccessSession,
} from "@/lib/access-session.server";
import {
  buildCoachSystemPrompt,
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
import { callCoachProvider } from "@/lib/coach/provider";
import { prefetchToolsForTurn } from "@/lib/coach/tools";
import { morningCheckinWorkflow } from "@/lib/coach/workflows/morning-checkin";
import { nutritionReviewWorkflow } from "@/lib/coach/workflows/nutrition-review";
import { plateauAnalysisWorkflow } from "@/lib/coach/workflows/plateau-analysis";
import { postWorkoutWorkflow } from "@/lib/coach/workflows/post-workout";
import { recoveryAdjustmentWorkflow } from "@/lib/coach/workflows/recovery-adjustment";
import { weeklyReviewWorkflow } from "@/lib/coach/workflows/weekly-review";
import { buildLivingPlanWithDecisions } from "@/lib/engine/living-plan";
import { evaluateSafetyForDate } from "@/lib/engine/safety";
import { EVENT_TAXONOMY } from "@/lib/events/taxonomy";
import type { WorkflowResult } from "@/lib/coach/types";
import { todayKey } from "@/lib/types";

export type { CoachProvider, CoachStructuredReply };
export { parseCoachInput, buildCoachSystemPrompt };

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

function pickWorkflow(
  hint: string | undefined,
  lastUser: string,
  ctx: Awaited<ReturnType<typeof buildCoachContext>>,
): WorkflowResult | null {
  const state = ctx.state;
  if (hint === "morning-checkin" || /bom\s*dia|check.?in|como\s+estou\s+hoje/i.test(lastUser)) {
    return morningCheckinWorkflow(ctx.typed);
  }
  if (hint === "weekly-review" || /revis[aã]o\s+semanal|resumo\s+da\s+semana/i.test(lastUser)) {
    return weeklyReviewWorkflow(ctx.typed);
  }
  if (hint === "post-workout" || /p[oó]s.?treino|depois\s+do\s+treino|acabei\s+de\s+treinar/i.test(lastUser)) {
    const last = [...(state.sessions ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    return postWorkoutWorkflow(ctx.typed, last, state.sessions ?? []);
  }
  if (hint === "recovery-adjustment" || /recupera|cansad|sono\s+ruim|fatigue/i.test(lastUser)) {
    return recoveryAdjustmentWorkflow(ctx.typed);
  }
  if (hint === "plateau-analysis" || /plateau|estagnad|n[aã]o\s+evolu/i.test(lastUser)) {
    return plateauAnalysisWorkflow(ctx.typed, state.sessions ?? []);
  }
  if (hint === "nutrition-review" || /nutri[cç][aã]o|prote[ií]na|macros/i.test(lastUser)) {
    return nutritionReviewWorkflow(ctx.typed);
  }
  return null;
}

/**
 * AI Coach 2.0 / Phase 3 — context + tools + workflows server-side.
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

    // Safety first for medical / actionable
    const safetyNotice =
      requiresSafetyFirst(turnKind) || ctx.typed.safety.escalateCare
        ? ctx.safetyNotice
        : ctx.safetyNotice;

    const workflow = pickWorkflow(data.workflow, lastUser, ctx);

    // Prefetch tools for explainability (factual / explanatory)
    let toolPack: Record<string, unknown> = {};
    if (turnKind === "factual" || turnKind === "explanatory" || intent === "why") {
      try {
        toolPack = await prefetchToolsForTurn(identity.userId, lastUser);
      } catch {
        toolPack = {};
      }
    }

    const evidence = workflow?.evidence ?? evidenceFromContext(ctx.typed);
    const built = buildLivingPlanWithDecisions(ctx.state, day);
    const safety = evaluateSafetyForDate(ctx.state, day);

    let proposal =
      workflow?.proposal ??
      (built ? proposalFromDecisions(built.decisions, safety, evidence as Record<string, string | number | boolean | null>) : null);

    if (proposal) {
      const validated = validateProposalAgainstDecisionEngine(
        proposal,
        built?.decisions ?? null,
        safety,
      );
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
    }

    const actions = workflow?.actions?.length
      ? workflow.actions
      : actionsForProposal(proposal);

    const toolBlock =
      Object.keys(toolPack).length > 0
        ? `\n\nDados de tools (server-fetched):\n${JSON.stringify(toolPack).slice(0, 6000)}`
        : "";
    const workflowBlock = workflow
      ? `\n\nWorkflow ${workflow.workflow}:\n${workflow.analysis.join("\n")}\nOutcome esperado: ${workflow.outcomeExpectation}`
      : "";

    const system = buildCoachSystemPrompt(
      ctx.contextText + toolBlock + workflowBlock,
      safetyNotice,
    );

    const structured: CoachStructuredReply = buildStructuredCoachReply({
      kind: intent,
      summary:
        workflow?.wins?.[0] ??
        (intent === "today"
          ? `Hoje: ${ctx.livingSummary}`
          : intent === "why"
            ? ctx.why[0] ?? "O plano reflete as decisões do Decision Engine para o seu contexto de hoje."
            : ctx.livingSummary),
      why: workflow?.analysis?.length ? workflow.analysis : ctx.why,
      decisions: ctx.decisions,
      ...(safetyNotice ? { safetyNotice } : {}),
      turnKind,
      ...(proposal ? { proposals: [proposal] } : {}),
      ...(actions.length ? { actions } : {}),
      evidence,
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
          workflow: workflow?.workflow ?? null,
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

    // Persist a light preference/fact when user states something actionable (not full chat)
    if (turnKind === "actionable" && lastUser.length > 8) {
      void upsertCoachMemory({
        userId: identity.userId,
        kind: "coach_notes",
        key: `note-${day}`,
        value: { text: lastUser.slice(0, 240) },
        confidence: 0.4,
      });
    }

    const providerResult = await callCoachProvider({
      provider: data.provider,
      system,
      messages: data.messages,
    });

    const latencyMs = Date.now() - started;
    if (providerResult.error) {
      logCoachUsage({
        userId: identity.userId,
        provider: data.provider === "chatgpt" ? "openai" : "anthropic",
        model: providerResult.model,
        success: false,
        latencyMs,
        error: providerResult.error,
      });
      return { text: "", structured, error: providerResult.error };
    }

    logCoachUsage({
      userId: identity.userId,
      provider: data.provider === "chatgpt" ? "openai" : "anthropic",
      model: providerResult.model,
      success: true,
      latencyMs,
    });

    return { text: providerResult.text, structured };
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
