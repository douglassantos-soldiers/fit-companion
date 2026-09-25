/**
 * PerformanceContext — Context Engine operational contract.
 * Separates OBSERVED / DERIVED / RECOMMENDATIONS / DECISIONS — never mix categories.
 * Adapter only: does not re-assemble intelligence (assembleDecisionContext owns that).
 * LLM must never mutate this object — returns are frozen.
 */
import type { DecisionContextSnapshot } from "@/lib/engine/decision-context-snapshot";
import type { ContextSnapshot } from "@/lib/engine/context-snapshot";
import type { DecisionBundle } from "@/lib/engine/decision";
import type { Recommendation } from "@/lib/engine/recommendation";
import type { SafetyVerdict } from "@/lib/engine/safety";
import type { Decision } from "@/lib/engine/decision-contract";
import { decisionsFromBundle } from "@/lib/engine/decision-contract";
import type { AppState, Goal, TrainingMode } from "@/lib/types";

// ─── Signal provenance ───────────────────────────────────────────────────────

export type SignalSource =
  "checkin" | "wearable" | "profile" | "session" | "meal" | "derived" | "system" | "unknown";

export type ContextSignal<T> = {
  value: T;
  source: SignalSource;
  observedAt: string | null;
  confidence: number | null;
};

export function signalValue<T>(s: ContextSignal<T> | null | undefined): T | null {
  if (!s) return null;
  return s.value;
}

export function makeSignal<T>(
  value: T,
  source: SignalSource,
  opts?: { observedAt?: string | null; confidence?: number | null },
): ContextSignal<T> {
  return Object.freeze({
    value,
    source,
    observedAt: opts?.observedAt ?? null,
    confidence: opts?.confidence ?? null,
  });
}

export type DataFreshness = {
  overall: "fresh" | "stale" | "unknown";
  stale360: boolean;
  customer360Version: number | null;
  oldestObservedAt: string | null;
  newestObservedAt: string | null;
  wearableAvailable: boolean;
};

// ─── Categorical bags ────────────────────────────────────────────────────────

/** Raw facts from check-ins, sessions, meals, wearables — not interpreted. */
export type ObservedPerformanceData = {
  sleepHours: number | null;
  energy: string | null;
  availableTimeMin: number | null;
  equipmentProfile: string;
  equipmentLimitedToday: boolean;
  soreness: number | null;
  stress: number | null;
  acceptedTrainingMode: TrainingMode | null;
  mealsLoggedToday: number;
  sessions7d: number;
  hasCheckInToday: boolean;
};

/** Engine-derived scores and trends — not authoritative choices. */
export type DerivedPerformanceData = {
  goal: Goal;
  recoveryScore: number | null;
  recoveryLevel: string | null;
  recoveryReadiness: string | null;
  proteinAdherence7d: number | null;
  hardRpeStreak: number;
  weekHint: string | null;
  adherenceScore: number | null;
  performanceScore: number | null;
  travel: boolean;
  reasonSeeds: string[];
  confidenceBase: number;
};

export type PerformanceContextIdentity = {
  userId: string;
  timezone: string;
  date: string;
  customer360Version: number | null;
  stale360: boolean;
};

export type PerformanceContextGoals = {
  primary: Goal;
  equipmentProfile: string;
};

export type PerformanceContextConstraints = {
  safetyOk: boolean;
  flags: SafetyVerdict["flags"];
  blockStims: boolean;
  preferLightTraining: boolean;
  escalateCare: boolean;
  requireMedicalDisclaimer: boolean;
};

export type PerformanceContextWearable = {
  available: boolean;
  confidence: number | null;
  restingHr: number | null;
  hrv: number | null;
};

export type PerformanceContextSignals = {
  sleepHours: ContextSignal<number | null>;
  energy: ContextSignal<string | null>;
  availableTimeMin: ContextSignal<number | null>;
  recoveryScore: ContextSignal<number | null>;
  soreness: ContextSignal<number | null>;
  stress: ContextSignal<number | null>;
};

export type RecentOutcomeEntry = {
  kind: string;
  value?: string | number | boolean | null;
  observedAt?: string | null;
  source?: SignalSource;
};

export type PerformanceContext = {
  identity: PerformanceContextIdentity;
  profile: {
    goal: Goal;
    equipment: string;
  };
  goals: PerformanceContextGoals;
  goal: Goal;
  /** OBSERVED — sensors / logs / check-in */
  observed: ObservedPerformanceData;
  /** DERIVED — recovery, adherence, trends */
  derived: DerivedPerformanceData;
  /** Provenanced key signals (observed or derived tagged by source). */
  signals: PerformanceContextSignals;
  /** Domain views — observed+derived only; never decisions. */
  training: ContextSnapshot["training"];
  nutrition: ContextSnapshot["nutrition"];
  recovery: ContextSnapshot["recovery"];
  sleep: {
    hours: number | null;
    avg7d: number | null;
    source: "checkin" | "profile" | "wearable" | "unknown";
  };
  behavior: {
    activePatternKinds: string[];
    triggers: string[];
  };
  body: {
    sorenessAvg: number | null;
    stressAvg: number | null;
  };
  wearable: PerformanceContextWearable;
  consistency: {
    sessions7d: number;
    adherenceScore: number | null;
  };
  equipment: ContextSnapshot["equipment"];
  availability: {
    availableTimeMin: number | null;
  };
  constraints: PerformanceContextConstraints;
  recent_outcomes: RecentOutcomeEntry[];
  recent_decisions: Decision[];
  safety: SafetyVerdict;
  commerce: ContextSnapshot["commerce"];
  social: { joinedHubIds: string[] };
  environment: {
    travel: boolean;
    timezone: string;
  };
  timezone: string;
  /** Ranking only — not the final choice */
  recommendations: Recommendation[];
  /** Authoritative choices from Decision Engine */
  decisions: DecisionBundle;
  engineVersion: string;
  contextVersion: number;
  generatedAt: string;
  dataFreshness: DataFreshness;
  /** Aggregate confidence 0..1 */
  confidence: number;
  inputFingerprint: string;
  source: DecisionContextSnapshot["source"];
};

function mapSleepSource(ctx: ContextSnapshot): "checkin" | "profile" | "wearable" | "unknown" {
  const summary = ctx.recovery.sourceSummary?.sleep;
  if (summary === "wearable") return "wearable";
  if (summary === "checkin" || ctx.sleep.source === "checkin") return "checkin";
  if (summary === "profile" || ctx.sleep.source === "profile") return "profile";
  if (ctx.sleep.source === "wearable") return "wearable";
  return "unknown";
}

function observedFromContext(ctx: ContextSnapshot): ObservedPerformanceData {
  return {
    sleepHours: ctx.sleep.hours,
    energy: ctx.energy,
    availableTimeMin: ctx.availableTimeMin,
    equipmentProfile: ctx.equipment.profile,
    equipmentLimitedToday: ctx.equipment.limitedToday,
    soreness: ctx.recovery.sorenessAvg,
    stress: ctx.recovery.stressAvg,
    acceptedTrainingMode: ctx.acceptedTrainingMode,
    mealsLoggedToday: 0,
    sessions7d: ctx.training.recentSessions7d,
    hasCheckInToday: ctx.hasCheckInToday,
  };
}

function derivedFromContext(ctx: ContextSnapshot): DerivedPerformanceData {
  return {
    goal: ctx.goal,
    recoveryScore: ctx.recovery.score,
    recoveryLevel: ctx.recovery.level,
    recoveryReadiness: ctx.recovery.readiness ?? null,
    proteinAdherence7d: ctx.nutrition.proteinAdherence7d,
    hardRpeStreak: ctx.training.hardRpeStreak,
    weekHint: ctx.training.weekHint,
    adherenceScore: ctx.adherence.adherenceScore,
    performanceScore: ctx.adherence.performanceScore,
    travel: ctx.travel,
    reasonSeeds: ctx.reasonSeeds ?? [],
    confidenceBase: ctx.confidenceBase,
  };
}

function buildSignals(ctx: ContextSnapshot, date: string): PerformanceContextSignals {
  const sleepSource = mapSleepSource(ctx);
  const sleepConf =
    sleepSource === "wearable"
      ? (ctx.recovery.wearableConfidence ?? ctx.recovery.sleepConfidence ?? null)
      : sleepSource === "checkin"
        ? (ctx.recovery.sleepConfidence ?? ctx.recovery.checkInConfidence ?? 0.7)
        : sleepSource === "profile"
          ? 0.35
          : (ctx.recovery.sleepConfidence ?? null);
  const checkInAt = ctx.hasCheckInToday ? `${date}T12:00:00.000Z` : null;

  return Object.freeze({
    sleepHours: makeSignal(ctx.sleep.hours, sleepSource, {
      observedAt: sleepSource === "checkin" || sleepSource === "wearable" ? checkInAt : null,
      confidence: sleepConf,
    }),
    energy: makeSignal(ctx.energy, ctx.hasCheckInToday ? "checkin" : "unknown", {
      observedAt: checkInAt,
      confidence: ctx.hasCheckInToday ? (ctx.recovery.checkInConfidence ?? 0.65) : null,
    }),
    availableTimeMin: makeSignal(
      ctx.availableTimeMin,
      ctx.hasCheckInToday ? "checkin" : "profile",
      {
        observedAt: checkInAt,
        confidence: ctx.hasCheckInToday ? 0.7 : 0.4,
      },
    ),
    recoveryScore: makeSignal(ctx.recovery.score, "derived", {
      observedAt: checkInAt,
      confidence: ctx.recovery.confidence ?? ctx.confidenceBase,
    }),
    soreness: makeSignal(ctx.recovery.sorenessAvg, ctx.hasCheckInToday ? "checkin" : "unknown", {
      observedAt: checkInAt,
      confidence: ctx.recovery.checkInConfidence ?? null,
    }),
    stress: makeSignal(ctx.recovery.stressAvg, ctx.hasCheckInToday ? "checkin" : "unknown", {
      observedAt: checkInAt,
      confidence: ctx.recovery.checkInConfidence ?? null,
    }),
  });
}

function buildFreshness(
  snapshot: DecisionContextSnapshot,
  state: AppState | null | undefined,
  wearableAvailable: boolean,
): DataFreshness {
  let oldest: string | null = null;
  let newest: string | null = null;
  if (state) {
    const dates: string[] = [];
    for (const s of state.sessions ?? []) {
      if (s.date) dates.push(s.date.slice(0, 10));
    }
    for (const d of Object.keys(state.dayCheckIns ?? {})) dates.push(d.slice(0, 10));
    for (const m of state.meals ?? []) {
      if (m.date) dates.push(m.date.slice(0, 10));
    }
    if (dates.length) {
      dates.sort();
      oldest = dates[0] ?? null;
      newest = dates[dates.length - 1] ?? null;
    }
  }
  let overall: DataFreshness["overall"] = "unknown";
  if (snapshot.stale360) overall = "stale";
  else if (newest || snapshot.context.hasCheckInToday) overall = "fresh";
  else if (!state?.profile) overall = "unknown";
  else overall = "stale";

  return Object.freeze({
    overall,
    stale360: snapshot.stale360,
    customer360Version: snapshot.customer360Version,
    oldestObservedAt: oldest,
    newestObservedAt: newest,
    wearableAvailable,
  });
}

function recentOutcomesFromState(
  state: AppState | null | undefined,
  date: string,
): RecentOutcomeEntry[] {
  if (!state) return [];
  const out: RecentOutcomeEntry[] = [];
  const sessions = (state.sessions ?? []).filter((s) => s.date.slice(0, 10) <= date).slice(-5);
  for (const s of sessions) {
    out.push({
      kind: "session_completed",
      value: s.rpe ?? s.durationMin ?? true,
      observedAt: s.date,
      source: "session",
    });
  }
  const feedback = state.livingPlanFeedback?.[date];
  if (feedback) {
    out.push({
      kind: "living_plan_feedback",
      value: feedback.vote,
      observedAt: feedback.at ?? date,
      source: "checkin",
    });
  }
  return out;
}

function deepFreezePc(pc: PerformanceContext): PerformanceContext {
  Object.freeze(pc.identity);
  Object.freeze(pc.profile);
  Object.freeze(pc.goals);
  Object.freeze(pc.observed);
  Object.freeze(pc.derived);
  Object.freeze(pc.signals);
  Object.freeze(pc.training);
  Object.freeze(pc.nutrition);
  Object.freeze(pc.recovery);
  Object.freeze(pc.sleep);
  Object.freeze(pc.behavior);
  Object.freeze(pc.body);
  Object.freeze(pc.wearable);
  Object.freeze(pc.consistency);
  Object.freeze(pc.equipment);
  Object.freeze(pc.availability);
  Object.freeze(pc.constraints);
  Object.freeze(pc.recent_outcomes);
  Object.freeze(pc.recent_decisions);
  Object.freeze(pc.safety);
  Object.freeze(pc.commerce);
  Object.freeze(pc.social);
  Object.freeze(pc.environment);
  Object.freeze(pc.recommendations);
  Object.freeze(pc.decisions);
  Object.freeze(pc.dataFreshness);
  return Object.freeze(pc);
}

/** Map DecisionContextSnapshot → PerformanceContext (no recompute). Frozen. */
export function toPerformanceContext(
  snapshot: DecisionContextSnapshot,
  state?: AppState | null,
): PerformanceContext {
  const ctx = snapshot.context;
  const observed = observedFromContext(ctx);
  if (state) {
    const mealsToday = (state.meals ?? []).filter((m) => m.date.slice(0, 10) === snapshot.date);
    observed.mealsLoggedToday = mealsToday.length;
  }

  const decisions = decisionsFromBundle(snapshot);
  const sleepSource = mapSleepSource(ctx);
  const wearableAvailable = Boolean(ctx.recovery.sourceSummary?.wearable);
  const wearableConf = ctx.recovery.wearableConfidence ?? null;
  const derived = derivedFromContext(ctx);
  const confidence = Math.max(
    0,
    Math.min(1, ctx.recovery.confidence ?? derived.confidenceBase ?? 0.3),
  );

  const pc: PerformanceContext = {
    identity: {
      userId: snapshot.userId,
      timezone: snapshot.timezone,
      date: snapshot.date,
      customer360Version: snapshot.customer360Version,
      stale360: snapshot.stale360,
    },
    profile: {
      goal: ctx.goal,
      equipment: ctx.equipment.profile,
    },
    goals: {
      primary: ctx.goal,
      equipmentProfile: ctx.equipment.profile,
    },
    goal: ctx.goal,
    observed,
    derived,
    signals: buildSignals(ctx, snapshot.date),
    training: ctx.training,
    nutrition: ctx.nutrition,
    recovery: ctx.recovery,
    sleep: {
      hours: ctx.sleep.hours,
      avg7d: ctx.sleep.avg7d,
      source: sleepSource,
    },
    behavior: {
      activePatternKinds: (ctx.activePatterns ?? []).map((p) => p.kind),
      triggers: (snapshot.behavior?.triggers ?? []).map((t) => t.key),
    },
    body: {
      sorenessAvg: ctx.recovery.sorenessAvg,
      stressAvg: ctx.recovery.stressAvg,
    },
    wearable: {
      available: wearableAvailable,
      confidence: wearableConf,
      restingHr: ctx.recovery.wearable?.restingHr ?? null,
      hrv: ctx.recovery.wearable?.hrv ?? null,
    },
    consistency: {
      sessions7d: ctx.training.recentSessions7d,
      adherenceScore: ctx.adherence.adherenceScore,
    },
    equipment: ctx.equipment,
    availability: {
      availableTimeMin: ctx.availableTimeMin,
    },
    constraints: {
      safetyOk: snapshot.safety.ok,
      flags: snapshot.safety.flags,
      blockStims: snapshot.safety.blockStims,
      preferLightTraining: snapshot.safety.preferLightTraining,
      escalateCare: snapshot.safety.escalateCare,
      requireMedicalDisclaimer: snapshot.safety.requireMedicalDisclaimer,
    },
    recent_outcomes: recentOutcomesFromState(state, snapshot.date),
    recent_decisions: decisions,
    safety: snapshot.safety,
    commerce: ctx.commerce,
    social: {
      joinedHubIds: state?.joinedHubIds ?? [],
    },
    environment: {
      travel: ctx.travel,
      timezone: snapshot.timezone,
    },
    timezone: snapshot.timezone,
    recommendations: snapshot.recommendations,
    decisions: snapshot.decisions,
    engineVersion: snapshot.engineVersion,
    contextVersion: snapshot.snapshotVersion,
    generatedAt: new Date().toISOString(),
    dataFreshness: buildFreshness(snapshot, state, wearableAvailable),
    confidence,
    inputFingerprint: snapshot.inputFingerprint,
    source: snapshot.source,
  };

  return deepFreezePc(pc);
}
