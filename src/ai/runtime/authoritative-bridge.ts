/**
 * FASE 22.1 — CANONICAL authoritative bridge (production surface).
 * DecisionProposal → Safety → Decision Engine → Living Plan → Outcome → Learning.
 * Never copies proposed_value into Decision. Agents/Skills/Tools do not write Living Plan.
 *
 * FASE 22.6 — Decision/safety/outcome/learning critical audits are awaited;
 * Decision is not fully complete without durable audit confirmation.
 *
 * Formerly under src/ai/e2e/ — relocated so product paths do not import from the harness package.
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
  auditLearningCycleResultCritical,
  recordCriticalAudit,
  recordDecisionAuditCritical,
  recordOutcomeAuditCritical,
  stableCriticalAuditId,
} from "@/ai/governance/audit";
import type { Outcome } from "@/ai/contracts/outcome";
import {
  mapLayerErrorToPipeline,
  type AiPipelineErrorCode,
  type PipelineStageResult,
  stageFail,
  stageOk,
} from "@/ai/e2e/errors";
import { AI_PATH_LABEL } from "@/ai/runtime/path-labels";

const AUDIT_FAIL: AiPipelineErrorCode = "AUDIT_PERSISTENCE_FAILED";

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
  /** FASE 22.6 — true only when required critical audit was durably persisted. */
  audit_persisted?: boolean;
  audit_id?: string;
};

function newOutcomeId(decisionId: string): string {
  return `out_${decisionId}_${Date.now().toString(36)}`;
}

function auditGateFailed(
  stages: PipelineStageResult[],
  runId: string,
  auditId: string,
  error: string,
  partial: Omit<AuthoritativeBridgeResult, "ok" | "degraded" | "error_code" | "reason" | "stages" | "audit_persisted" | "audit_id">,
): AuthoritativeBridgeResult {
  stages.push(
    stageFail("audit", AUDIT_FAIL, error || AUDIT_FAIL, runId, {
      audit_id: auditId,
    }),
  );
  return {
    ok: false,
    degraded: true,
    reason: AUDIT_FAIL,
    error_code: AUDIT_FAIL,
    stages,
    ...partial,
    audit_persisted: false,
    audit_id: auditId,
  };
}

/**
 * Resolve proposal against the existing Decision Engine and continue the authorized path.
 * On Safety / proposal / decision failure: degrade with explicit reason — do not invent.
 * Critical audits are awaited; Decision is not fully complete without durable persist.
 *
 * @classification CANONICAL
 */
export async function runAuthoritativeBridge(
  input: AuthoritativeBridgeInput,
): Promise<AuthoritativeBridgeResult> {
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
      audit_persisted: false,
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

    const safetyAudit = await recordCriticalAudit({
      kind: "agent_run",
      audit_id: stableCriticalAuditId("safety", runId),
      user_id: snapshot.userId,
      subject_id: runId,
      run_id: runId,
      status: "blocked_by_safety",
      summary: safetyCheck.reason ?? "safety_rejection",
      context_fingerprint: snapshot.inputFingerprint,
      metadata: {
        error_code: "safety_rejection",
        proposal_id: proposal.proposal_id,
        path_label: AI_PATH_LABEL.CANONICAL,
      },
    });

    // Safety is the authoritative fail; still await critical audit (observability).
    if (!safetyAudit.ok) {
      stages.push(
        stageFail("audit", AUDIT_FAIL, safetyAudit.error ?? AUDIT_FAIL, runId, {
          audit_id: safetyAudit.audit_id,
        }),
      );
    }

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
      audit_persisted: safetyAudit.persisted === true,
      audit_id: safetyAudit.audit_id,
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

    if (isSafety) {
      const safetyAudit = await recordCriticalAudit({
        kind: "agent_run",
        audit_id: stableCriticalAuditId("safety", runId),
        user_id: snapshot.userId,
        subject_id: runId,
        run_id: runId,
        status: "blocked_by_safety",
        summary: resolved.rejection_reason ?? "safety_rejection",
        context_fingerprint: snapshot.inputFingerprint,
        metadata: {
          error_code: "safety_rejection",
          proposal_id: proposal.proposal_id,
          path_label: AI_PATH_LABEL.CANONICAL,
        },
      });
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
        audit_persisted: safetyAudit.persisted === true,
        audit_id: safetyAudit.audit_id,
      };
    }

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
      audit_persisted: false,
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
      audit_persisted: false,
    };
  }

  stages.push(
    stageOk("decision", {
      decision_id: decision.decision_id,
      decision_type: decision.decision_type,
      path_label: AI_PATH_LABEL.CANONICAL,
    }, runId),
  );

  const decisionAudit = await recordDecisionAuditCritical({
    userId: snapshot.userId,
    decisionId: decision.decision_id,
    runId,
    status: "resolved",
    summary: `engine:${decision.decision_type}`,
    contextFingerprint: snapshot.inputFingerprint,
    metadata: {
      proposal_id: proposal.proposal_id,
      source: proposal.source,
      training_mode: snapshot.decisions.trainingMode,
      path_label: AI_PATH_LABEL.CANONICAL,
    },
  });

  if (!decisionAudit.persisted && !("skipped" in decisionAudit && decisionAudit.skipped)) {
    return auditGateFailed(
      stages,
      runId,
      decisionAudit.audit_id,
      ("error" in decisionAudit ? decisionAudit.error : undefined) ?? AUDIT_FAIL,
      {
        decision,
        authoritative: resolved.authoritative,
        living_plan: null,
        outcome: null,
        learning: null,
      },
    );
  }

  stages.push(
    stageOk("audit", {
      audit_id: decisionAudit.audit_id,
      decision_id: decision.decision_id,
      persisted: decisionAudit.persisted === true,
    }, runId),
  );

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
      audit_persisted: decisionAudit.persisted === true,
      audit_id: decisionAudit.audit_id,
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
      audit_persisted: decisionAudit.persisted === true,
      audit_id: decisionAudit.audit_id,
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
      audit_persisted: decisionAudit.persisted === true,
      audit_id: decisionAudit.audit_id,
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

  const outcomeAudit = await recordOutcomeAuditCritical({
    userId: snapshot.userId,
    outcomeId: outcome.outcome_id,
    decisionId: decision.decision_id,
    runId,
    quality: outcome.quality,
    adherence,
    summary: `outcome:${quality}`,
  });

  if (!outcomeAudit.persisted && !("skipped" in outcomeAudit && outcomeAudit.skipped)) {
    return auditGateFailed(
      stages,
      runId,
      outcomeAudit.audit_id,
      ("error" in outcomeAudit ? outcomeAudit.error : undefined) ?? AUDIT_FAIL,
      {
        decision,
        authoritative: resolved.authoritative,
        living_plan,
        outcome,
        learning: null,
      },
    );
  }

  stages.push(stageOk("outcome", { outcome_id: outcome.outcome_id, quality }, runId));

  // --- learning ---
  const learningOutcome: LearningOutcome = fromAiOutcome(outcome, "living_plan_followed");
  const learning = runLearningCycle({
    decision,
    outcome: learningOutcome,
  });
  const learningAudits = await auditLearningCycleResultCritical({
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

  const learningFail = learningAudits.find(
    (a) => !a.persisted && !("skipped" in a && a.skipped),
  );
  if (learningFail) {
    return auditGateFailed(
      stages,
      runId,
      learningFail.audit_id,
      ("error" in learningFail ? learningFail.error : undefined) ?? AUDIT_FAIL,
      {
        decision,
        authoritative: resolved.authoritative,
        living_plan,
        outcome,
        learning,
      },
    );
  }

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
    audit_persisted: decisionAudit.persisted === true,
    audit_id: decisionAudit.audit_id,
  };
}
