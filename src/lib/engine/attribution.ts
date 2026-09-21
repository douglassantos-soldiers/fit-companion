/**
 * Decision Outcome Attribution — deterministic, auditable, no ML.
 * Maps Decision → expected action → actual action → attributed outcome → learning gate.
 */
import {
  engineTypeToCanonical,
  isPerformanceDecisionType,
  refineWorkoutModeCanonical,
} from "@/lib/engine/performance-decision-types";
import type { PatternKind } from "@/lib/engine/learned-patterns";

export const ATTRIBUTION_ENGINE = "attribution_v1";
export const LEARNING_CONFIDENCE_MIN = 0.6;

export type ActionStatus =
  "pending" | "started" | "completed" | "skipped" | "rejected" | "modified";

export type OutcomeWindow = "d0" | "d1" | "d3" | "d7";

export type AttributionType = "direct" | "indirect" | "weak" | "unknown";

export type OutcomeQuality = "success" | "fail" | "mixed" | "unknown";

export type ActionKind =
  | "workout_started"
  | "session_completed"
  | "living_plan_started"
  | "living_plan_skipped"
  | "meal_logged"
  | "nutrition_day_observed"
  | "checkin_next_day"
  | "rest_taken"
  | "intervention_response"
  | "delayed_recovery";

export type ExpectedAction =
  | "start_express_workout"
  | "start_full_workout"
  | "start_deload_workout"
  | "take_rest_day"
  | "complete_planned_session"
  | "complete_planned_duration"
  | "hit_nutrition_target"
  | "log_priority_meal"
  | "next_day_sleep_checkin"
  | "follow_intervention"
  | "take_supplement"
  | "respond_to_plateau"
  | "progress_load";

export type DecisionRef = {
  id: string;
  decisionType: string;
  decisionValue: unknown;
  reasonCodes?: string[];
};

export type AttributionExtras = {
  mealSlot?: string;
  volumeReduced?: boolean;
  nutritionAdherenceObservable?: boolean;
  primaryKind?: "train" | "rest" | "sleep" | "meal";
  workoutCompleted?: boolean;
  rpe?: string | null;
  express?: boolean;
  sessionDurationMin?: number | null;
};

export type AttributionHit = {
  decisionId: string;
  decisionType: string;
  expectedAction: ExpectedAction | null;
  attributionType: AttributionType;
  attributionConfidence: number;
  outcomeType: string;
  outcomeWindow: OutcomeWindow;
  outcomeQuality: OutcomeQuality;
  learningSignal: string | null;
};

export type AttributionExplanation = {
  why: string[];
  expectedAction: string | null;
  actualAction: string | null;
  actionStatus: ActionStatus | null;
  outcomeType: string | null;
  observedAt: string | null;
  outcomeWindow: OutcomeWindow | null;
  attributionType: AttributionType | null;
  attributionConfidence: number | null;
  relatedDirectly: boolean;
  learningSignal: string | null;
  fedLearning: boolean;
};

const TERMINAL: ReadonlySet<ActionStatus> = new Set(["completed", "skipped", "rejected"]);

export function canonicalDecisionType(raw: string, value?: unknown): string {
  if (raw === "training_mode" && typeof value === "string") {
    return refineWorkoutModeCanonical(value);
  }
  if (raw === "primary_action" && value === "sleep") return "SLEEP_PRIORITY";
  if (raw === "primary_action" && value === "rest") return "REST";
  if (isPerformanceDecisionType(raw)) return raw;
  return engineTypeToCanonical(raw);
}

export function expectedActionForDecision(opts: {
  decisionType: string;
  decisionValue: unknown;
}): ExpectedAction | null {
  const type = canonicalDecisionType(opts.decisionType, opts.decisionValue);
  const value = opts.decisionValue;
  if (type === "REST") return "take_rest_day";
  if (type === "DELOAD") return "start_deload_workout";
  if (type === "WORKOUT_MODE") {
    if (value === "express") return "start_express_workout";
    return "start_full_workout";
  }
  if (type === "TRAINING_VOLUME") return "complete_planned_session";
  if (type === "TRAINING_LOAD") return "complete_planned_duration";
  if (type === "NUTRITION_TARGET") return "hit_nutrition_target";
  if (type === "MEAL_PRIORITY") return "log_priority_meal";
  if (type === "SLEEP_PRIORITY") return "next_day_sleep_checkin";
  if (type === "BEHAVIOR_INTERVENTION") return "follow_intervention";
  if (type === "SUPPLEMENT_ACTION") return "take_supplement";
  if (type === "PLATEAU_RESPONSE") return "respond_to_plateau";
  if (type === "PROGRESSION") return "progress_load";
  return null;
}

export function canUpdateExpectedAction(status: ActionStatus): boolean {
  return status === "pending";
}

export function nextActionStatus(current: ActionStatus, incoming: ActionStatus): ActionStatus {
  if (TERMINAL.has(current) && incoming !== "completed") return current;
  if (current === "completed") return "completed";
  return incoming;
}

export function actionKindFromLegacyOutcome(outcome: string): {
  actionKind: ActionKind;
  status: ActionStatus;
  window: OutcomeWindow;
} | null {
  if (outcome === "session_completed") {
    return { actionKind: "session_completed", status: "completed", window: "d0" };
  }
  if (outcome === "living_plan_followed") {
    return { actionKind: "living_plan_started", status: "started", window: "d0" };
  }
  if (outcome === "living_plan_skipped") {
    return { actionKind: "living_plan_skipped", status: "skipped", window: "d0" };
  }
  if (outcome === "workout_started") {
    return { actionKind: "workout_started", status: "started", window: "d0" };
  }
  return null;
}

function sessionQuality(extras?: AttributionExtras): OutcomeQuality {
  if (extras?.workoutCompleted === false) return "fail";
  if (extras?.workoutCompleted === true) {
    if (extras.rpe === "dificil") return "mixed";
    return "success";
  }
  return "unknown";
}

function hit(
  decision: DecisionRef,
  patch: Omit<AttributionHit, "decisionId" | "decisionType" | "expectedAction">,
): AttributionHit {
  const decisionType = canonicalDecisionType(decision.decisionType, decision.decisionValue);
  return {
    decisionId: decision.id,
    decisionType,
    expectedAction: expectedActionForDecision({
      decisionType,
      decisionValue: decision.decisionValue,
    }),
    ...patch,
  };
}

function ofType(decisions: DecisionRef[], types: string[]): DecisionRef[] {
  const set = new Set(types);
  return decisions.filter((d) => set.has(canonicalDecisionType(d.decisionType, d.decisionValue)));
}

function expressSignal(decision: DecisionRef, extras?: AttributionExtras): string | null {
  const type = canonicalDecisionType(decision.decisionType, decision.decisionValue);
  const express = extras?.express === true || decision.decisionValue === "express";
  if (type === "WORKOUT_MODE" && express && extras?.workoutCompleted !== false) {
    return "express_training_high_adherence";
  }
  return null;
}

/**
 * Pure attribution: only matching decision types receive the event.
 * Unrelated types of the same day are omitted (never unknown-inserted here).
 */
export function attributeEvent(opts: {
  actionKind: ActionKind;
  window: OutcomeWindow;
  decisions: DecisionRef[];
  extras?: AttributionExtras;
}): AttributionHit[] {
  const extras = opts.extras;
  const quality = sessionQuality(extras);

  if (opts.actionKind === "session_completed" || opts.actionKind === "workout_started") {
    const outcomeType =
      opts.actionKind === "session_completed" ? "session_completed" : "workout_started";
    const modeHits = ofType(opts.decisions, ["WORKOUT_MODE", "DELOAD"]).map((d) =>
      hit(d, {
        attributionType: "direct",
        attributionConfidence: 0.9,
        outcomeType,
        outcomeWindow: "d0",
        outcomeQuality: opts.actionKind === "session_completed" ? quality : "unknown",
        learningSignal: opts.actionKind === "session_completed" ? expressSignal(d, extras) : null,
      }),
    );
    const perfHits =
      opts.actionKind === "session_completed"
        ? ofType(opts.decisions, ["TRAINING_VOLUME", "TRAINING_LOAD"]).map((d) =>
            hit(d, {
              attributionType: "direct",
              attributionConfidence: 0.8,
              outcomeType: "session_completed",
              outcomeWindow: "d0",
              outcomeQuality: quality,
              learningSignal:
                canonicalDecisionType(d.decisionType, d.decisionValue) === "TRAINING_VOLUME"
                  ? "volume_reduction_helps"
                  : null,
            }),
          )
        : [];
    const behaviorHits =
      opts.actionKind === "session_completed" &&
      extras?.sessionDurationMin != null &&
      extras.sessionDurationMin < 45
        ? ofType(opts.decisions, ["BEHAVIOR_INTERVENTION"]).map((d) =>
            hit(d, {
              attributionType: "direct",
              attributionConfidence: 0.75,
              outcomeType: "intervention_response",
              outcomeWindow: "d0",
              outcomeQuality: quality,
              learningSignal: "express_training_high_adherence",
            }),
          )
        : [];
    return [...modeHits, ...perfHits, ...behaviorHits];
  }

  if (opts.actionKind === "living_plan_started" || opts.actionKind === "living_plan_skipped") {
    const outcomeType = opts.actionKind;
    const statusQuality: OutcomeQuality =
      opts.actionKind === "living_plan_skipped" ? "fail" : "unknown";
    const kind = extras?.primaryKind;
    const types =
      kind === "rest"
        ? ["REST"]
        : kind === "sleep"
          ? ["SLEEP_PRIORITY"]
          : kind === "meal"
            ? ["MEAL_PRIORITY"]
            : ["WORKOUT_MODE", "DELOAD", "REST"];
    return ofType(opts.decisions, types).map((d) =>
      hit(d, {
        attributionType: "direct",
        attributionConfidence: 0.7,
        outcomeType,
        outcomeWindow: "d0",
        outcomeQuality: statusQuality,
        learningSignal: null,
      }),
    );
  }

  if (opts.actionKind === "meal_logged") {
    return ofType(opts.decisions, ["MEAL_PRIORITY"]).map((d) =>
      hit(d, {
        attributionType: "direct",
        attributionConfidence: 0.8,
        outcomeType: "meal_logged",
        outcomeWindow: "d0",
        outcomeQuality: "success",
        learningSignal: "meal_priority_logged",
      }),
    );
  }

  if (opts.actionKind === "nutrition_day_observed") {
    const observable = extras?.nutritionAdherenceObservable === true;
    return ofType(opts.decisions, ["NUTRITION_TARGET"]).map((d) =>
      hit(d, {
        attributionType: observable ? "indirect" : "weak",
        attributionConfidence: observable ? 0.65 : 0.4,
        outcomeType: "nutrition_adherence",
        outcomeWindow: "d0",
        outcomeQuality: observable ? "mixed" : "unknown",
        learningSignal: observable ? "nutrition_target_adherence" : null,
      }),
    );
  }

  if (opts.actionKind === "checkin_next_day") {
    const sleepHits = ofType(opts.decisions, ["SLEEP_PRIORITY"]).map((d) =>
      hit(d, {
        attributionType: "direct",
        attributionConfidence: 0.7,
        outcomeType: "next_day_checkin",
        outcomeWindow: "d1",
        outcomeQuality: "success",
        learningSignal: "sleep_priority_followed",
      }),
    );
    const restHits = ofType(opts.decisions, ["REST"]).map((d) =>
      hit(d, {
        attributionType: "indirect",
        attributionConfidence: 0.6,
        outcomeType: "next_day_checkin",
        outcomeWindow: "d1",
        outcomeQuality: "mixed",
        learningSignal: "rest_next_day_recovery",
      }),
    );
    const volumeHits = extras?.volumeReduced
      ? ofType(opts.decisions, ["TRAINING_VOLUME"]).map((d) =>
          hit(d, {
            attributionType: "indirect",
            attributionConfidence: 0.65,
            outcomeType: "next_day_checkin",
            outcomeWindow: "d1",
            outcomeQuality: extras.workoutCompleted === false ? "fail" : "success",
            learningSignal: "volume_reduction_helps",
          }),
        )
      : [];
    return [...sleepHits, ...restHits, ...volumeHits];
  }

  if (opts.actionKind === "rest_taken") {
    return ofType(opts.decisions, ["REST"]).map((d) =>
      hit(d, {
        attributionType: "direct",
        attributionConfidence: 0.9,
        outcomeType: "rest_taken",
        outcomeWindow: "d0",
        outcomeQuality: "success",
        learningSignal: null,
      }),
    );
  }

  if (opts.actionKind === "intervention_response") {
    return ofType(opts.decisions, ["BEHAVIOR_INTERVENTION"]).map((d) =>
      hit(d, {
        attributionType: "direct",
        attributionConfidence: 0.75,
        outcomeType: "intervention_response",
        outcomeWindow: "d0",
        outcomeQuality: extras?.workoutCompleted === false ? "fail" : "success",
        learningSignal: "express_training_high_adherence",
      }),
    );
  }

  if (opts.actionKind === "delayed_recovery") {
    const window = opts.window === "d7" ? "d7" : "d3";
    return ofType(opts.decisions, ["REST"]).map((d) =>
      hit(d, {
        attributionType: "weak",
        attributionConfidence: window === "d7" ? 0.3 : 0.4,
        outcomeType: "delayed_recovery",
        outcomeWindow: window,
        outcomeQuality: "unknown",
        learningSignal: null,
      }),
    );
  }

  return [];
}

export function shouldLearnFromAttribution(opts: {
  attributionType: AttributionType;
  attributionConfidence: number;
  outcomeQuality: OutcomeQuality;
}): boolean {
  if (opts.outcomeQuality === "unknown") return false;
  if (opts.attributionType !== "direct" && opts.attributionType !== "indirect") return false;
  return opts.attributionConfidence >= LEARNING_CONFIDENCE_MIN;
}

export function patternKindFromLearningSignal(signal: string | null): PatternKind | null {
  if (signal === "express_training_high_adherence") return "prefers_short_sessions";
  if (signal === "volume_reduction_helps") return "volume_reduction_helps";
  return null;
}

export function learningSignalFromAttribution(hit: AttributionHit): string | null {
  if (!shouldLearnFromAttribution(hit)) return null;
  return hit.learningSignal;
}

export function addDaysKey(dateKey: string, delta: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function outcomeDedupeKey(
  hit: Pick<AttributionHit, "decisionId" | "outcomeType" | "outcomeWindow">,
): string {
  return `${hit.decisionId}:${hit.outcomeType}:${hit.outcomeWindow}`;
}

export type ActionRowPatch = {
  expectedAction: ExpectedAction;
  status: ActionStatus;
  actualAction?: string | null;
};

export function mergeActionRow(
  existing: {
    expectedAction: ExpectedAction;
    status: ActionStatus;
    actualAction?: string | null;
  } | null,
  incoming: ActionRowPatch,
): {
  expectedAction: ExpectedAction;
  status: ActionStatus;
  actualAction: string | null;
  changed: boolean;
} {
  if (!existing) {
    return {
      expectedAction: incoming.expectedAction,
      status: incoming.status,
      actualAction: incoming.actualAction ?? null,
      changed: true,
    };
  }
  const status = nextActionStatus(existing.status, incoming.status);
  const expectedAction = canUpdateExpectedAction(existing.status)
    ? incoming.expectedAction
    : existing.expectedAction;
  const actualAction = incoming.actualAction ?? existing.actualAction ?? null;
  const changed =
    status !== existing.status ||
    expectedAction !== existing.expectedAction ||
    actualAction !== (existing.actualAction ?? null);
  return { expectedAction, status, actualAction, changed };
}

export function explainAttributionFromParts(opts: {
  reasonCodes: string[];
  expectedAction: string | null;
  actualAction: string | null;
  actionStatus: ActionStatus | null;
  outcomeType: string | null;
  observedAt: string | null;
  outcomeWindow: OutcomeWindow | null;
  attributionType: AttributionType | null;
  attributionConfidence: number | null;
  learningSignal: string | null;
  outcomeQuality?: OutcomeQuality | null;
}): AttributionExplanation {
  const attributionType = opts.attributionType;
  const quality = opts.outcomeQuality ?? "unknown";
  const fedLearning =
    attributionType != null &&
    opts.attributionConfidence != null &&
    shouldLearnFromAttribution({
      attributionType,
      attributionConfidence: opts.attributionConfidence,
      outcomeQuality: quality,
    }) &&
    Boolean(patternKindFromLearningSignal(opts.learningSignal));
  return {
    why: opts.reasonCodes,
    expectedAction: opts.expectedAction,
    actualAction: opts.actualAction,
    actionStatus: opts.actionStatus,
    outcomeType: opts.outcomeType,
    observedAt: opts.observedAt,
    outcomeWindow: opts.outcomeWindow,
    attributionType,
    attributionConfidence: opts.attributionConfidence,
    relatedDirectly: attributionType === "direct",
    learningSignal: opts.learningSignal,
    fedLearning,
  };
}
