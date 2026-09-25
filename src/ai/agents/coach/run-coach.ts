/**
 * runCoachAgent — Coach Agent facade (not an isolated chatbot).
 * USER → Coach → Orchestrator → Specialists → Context/RAG/Memory/MCP → Safety/Decision facts → response
 * Never invents data, never applies Living Plan, never owns Decision.
 */

import type { AgentAnalysisResult } from "@/ai/contracts/agent-analysis";
import type { AgentRun } from "@/ai/contracts/agent-run";
import type { DecisionProposal } from "@/ai/contracts/proposal";
import type { SkillEvidenceItem } from "@/ai/contracts/skill-result";
import { asTrustedUserId } from "@/ai/contracts/trusted-user-id";
import { COACH_AGENT_ID } from "@/ai/agents/ids";
import { runSpecialistAgent } from "@/ai/agents/runtime/run-specialist";
import type { SkillCallTool } from "@/ai/skills/core/types";
import { runSkill } from "@/ai/skills/core/run";
import { createExecutionPlan } from "@/ai/orchestrator/plan";
import { registerDefaultAgents } from "@/ai/orchestrator/agents/registry";
import { validateProposalAgainstDecisionEngine } from "@/lib/coach/proposals";
import type { DecisionBundle } from "@/lib/engine/decision";
import type { SafetyVerdict } from "@/lib/engine/safety";
import { COACH_AGENT_ERROR } from "@/ai/agents/coach/errors";
import {
  buildFactPack,
  emptyWhyFacts,
  type CoachFactPack,
  type WhyFacts,
} from "@/ai/agents/coach/fact-pack";
import {
  detectCoachAgentIntent,
  intentForOrchestrator,
  type CoachAgentIntentKind,
} from "@/ai/agents/coach/intent";
import {
  buildBlockedAnonymousResponse,
  buildCoachResponse,
  buildInsufficientContextResponse,
  buildRejectedPlanResponse,
  type BuiltCoachResponse,
} from "@/ai/agents/coach/respond";
import { recordAgentRun } from "@/ai/agents/runtime/agent-run-log";

export type RunCoachAgentInput = {
  trustedUserId: string | null;
  message: string;
  contextAvailable?: boolean;
  callTool?: SkillCallTool;
  skipKnowledge?: boolean;
  /** Optional live bundle for soft proposal validation (tests / server). */
  decisions?: DecisionBundle | null;
  safety?: SafetyVerdict | null;
  /** Force escalate / safety block in tests */
  forceSafetyBlock?: boolean;
};

export type RunCoachAgentResult = {
  ok: boolean;
  text: string;
  structured: BuiltCoachResponse["structured"];
  status: BuiltCoachResponse["status"];
  plan_id?: string;
  agent_runs: AgentRun[];
  factPack?: CoachFactPack;
  intentKind: CoachAgentIntentKind;
  error_code?: string;
};

function extractWhyFromSpecialists(
  results: AgentAnalysisResult[],
  explainSkill: unknown,
  outcomeSkill: unknown,
): WhyFacts {
  const why = emptyWhyFacts();
  const evidence: SkillEvidenceItem[] = [];

  for (const r of results) {
    evidence.push(...r.evidence);
    const analysis = r.analysis as {
      skills?: Array<{ skillId: string; result: unknown }>;
    } | null;
    for (const s of analysis?.skills ?? []) {
      if (s.skillId === "explain_decision" && s.result && typeof s.result === "object") {
        const er = s.result as Record<string, unknown>;
        const w = er["why"] as Record<string, unknown> | null;
        const what = er["what"] as Record<string, unknown> | null;
        const expected = er["expectedOutcome"];
        if (w) {
          const codes = w["reason_codes"] ?? w["reasonCodes"];
          if (Array.isArray(codes)) why.reason_codes = codes.map(String);
          const aliases = w["reason_aliases"] ?? w["reasonAliases"];
          if (Array.isArray(aliases)) why.reason_aliases = aliases.map(String);
          if (typeof w["summary"] === "string") why.explanations.push(w["summary"]);
        }
        if (what && what["decision_value"] !== undefined) {
          why.decision_value = what["decision_value"] as string | number | boolean;
        } else if (what && what["decisionValue"] !== undefined) {
          why.decision_value = what["decisionValue"] as string | number | boolean;
        }
        if (expected !== undefined) why.expected_outcome = expected;
      }
      if (s.skillId === "analyze_outcome") {
        why.outcome_summary = s.result;
      }
    }
  }

  if (explainSkill && typeof explainSkill === "object") {
    const er = explainSkill as Record<string, unknown>;
    const w = er["why"] as Record<string, unknown> | null;
    if (w && why.reason_codes.length === 0) {
      const codes = w["reason_codes"] ?? w["reasonCodes"];
      if (Array.isArray(codes)) why.reason_codes = codes.map(String);
    }
    if (er["what"] && why.decision_value === null) {
      const what = er["what"] as Record<string, unknown>;
      why.decision_value = (what["decision_value"] ?? what["decisionValue"] ?? null) as
        string | number | boolean | null;
    }
    if (er["expectedOutcome"] !== undefined && why.expected_outcome === null) {
      why.expected_outcome = er["expectedOutcome"];
    }
  }
  if (outcomeSkill !== undefined && why.outcome_summary === null) {
    why.outcome_summary = outcomeSkill;
  }

  why.evidence_items = evidence;
  return why;
}

export async function runCoachAgent(input: RunCoachAgentInput): Promise<RunCoachAgentResult> {
  registerDefaultAgents();

  const message = (input.message ?? "").trim();
  const intentKind = detectCoachAgentIntent(message);
  const agent_runs: AgentRun[] = [];

  const rawUser = input.trustedUserId?.trim() ?? "";
  if (!rawUser) {
    const blocked = buildBlockedAnonymousResponse();
    return {
      ok: false,
      text: blocked.text,
      structured: blocked.structured,
      status: blocked.status,
      agent_runs,
      intentKind,
      error_code: COACH_AGENT_ERROR.ANONYMOUS_DENIED,
    };
  }

  let userId: string;
  try {
    userId = asTrustedUserId(rawUser);
  } catch {
    const blocked = buildBlockedAnonymousResponse();
    return {
      ok: false,
      text: blocked.text,
      structured: blocked.structured,
      status: "blocked",
      agent_runs,
      intentKind,
      error_code: COACH_AGENT_ERROR.INVALID_TRUSTED_USER,
    };
  }

  if (!message) {
    const rejected = buildRejectedPlanResponse(COACH_AGENT_ERROR.EMPTY_MESSAGE);
    return {
      ok: false,
      text: rejected.text,
      structured: rejected.structured,
      status: rejected.status,
      agent_runs,
      intentKind,
      error_code: COACH_AGENT_ERROR.EMPTY_MESSAGE,
    };
  }

  const contextAvailable = input.contextAvailable !== false;
  if (!contextAvailable) {
    const insuff = buildInsufficientContextResponse(message);
    return {
      ok: false,
      text: insuff.text,
      structured: insuff.structured,
      status: insuff.status,
      agent_runs,
      intentKind,
      error_code: COACH_AGENT_ERROR.INSUFFICIENT_CONTEXT,
    };
  }

  const orchIntent = intentForOrchestrator(message, intentKind);
  const { ok: planOk, plan } = createExecutionPlan({
    trustedUserId: userId,
    intent: orchIntent,
    contextAvailable: true,
    ...(intentKind === "why_plan_changed"
      ? {
          overrides: {
            forceSkills: ["explain_decision", "analyze_outcome", "analyze_performance"],
            forceAgents: planAgentsForWhy(),
          },
        }
      : {}),
  });

  if (!planOk || plan.status === "rejected") {
    const rejected = buildRejectedPlanResponse(
      plan.rejection_reason ?? COACH_AGENT_ERROR.PLAN_REJECTED,
    );
    return {
      ok: false,
      text: rejected.text,
      structured: rejected.structured,
      status: rejected.status,
      plan_id: plan.plan_id,
      agent_runs,
      intentKind,
      error_code: COACH_AGENT_ERROR.PLAN_REJECTED,
    };
  }

  if (plan.status === "insufficient_context") {
    const insuff = buildInsufficientContextResponse(message);
    return {
      ok: false,
      text: insuff.text,
      structured: insuff.structured,
      status: insuff.status,
      plan_id: plan.plan_id,
      agent_runs,
      intentKind,
      error_code: COACH_AGENT_ERROR.INSUFFICIENT_CONTEXT,
    };
  }

  const specialistResults: AgentAnalysisResult[] = [];
  const workerAgents = plan.agents.filter((id) => id !== COACH_AGENT_ID);
  const agentsToRun = workerAgents.length ? workerAgents : plan.agents;
  const coachRunId = `coach_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  for (const agentId of agentsToRun) {
    const out = await runSpecialistAgent({
      trustedUserId: userId,
      agentId,
      plan,
      intent: message,
      parentRunId: coachRunId,
      ...(input.callTool ? { callTool: input.callTool } : {}),
      ...(input.skipKnowledge !== undefined ? { skipKnowledge: input.skipKnowledge } : {}),
    });
    agent_runs.push(out.agent_run);
    specialistResults.push(out.result);
  }

  // Extra WHY skills if specialists didn't cover explain_decision
  let explainResult: unknown = null;
  let outcomeResult: unknown = null;
  if (intentKind === "why_plan_changed" && input.callTool) {
    const explain = await runSkill({
      skillId: "explain_decision",
      trustedUserId: userId,
      agentId: COACH_AGENT_ID,
      callTool: input.callTool,
    });
    if (explain.ok && explain.data) explainResult = explain.data.result;
    const outcome = await runSkill({
      skillId: "analyze_outcome",
      trustedUserId: userId,
      agentId: COACH_AGENT_ID,
      callTool: input.callTool,
    });
    if (outcome.ok && outcome.data) outcomeResult = outcome.data.result;
  }

  const why =
    intentKind === "why_plan_changed"
      ? extractWhyFromSpecialists(specialistResults, explainResult, outcomeResult)
      : null;

  // Enrich training_mode from tool-backed specialist evidence if present
  if (why) {
    for (const e of why.evidence_items) {
      if (e.signal === "trainingMode" && e.value != null) {
        why.training_mode = String(e.value);
      }
    }
  }

  let proposal: DecisionProposal | null = null;
  let proposalStatus: CoachFactPack["proposalStatus"] = "none";
  let proposalRejectReason: string | undefined;

  for (const r of specialistResults) {
    if (r.proposal && (!proposal || r.proposal.confidence > proposal.confidence)) {
      proposal = r.proposal;
    }
  }

  if (input.forceSafetyBlock && proposal) {
    proposalStatus = "safety_blocked";
    proposalRejectReason = COACH_AGENT_ERROR.SAFETY_REJECTION;
    proposal = null;
  } else if (proposal && input.decisions && input.safety) {
    // Soft validate using coach proposal bridge shape
    const soft = validateProposalAgainstDecisionEngine(
      {
        type: mapProposedType(proposal.proposed_type),
        action: "adapt_workout",
        value: proposal.proposed_value,
        reasonCodes: proposal.reason_codes,
        evidence: {},
        confidence: proposal.confidence,
      },
      input.decisions,
      input.safety,
    );
    if (!soft.ok || !soft.proposal) {
      proposalStatus = "rejected";
      proposalRejectReason = soft.reason || COACH_AGENT_ERROR.INVALID_PROPOSAL;
      proposal = null;
    } else {
      proposalStatus = "accepted";
    }
  } else if (proposal) {
    // No live snapshot in this call — keep proposal as informational only (not applied)
    proposalStatus = "accepted";
  }

  const factPack = buildFactPack({
    intentKind,
    message,
    specialistResults,
    why,
    proposal,
    proposalStatus,
    ...(proposalRejectReason ? { proposalRejectReason } : {}),
  });

  const built = buildCoachResponse(factPack);
  const finishedAt = new Date().toISOString();
  recordAgentRun({
    run_id: coachRunId,
    agent_id: COACH_AGENT_ID,
    user_id: userId,
    status:
      built.status === "ok" || built.status === "partial"
        ? "completed"
        : built.status === "blocked"
          ? "blocked_by_safety"
          : "failed",
    created_at: finishedAt,
    started_at: finishedAt,
    finished_at: finishedAt,
    context_fingerprint: plan.plan_id,
    metadata: {
      agent_version: "1.0.0",
      model: "runCoachAgent",
      estimated_cost: agent_runs.length + 1,
      latency_ms: 0,
      specialist_count: agent_runs.length,
      intent_kind: intentKind,
    },
  });

  return {
    ok: built.status === "ok" || built.status === "partial",
    text: built.text,
    structured: built.structured,
    status: built.status,
    plan_id: plan.plan_id,
    agent_runs,
    factPack,
    intentKind,
    ...(built.status === "insufficient_evidence"
      ? { error_code: COACH_AGENT_ERROR.INSUFFICIENT_EVIDENCE }
      : {}),
  };
}

function planAgentsForWhy(): string[] {
  return ["specialist_performance"];
}

function mapProposedType(
  t: string,
):
  | "REDUCE_VOLUME"
  | "INCREASE_RECOVERY"
  | "REST"
  | "EXPRESS_WORKOUT"
  | "FULL_WORKOUT"
  | "DELOAD"
  | "NUTRITION_FOCUS"
  | "HYDRATION_FOCUS"
  | "SLEEP_FOCUS"
  | "CHECKIN" {
  const allowed = new Set([
    "REDUCE_VOLUME",
    "INCREASE_RECOVERY",
    "REST",
    "EXPRESS_WORKOUT",
    "FULL_WORKOUT",
    "DELOAD",
    "NUTRITION_FOCUS",
    "HYDRATION_FOCUS",
    "SLEEP_FOCUS",
    "CHECKIN",
  ]);
  if (allowed.has(t)) return t as ReturnType<typeof mapProposedType>;
  if (t === "PROGRESSION") return "FULL_WORKOUT";
  if (t === "CHECKIN") return "CHECKIN";
  return "REDUCE_VOLUME";
}
