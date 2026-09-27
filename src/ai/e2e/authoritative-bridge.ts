/**
 * FASE 15 — authoritative bridge.
 * DecisionProposal → Safety → Decision Engine → Living Plan → Outcome → Learning.
 * Never copies proposed_value into Decision. Agents/Skills/Tools do not write Living Plan.
 */
import type { DecisionProposal } from "@/lib/engine/decision-proposal";
import {
  resolveProposalAgainstEngine,
  validateProposalAgainstSafety,
  validateProposalContext,
} from "@/lib/engine/decision-proposal";
import type { Decision } from "@/lib/engine/decision-contract";
import type { DecisionContextSnapshot } from "@/lib/engine/decision-context-snapshot";
import type { LivingPlanSnapshot } from "@/lib/types";
import { fromAiOutcome, type LearningOutcome } from "@/lib/engine/learning/outcome";
import { runLearningCycle, type RunLearningCycleResult } from "@/lib/engine/learning/run-learning";
import {
  auditLearningCycleResult,
  recordDecisionAudit,
  recordOutcomeAudit,
} from "@/ai/governance/audit";
import type { Outcome } from "@/ai/contracts/outcome";
import {
  mapLayerErrorToPipeline,
  type AiPipelineErrorCode,
  type PipelineStageResult,
  stageFail,
  stageOk,
} from "@/ai/e2e/errors";

export type AuthoritativeBridgeInput = {
  proposal: DecisionProposal;
  snapshot: DecisionContextSnapshot;
  runId: string;
  /** Synthetic outcome for Learning (harness). Defaults to success / followed. */
  outcomeQuality?: Outcome["quality"];
  adherence?: number;
  /** When true, skip Living Plan claim even if engine snapshot has one. */
  skipLivingPlan?: boolean;
  /**
   * When false (product Coach path), stop after Decision + Living Plan reference.
   * Do not invent Outcome/Learning as if the user already followed the plan.
   * Defaults to true (E2E harness).
   */
  emitOutcomeAndLearning?: boolean;
};

export type AuthoritativeBridgeResult = {
  ok: boolean;
  degraded: boolean;
  reason?: string;
  error_code?: AiPipelineErrorCode;
  stages: PipelineStageResult[];
  /** Engine-authored only — never from proposed_value. */
  decision: Decision | null;
  authoritative: Decision[];
  living_plan: LivingPlanSnapshot | null;
  outcome: Outcome | null;
  learning: RunLearningCycleResult | null;
};

function newOutcomeId(decisionId: string): string {
  return `out_${decisionId}_${Date.now().toString(36)}`;
}

/**
 * Resolve proposal against the existing Decision Engine and continue the authorized path.
 * On Safety / proposal / decision failure: degrade with explict reason — do not invent.
 */
export function runAuthoritativeBridge(input: AuthoritativeBridgeInput): AuthoritativeBridgeResult {
  const { proposal, snapshot, runId } = input;
  const stages: PipelineStageResult[] = [];
  const authoritative = resolveProposalAgainstEngine(proposal, snapshot).authoritative;

  // --- proposal context ---
  const ctxCheck = validateProposalContext(proposal, snapshot);
  if (!ctxCheck.ok) {
    const code = mapLayerErrorToPipeline(ctxCheck.reason, "proposal");
    stages.push(
      stageFail("proposal", code, ctxCheck.reason ?? "proposal_context_invalid", runId),
    );
    return {
      ok: false,
      degraded: true,
      reason: ctxCheck.reason ?? "proposal_context_invalid",
      error_code: code,
      stages,
      decision: null,
      authoritative,
      living_plan: null,
      outcome: null,
      learning: null,
    };
  }
  stages.push(stageOk("proposal", { proposal_id: proposal.proposal_id }, runId));

  // --- safety ---
  const safetyCheck = validateProposalAgainstSafety(proposal, snapshot.safety);
  if (!safetyCheck.ok) {
    const code: AiPipelineErrorCode = "safety_rejection";
    stages.push(
      stageFail("safety", code, safetyCheck.reason ?? "safety_rejection", runId, {
        escalateCare: snapshot.safety.escalateCare,
      }),
    );
    return {
      ok: false,
      degraded: true,
      reason: safetyCheck.reason ?? "safety_rejection",
      error_code: code,
      stages,
      decision: null,
      authoritative,
      living_plan: null,
      outcome: null,
      learning: null,
    };
  }
  stages.push(
    stageOk("safety", {
      escalateCare: snapshot.safety.escalateCare,
      ok: snapshot.safety.ok,
    }, runId),
  );

  // --- decision engine (sole authority) ---
  const resolved = resolveProposalAgainstEngine(proposal, snapshot);
  if (!resolved.ok) {
    const code = mapLayerErrorToPipeline(resolved.rejection_reason, "proposal");
    const isSafety = code === "safety_rejection";
    stages.push(
      stageFail(
        isSafety ? "safety" : "decision",
        code,
        resolved.rejection_reason ?? "proposal_rejected",
        runId,
      ),
    );
    return {
      ok: false,
      degraded: true,
      reason: resolved.rejection_reason ?? "proposal_rejected",
      error_code: code,
      stages,
      decision: resolved.decision,
      authoritative: resolved.authoritative,
      living_plan: null,
      outcome: null,
      learning: null,
    };
  }

  const decision = resolved.decision;
  if (!decision) {
    stages.push(stageFail("decision", "decision_error", "no_authoritative_decision", runId));
    return {
      ok: false,
      degraded: true,
      reason: "no_authoritative_decision",
      error_code: "decision_error",
      stages,
      decision: null,
      authoritative: resolved.authoritative,
      living_plan: null,
      outcome: null,
      learning: null,
    };
  }

  stages.push(
    stageOk("decision", {
      decision_id: decision.decision_id,
      decision_type: decision.decision_type,
    }, runId),
  );

  recordDecisionAudit({
    userId: snapshot.userId,
    decisionId: decision.decision_id,
    runId,
    status: "resolved",
    summary: `engine:${decision.decision_type}`,
    contextFingerprint: snapshot.inputFingerprint,
    metadata: {
      proposal_id: proposal.proposal_id,
      source: proposal.source,
      // Never store proposed_value as decision value
      training_mode: snapshot.decisions.trainingMode,
    },
  });

  // --- living plan (engine-authorized path only) ---
  if (input.skipLivingPlan) {
    stages.push(
      stageFail("living_plan", "persistence_error", "living_plan_skipped", runId),
    );
    return {
      ok: false,
      degraded: true,
      reason: "living_plan_skipped",
      error_code: "persistence_error",
      stages,
      decision,
      authoritative: resolved.authoritative,
      living_plan: null,
      outcome: null,
      learning: null,
    };
  }

  const living_plan = snapshot.livingPlan ?? null;
  if (!living_plan) {
    stages.push(
      stageFail("living_plan", "persistence_error", "living_plan_unavailable", runId),
    );
    return {
      ok: false,
      degraded: true,
      reason: "living_plan_unavailable",
      error_code: "persistence_error",
      stages,
      decision,
      authoritative: resolved.authoritative,
      living_plan: null,
      outcome: null,
      learning: null,
    };
  }

  stages.push(
    stageOk("living_plan", {
      mode: living_plan.workout?.mode ?? null,
      date: snapshot.date,
    }, runId),
  );

  // Product Coach path: resolve Decision + reference Living Plan only (no fake follow-through).
  if (input.emitOutcomeAndLearning === false) {
    return {
      ok: true,
      degraded: false,
      stages,
      decision,
      authoritative: resolved.authoritative,
      living_plan,
      outcome: null,
      learning: null,
    };
  }

  // --- outcome (harness / explicit follow-through) ---
  const quality = input.outcomeQuality ?? "success";
  const adherence = input.adherence ?? 1;
  const outcome: Outcome = {
    outcome_id: newOutcomeId(decision.decision_id),
    user_id: snapshot.userId,
    decision_id: decision.decision_id,
    created_at: new Date().toISOString(),
    window: "d0",
    quality,
    metrics: {
      adherence,
      measuredValue: living_plan.workout?.mode ?? null,
      expectedValue: snapshot.decisions.trainingMode,
      living_plan_followed: quality === "success",
    },
    run_id: runId,
    attribution_type: "direct",
  };

  recordOutcomeAudit({
    userId: snapshot.userId,
    outcomeId: outcome.outcome_id,
    decisionId: decision.decision_id,
    runId,
    quality: outcome.quality,
    adherence,
    summary: `outcome:${quality}`,
  });
  stages.push(stageOk("outcome", { outcome_id: outcome.outcome_id, quality }, runId));

  // --- learning ---
  const learningOutcome: LearningOutcome = fromAiOutcome(outcome, "living_plan_followed");
  const learning = runLearningCycle({
    decision,
    outcome: learningOutcome,
  });
  auditLearningCycleResult({
    userId: snapshot.userId,
    runId,
    events: learning.events.map((e) => ({
      event_id: e.event_id,
      kind: e.kind,
      ...(e.decision_id ? { decision_id: e.decision_id } : {}),
      ...(e.outcome_id ? { outcome_id: e.outcome_id } : { outcome_id: outcome.outcome_id }),
      confidence: e.confidence,
      ...(e.blocked_by_guardrail != null
        ? { blocked_by_guardrail: e.blocked_by_guardrail }
        : {}),
    })),
  });
  stages.push(
    stageOk("learning", {
      status: learning.status,
      event_count: learning.events.length,
      signal_count: learning.signals.length,
    }, runId),
  );

  return {
    ok: true,
    degraded: false,
    stages,
    decision,
    authoritative: resolved.authoritative,
    living_plan,
    outcome,
    learning,
  };
}
