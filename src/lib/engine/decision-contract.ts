/**
 * Canonical Decision contract.
 * Screens consume Decision / DecisionContextSnapshot — never rebuild decisions client-side.
 * Agents/Coach emit DecisionProposal; only the Decision Engine emits Decision.
 */
import type { DecisionBundle, EngineDecision } from "@/lib/engine/decision";
import type { DecisionContextSnapshot } from "@/lib/engine/decision-context-snapshot";
import {
  evidenceFromSnapshotLike,
  evidenceItemsFromContext,
  mergeEvidence,
  type DecisionEvidence,
} from "@/lib/engine/decision-evidence";
import {
  engineTypeToCanonical,
  refineWorkoutModeCanonical,
  type PerformanceDecisionType,
} from "@/lib/engine/performance-decision-types";
import type { ReasonCode } from "@/lib/engine/reason-codes";
import { canonicalReasonCode, toReasonAlias } from "@/lib/engine/reason-codes";
import type { SafetyVerdict } from "@/lib/engine/safety";

/** Bump when Decision shape / why-what-expected semantics change. */
export const DECISION_CONTRACT_VERSION = 1;

export type DecisionStatus = "active" | "superseded" | "expired";

export type DecisionAction = {
  kind: string;
  value: string | number | boolean;
};

export type DecisionWhy = {
  reason_codes: ReasonCode[];
  reason_aliases: string[];
  summary?: string;
};

export type DecisionWhat = {
  actions: DecisionAction[];
  decision_value: string | number | boolean;
  primary?: boolean;
};

export type DecisionExpectedOutcome = {
  kind: string;
  horizon?: string;
  metric?: string;
  note?: string;
} | null;

export type Decision = {
  decision_id: string;
  user_id: string;
  /** Same as input_fingerprint — binds Decision to assembled Context. */
  context_id: string;
  created_at: string;
  engine_version: string;
  /** Contract schema version (not engine rule version). */
  decision_version: number;
  context_version: number;
  decision_type: PerformanceDecisionType | string;
  status: DecisionStatus;
  priority: number;
  reason_codes: ReasonCode[];
  /** SCREAMING aliases for explain UI */
  reason_aliases: string[];
  confidence: number;
  safety_status: {
    escalateCare: boolean;
    blockStims: boolean;
    preferLightTraining: boolean;
    flags: string[];
  };
  actions: DecisionAction[];
  evidence: DecisionEvidence;
  why: DecisionWhy;
  what: DecisionWhat;
  expected_outcome: DecisionExpectedOutcome;
  expires_at: string;
  explanation?: string;
  input_fingerprint?: string;
  /** Legacy engine type (snake) for attribution compatibility */
  engine_decision_type?: string;
  decision_value?: string | number | boolean;
};

/** CamelCase view for AI / Coach — never invent thresholds; narrate why/what/outcome. */
export type DecisionView = {
  decisionId: string;
  userId: string;
  contextId: string;
  decisionType: string;
  decisionVersion: number;
  engineVersion: string;
  reasonCodes: ReasonCode[];
  reasonAliases: string[];
  evidence: DecisionEvidence;
  confidence: number;
  safetyStatus: Decision["safety_status"];
  createdAt: string;
  why: {
    reasonCodes: ReasonCode[];
    reasonAliases: string[];
    summary?: string;
  };
  what: {
    actions: DecisionAction[];
    decisionValue: string | number | boolean;
    primary?: boolean;
  };
  expectedOutcome: {
    kind: string;
    horizon?: string;
    metric?: string;
    note?: string;
  } | null;
};

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) + h + str.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16);
}

export function canonicalDecisionType(d: EngineDecision): PerformanceDecisionType {
  if (d.decisionType === "training_mode" && typeof d.decisionValue === "string") {
    return refineWorkoutModeCanonical(d.decisionValue);
  }
  if (d.decisionType === "primary_action" && d.decisionValue === "sleep") {
    return "SLEEP_PRIORITY";
  }
  if (d.decisionType === "primary_action" && d.decisionValue === "rest") {
    return "REST";
  }
  return engineTypeToCanonical(d.decisionType);
}

/** Deterministic id: hash(userId|date|type|value|fingerprint). */
export function buildDecisionId(opts: {
  userId: string;
  date: string;
  decisionType: string;
  decisionValue: string | number | boolean;
  inputFingerprint: string;
}): string {
  const value =
    typeof opts.decisionValue === "boolean" || typeof opts.decisionValue === "number"
      ? String(opts.decisionValue)
      : opts.decisionValue;
  return `dec_${djb2(
    [opts.userId, opts.date, opts.decisionType, value, opts.inputFingerprint].join("|"),
  )}`;
}

function endOfLocalDayIso(date: string): string {
  return `${date}T23:59:59.999Z`;
}

export function expectedOutcomeForDecision(
  d: EngineDecision,
  decisionType: PerformanceDecisionType | string,
): DecisionExpectedOutcome {
  const mode = typeof d.decisionValue === "string" ? d.decisionValue : null;
  if (d.decisionType === "training_mode") {
    if (mode === "rest") {
      return { kind: "REDUCE_FATIGUE", horizon: "1d", metric: "recovery", note: "rest_day" };
    }
    if (mode === "deload") {
      return { kind: "REDUCE_FATIGUE", horizon: "7d", metric: "training_load" };
    }
    if (mode === "express") {
      return { kind: "PROTECT_ADHERENCE", horizon: "1d", metric: "session_completion" };
    }
    return { kind: "PROGRESS_TRAINING", horizon: "1d", metric: "training_volume" };
  }
  if (d.decisionType === "training_volume" && typeof d.decisionValue === "number") {
    if (d.decisionValue < 0.85) {
      return { kind: "REDUCE_ACCESSORY_VOLUME", horizon: "1d", metric: "training_volume" };
    }
    return { kind: "MAINTAIN_VOLUME", horizon: "1d", metric: "training_volume" };
  }
  if (d.decisionType === "block_stims" && d.decisionValue === true) {
    return { kind: "PROTECT_SLEEP", horizon: "1d", metric: "stim_intake" };
  }
  if (d.decisionType === "primary_action") {
    if (d.decisionValue === "sleep") {
      return { kind: "IMPROVE_SLEEP", horizon: "1d", metric: "sleep_hours" };
    }
    if (d.decisionValue === "meal") {
      return { kind: "IMPROVE_PROTEIN_ADHERENCE", horizon: "1d", metric: "protein" };
    }
    if (d.decisionValue === "rest") {
      return { kind: "REDUCE_FATIGUE", horizon: "1d", metric: "recovery" };
    }
  }
  if (d.decisionType === "plateau_response") {
    return { kind: "BREAK_PLATEAU", horizon: "14d", metric: "strength" };
  }
  if (d.decisionType === "progression") {
    return { kind: "PROGRESS_LOAD", horizon: "7d", metric: "load" };
  }
  if (decisionType === "SLEEP_PRIORITY") {
    return { kind: "IMPROVE_SLEEP", horizon: "1d", metric: "sleep_hours" };
  }
  if (decisionType === "REST") {
    return { kind: "REDUCE_FATIGUE", horizon: "1d", metric: "recovery" };
  }
  return null;
}

export function evidenceForDecision(
  d: EngineDecision,
  snapshot: DecisionContextSnapshot,
): DecisionEvidence {
  const ctx = snapshot.context;
  const base = evidenceFromSnapshotLike({
    sleepHours: ctx.sleep.hours,
    energy: ctx.energy,
    availableMin: ctx.availableTimeMin,
    recoveryScore: ctx.recovery.score,
    hardRpeStreak: ctx.training.hardRpeStreak,
    proteinAdherence: ctx.nutrition.proteinAdherence7d,
    confidenceBase: ctx.confidenceBase,
  });
  const items = evidenceItemsFromContext({
    date: snapshot.date,
    sleepHours: ctx.sleep.hours,
    sleepSource: ctx.sleep.source,
    energy: ctx.energy,
    availableMin: ctx.availableTimeMin,
    recoveryScore: ctx.recovery.score,
    hardRpeStreak: ctx.training.hardRpeStreak,
    proteinAdherence: ctx.nutrition.proteinAdherence7d,
    confidenceBase: ctx.confidenceBase,
  });
  return mergeEvidence(base, {
    metrics: {
      decisionValue:
        typeof d.decisionValue === "boolean" || typeof d.decisionValue === "number"
          ? d.decisionValue
          : String(d.decisionValue),
      confidence: d.confidence,
      trainingMode: snapshot.decisions.trainingMode,
      sessionDuration: snapshot.decisions.sessionDuration,
    },
    items,
    notes: d.explanation ? [d.explanation] : [],
  });
}

export function safetyStatusFromVerdict(safety: SafetyVerdict): Decision["safety_status"] {
  return {
    escalateCare: safety.escalateCare === true,
    blockStims: safety.blockStims === true,
    preferLightTraining: safety.preferLightTraining === true,
    flags: [...(safety.flags ?? [])],
  };
}

const TYPE_PRIORITY: Record<string, number> = {
  REST: 100,
  DELOAD: 90,
  WORKOUT_MODE: 80,
  TRAINING_VOLUME: 70,
  TRAINING_LOAD: 65,
  NUTRITION_TARGET: 50,
  MEAL_PRIORITY: 45,
  SLEEP_PRIORITY: 60,
  PLATEAU_RESPONSE: 55,
  PROGRESSION: 40,
  BEHAVIOR_INTERVENTION: 35,
};

export function engineDecisionToContract(
  d: EngineDecision,
  snapshot: DecisionContextSnapshot,
  createdAt = new Date().toISOString(),
): Decision {
  const decision_type = canonicalDecisionType(d);
  const reason_codes = d.reasonCodes.map((c) => canonicalReasonCode(c));
  const reason_aliases = reason_codes.map((c) => toReasonAlias(c));
  const actions: DecisionAction[] = [{ kind: d.decisionType, value: d.decisionValue }];
  const primary = d.decisionType === "training_mode" || d.decisionType === "primary_action";

  const why: DecisionWhy = {
    reason_codes,
    reason_aliases,
  };
  if (d.explanation) why.summary = d.explanation;

  const what: DecisionWhat = {
    actions,
    decision_value: d.decisionValue,
  };
  if (primary) what.primary = true;

  return {
    decision_id: buildDecisionId({
      userId: snapshot.userId,
      date: snapshot.date,
      decisionType: decision_type,
      decisionValue: d.decisionValue,
      inputFingerprint: snapshot.inputFingerprint,
    }),
    user_id: snapshot.userId,
    context_id: snapshot.inputFingerprint,
    created_at: createdAt,
    engine_version: snapshot.engineVersion,
    decision_version: DECISION_CONTRACT_VERSION,
    context_version: snapshot.snapshotVersion,
    decision_type,
    status: "active",
    priority: TYPE_PRIORITY[decision_type] ?? 30,
    reason_codes,
    reason_aliases,
    confidence: d.confidence,
    safety_status: safetyStatusFromVerdict(snapshot.safety),
    actions,
    evidence: evidenceForDecision(d, snapshot),
    why,
    what,
    expected_outcome: expectedOutcomeForDecision(d, decision_type),
    expires_at: endOfLocalDayIso(snapshot.date),
    explanation: d.explanation,
    input_fingerprint: snapshot.inputFingerprint,
    engine_decision_type: d.decisionType,
    decision_value: d.decisionValue,
  };
}

export function decisionsFromBundle(snapshot: DecisionContextSnapshot): Decision[] {
  return snapshot.decisions.decisions.map((d) => engineDecisionToContract(d, snapshot));
}

export function toDecisionView(d: Decision): DecisionView {
  const why: DecisionView["why"] = {
    reasonCodes: d.why.reason_codes,
    reasonAliases: d.why.reason_aliases,
  };
  if (d.why.summary) why.summary = d.why.summary;

  const what: DecisionView["what"] = {
    actions: d.what.actions,
    decisionValue: d.what.decision_value,
  };
  if (d.what.primary) what.primary = true;

  let expectedOutcome: DecisionView["expectedOutcome"] = null;
  if (d.expected_outcome) {
    expectedOutcome = { kind: d.expected_outcome.kind };
    if (d.expected_outcome.horizon) expectedOutcome.horizon = d.expected_outcome.horizon;
    if (d.expected_outcome.metric) expectedOutcome.metric = d.expected_outcome.metric;
    if (d.expected_outcome.note) expectedOutcome.note = d.expected_outcome.note;
  }

  return {
    decisionId: d.decision_id,
    userId: d.user_id,
    contextId: d.context_id,
    decisionType: d.decision_type,
    decisionVersion: d.decision_version,
    engineVersion: d.engine_version,
    reasonCodes: d.reason_codes,
    reasonAliases: d.reason_aliases,
    evidence: d.evidence,
    confidence: d.confidence,
    safetyStatus: d.safety_status,
    createdAt: d.created_at,
    why,
    what,
    expectedOutcome,
  };
}

export type WhyPanel = {
  reason_codes: ReasonCode[];
  reason_aliases: string[];
  evidence: DecisionEvidence;
  primary_action: DecisionBundle["primaryAction"];
  training_mode: DecisionBundle["trainingMode"];
  explanations: string[];
  safety_status: Decision["safety_status"];
};

/** Structured “Why?” for Today / Coach — no UI rule invention. */
export function selectWhyPanel(snapshot: DecisionContextSnapshot): WhyPanel {
  const contracts = decisionsFromBundle(snapshot);
  const codes = [...new Set(contracts.flatMap((d) => d.reason_codes))] as ReasonCode[];
  const evidence = mergeEvidence(
    evidenceFromSnapshotLike({
      sleepHours: snapshot.context.sleep.hours,
      energy: snapshot.context.energy,
      availableMin: snapshot.context.availableTimeMin,
      recoveryScore: snapshot.context.recovery.score,
      hardRpeStreak: snapshot.context.training.hardRpeStreak,
      proteinAdherence: snapshot.context.nutrition.proteinAdherence7d,
      confidenceBase: snapshot.context.confidenceBase,
    }),
    {
      items: evidenceItemsFromContext({
        date: snapshot.date,
        sleepHours: snapshot.context.sleep.hours,
        sleepSource: snapshot.context.sleep.source,
        energy: snapshot.context.energy,
        availableMin: snapshot.context.availableTimeMin,
        recoveryScore: snapshot.context.recovery.score,
        hardRpeStreak: snapshot.context.training.hardRpeStreak,
        proteinAdherence: snapshot.context.nutrition.proteinAdherence7d,
        confidenceBase: snapshot.context.confidenceBase,
      }),
    },
  );
  return {
    reason_codes: codes,
    reason_aliases: codes.map((c) => toReasonAlias(c)),
    evidence,
    primary_action: snapshot.decisions.primaryAction,
    training_mode: snapshot.decisions.trainingMode,
    explanations: snapshot.decisions.decisions.map((d) => d.explanation).filter(Boolean),
    safety_status: safetyStatusFromVerdict(snapshot.safety),
  };
}
