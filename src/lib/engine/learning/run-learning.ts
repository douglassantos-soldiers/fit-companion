/**
 * runLearningCycle — Decision → Outcome → LearningEvent → LearningSignal.
 * Produces signals only. Never mutates Decision thresholds, Safety, or Living Plan.
 */
import type { Decision, DecisionView } from "@/lib/engine/decision-contract";
import {
  toLearningDecisionRef,
  type LearningDecisionRef,
} from "@/lib/engine/learning/decision-ref";
import { buildLearningEvent, type LearningEvent } from "@/lib/engine/learning/events";
import {
  isPartialAdherence,
  normalizeAdherence,
  type LearningOutcome,
} from "@/lib/engine/learning/outcome";
import {
  buildLearningSignalRecord,
  resolveSignalKey,
  type LearningSignalRecord,
} from "@/lib/engine/learning/signals";
import { LEARNING_ENGINE_VERSION } from "@/lib/engine/learning/version";
import { learningBiasAllowed } from "@/lib/engine/learning-guardrails";
import type { RecoveryLevel } from "@/lib/engine/recovery/types";

export type LearningCycleStatus =
  "learned" | "insufficient_outcome" | "conflict" | "blocked" | "noop";

export type LearningRecoveryContext = {
  recoveryLevel: RecoveryLevel;
};

export type RunLearningCycleInput = {
  decision: Decision | DecisionView | LearningDecisionRef;
  outcome: LearningOutcome | null;
  /** Prior signals for the same decision / signal key (repeat + conflict). */
  priorSignals?: LearningSignalRecord[];
  /** Extra outcomes for the same decisionId (conflict detection). */
  siblingOutcomes?: LearningOutcome[];
  recoveryContext?: LearningRecoveryContext;
};

export type RunLearningCycleResult = {
  events: LearningEvent[];
  signals: LearningSignalRecord[];
  status: LearningCycleStatus;
  engineVersion: string;
};

function baseConfidence(decision: LearningDecisionRef, outcome: LearningOutcome): number {
  let c = Math.max(0.15, Math.min(0.95, decision.confidence));
  const adherence = normalizeAdherence(outcome.adherence);
  if (adherence != null) {
    c = c * (0.55 + 0.45 * adherence);
  }
  if (isPartialAdherence(adherence)) {
    c *= 0.75;
  }
  if (outcome.result === "mixed" || outcome.quality === "mixed") {
    c *= 0.7;
  }
  if (outcome.result === "unknown" || outcome.quality === "unknown") {
    c *= 0.5;
  }
  return Math.round(Math.max(0.05, Math.min(0.95, c)) * 1000) / 1000;
}

function isPositive(o: LearningOutcome): boolean {
  return o.result === "positive" || o.quality === "success";
}

function isNegative(o: LearningOutcome): boolean {
  return o.result === "negative" || o.quality === "fail";
}

function isMissing(o: LearningOutcome | null): boolean {
  if (o == null) return true;
  return o.result === "missing" || o.quality === "pending";
}

function domainFor(decision: LearningDecisionRef): NonNullable<LearningEvent["domain"]> {
  const t = decision.decisionType.toLowerCase();
  if (t.includes("nutrition") || t.includes("meal")) return "nutrition";
  if (t.includes("sleep")) return "sleep";
  if (t.includes("recovery") || t.includes("rest")) return "recovery";
  if (t.includes("behavior")) return "behavior";
  return "training";
}

function suggestsVolumeIncrease(outcome: LearningOutcome, signalKey: string): boolean {
  if (signalKey === "volume_reduction_helps" && isNegative(outcome)) return true;
  const action = outcome.action.toLowerCase();
  return action.includes("increase") && action.includes("volume");
}

function detectConflict(outcome: LearningOutcome, siblings: LearningOutcome[]): boolean {
  const pool = [outcome, ...siblings.filter((s) => s.decisionId === outcome.decisionId)];
  const hasPos = pool.some(isPositive);
  const hasNeg = pool.some(isNegative);
  return hasPos && hasNeg;
}

/**
 * Canonical Learning Engine entrypoint.
 * Signals only — Decision Engine / Safety remain authoritative for rules and apply.
 */
export function runLearningCycle(input: RunLearningCycleInput): RunLearningCycleResult {
  const decision = toLearningDecisionRef(input.decision);
  const engineVersion = LEARNING_ENGINE_VERSION;
  const events: LearningEvent[] = [];
  const signals: LearningSignalRecord[] = [];

  if (isMissing(input.outcome)) {
    events.push(
      buildLearningEvent({
        kind: "attribution_recorded",
        decision,
        outcome: input.outcome,
        confidence: 0,
        domain: domainFor(decision),
        notes: ["Outcome ausente ou pendente — sem promoção de LearningSignal."],
        evidence: { status: "insufficient_outcome" },
      }),
    );
    return {
      events,
      signals,
      status: "insufficient_outcome",
      engineVersion,
    };
  }

  const outcome = input.outcome!;
  const siblings = input.siblingOutcomes ?? [];
  const signalKey = resolveSignalKey(decision, outcome);
  if (!signalKey) {
    return { events, signals, status: "noop", engineVersion };
  }

  const recoveryLevel = input.recoveryContext?.recoveryLevel ?? "moderate";
  const volumeUp = suggestsVolumeIncrease(outcome, signalKey);
  const biasOk = learningBiasAllowed({
    recoveryLevel,
    blockStims: decision.safetyStatus.blockStims,
    preferLightTraining: decision.safetyStatus.preferLightTraining,
    suggestedVolumeIncrease: volumeUp,
  });

  if (!biasOk) {
    events.push(
      buildLearningEvent({
        kind: "bias_blocked",
        decision,
        outcome,
        confidence: baseConfidence(decision, outcome),
        patternKey: signalKey,
        domain: domainFor(decision),
        blockedByGuardrail: true,
        notes: [
          "Learning bias bloqueado por Safety / recovery — sinal não promove aumento de volume.",
        ],
      }),
    );
    const blocked = buildLearningSignalRecord({
      decision,
      outcome,
      signal: signalKey,
      confidence: Math.min(0.25, baseConfidence(decision, outcome)),
      blockedByGuardrail: true,
      recoveryLevel,
    });
    signals.push(blocked);
    return { events, signals, status: "blocked", engineVersion };
  }

  if (detectConflict(outcome, siblings)) {
    const conf = Math.min(0.35, baseConfidence(decision, outcome) * 0.4);
    events.push(
      buildLearningEvent({
        kind: "pattern_weakened",
        decision,
        outcome,
        confidence: conf,
        patternKey: signalKey,
        domain: domainFor(decision),
        notes: ["Outcomes conflitantes para a mesma Decision — confiança atenuada."],
        evidence: { conflict: true, sibling_count: siblings.length },
      }),
    );
    signals.push(
      buildLearningSignalRecord({
        decision,
        outcome,
        signal: signalKey,
        confidence: conf,
        recoveryLevel,
      }),
    );
    return { events, signals, status: "conflict", engineVersion };
  }

  const priors = (input.priorSignals ?? []).filter(
    (s) => s.decisionId === decision.decisionId || s.signal === signalKey,
  );
  const priorPositive = priors.filter((s) => !s.blockedByGuardrail && s.confidence >= 0.55);
  let confidence = baseConfidence(decision, outcome);

  let kind: LearningEvent["kind"] = "attribution_recorded";
  if (isPositive(outcome)) {
    kind = priorPositive.length > 0 ? "pattern_reinforced" : "pattern_detected";
    if (priorPositive.length > 0) {
      confidence = Math.min(0.95, confidence + 0.08 * Math.min(3, priorPositive.length));
    }
  } else if (isNegative(outcome)) {
    kind = "pattern_weakened";
    confidence = Math.max(0.1, confidence * 0.65);
  } else {
    kind = "attribution_recorded";
    confidence = Math.max(0.1, confidence * 0.8);
  }

  events.push(
    buildLearningEvent({
      kind,
      decision,
      outcome,
      confidence,
      patternKey: signalKey,
      domain: domainFor(decision),
      ...(kind === "pattern_reinforced"
        ? { notes: ["Decisão repetida com outcome consistente — reforço de sinal."] }
        : {}),
      evidence: {
        prior_signal_count: priors.length,
        adherence: outcome.adherence,
        result: outcome.result,
      },
    }),
  );

  signals.push(
    buildLearningSignalRecord({
      decision,
      outcome,
      signal: signalKey,
      confidence,
      recoveryLevel,
    }),
  );

  return {
    events,
    signals,
    status: "learned",
    engineVersion,
  };
}
