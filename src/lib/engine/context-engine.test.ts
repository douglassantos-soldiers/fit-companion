/**
 * Context Engine — PerformanceContext assembly, provenance, partials, freeze.
 */
import { describe, expect, it } from "vitest";
import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import {
  getBehaviorContext,
  getNutritionContext,
  getPerformanceContextFromSnapshot,
  getRecoveryContext,
  getTrainingContext,
} from "@/lib/engine/context-engine";
import { toPerformanceContext } from "@/lib/engine/performance-context";
import { buildQaScenario } from "@/lib/qa/scenarios";
import { emptyState, type AppState, type Profile } from "@/lib/types";

const FIXED = "2026-03-11";

function assemble(state: AppState, opts?: { timezone?: string; userId?: string }) {
  return assembleDecisionContext(state, {
    date: FIXED,
    source: "offline_legacy",
    userId: opts?.userId ?? "qa-user-aaaaaaaa",
    customer360Version: 1,
    ...(opts?.timezone ? { timezone: opts.timezone } : {}),
  });
}

function minimalProfile(over: Partial<Profile> = {}): Profile {
  return {
    name: "Novo",
    goal: "saude",
    level: "iniciante",
    daysPerWeek: 3,
    age: 30,
    heightCm: 175,
    weightKg: 75,
    equipment: "casa",
    restrictions: [],
    createdAt: new Date().toISOString(),
    typicalSleepHours: 7,
    timezone: "America/Sao_Paulo",
    ...over,
  };
}

describe("Context Engine — PerformanceContext", () => {
  it("new user / empty history: low confidence, unknown freshness, nulls ok", () => {
    const state: AppState = {
      ...emptyState,
      profile: minimalProfile(),
      userId: "user-new-aaaaaaaa",
      sessions: [],
      meals: [],
      dayCheckIns: {},
    };
    const snap = assemble(state)!;
    const pc = getPerformanceContextFromSnapshot(snap, state);
    expect(pc.identity.userId).toBe("qa-user-aaaaaaaa");
    expect(pc.observed.hasCheckInToday).toBe(false);
    expect(pc.observed.sessions7d).toBe(0);
    expect(pc.confidence).toBeLessThan(0.7);
    expect(["unknown", "stale", "fresh"]).toContain(pc.dataFreshness.overall);
    expect(pc.wearable.available).toBe(false);
    expect(pc.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof pc.contextVersion).toBe("number");
    expect(pc.inputFingerprint.length).toBeGreaterThan(8);
  });

  it("user with history: observed sleep vs derived recoveryScore separated", () => {
    const state = buildQaScenario("healthy_full", { date: FIXED });
    const snap = assemble(state)!;
    const pc = toPerformanceContext(snap, state);
    expect(pc.observed.sleepHours).toBe(snap.context.sleep.hours);
    expect(pc.derived.recoveryScore).toBe(snap.context.recovery.score);
    expect(pc.signals.sleepHours.value).toBe(pc.observed.sleepHours);
    expect(pc.signals.recoveryScore.source).toBe("derived");
    expect(pc.decisions.trainingMode).toBe(snap.decisions.trainingMode);
    expect(pc.recommendations).toBeDefined();
    expect(pc.constraints).toBeDefined();
    expect(pc.goals.primary).toBe(pc.goal);
  });

  it("timezone flows to identity and environment", () => {
    const state = buildQaScenario("healthy_full", { date: FIXED });
    state.profile = { ...state.profile!, timezone: "America/New_York" };
    const snap = assemble(state, { timezone: "America/New_York" })!;
    const pc = toPerformanceContext(snap, state);
    expect(pc.timezone).toBe(snap.timezone);
    expect(pc.identity.timezone).toBe(snap.timezone);
    expect(pc.environment.timezone).toBe(snap.timezone);
  });

  it("incomplete data: partial check-in still builds PC with reduced signal confidence", () => {
    const state = buildQaScenario("nutrition_incomplete", { date: FIXED });
    const snap = assemble(state)!;
    const pc = toPerformanceContext(snap, state);
    expect(pc).toBeDefined();
    expect(pc.inputFingerprint.length).toBeGreaterThan(8);
    expect(pc.confidence).toBeGreaterThan(0);
    expect(pc.confidence).toBeLessThanOrEqual(1);
  });

  it("conflicting sleep priority: check-in wins over profile typical", () => {
    const state = buildQaScenario("low_sleep", { date: FIXED });
    state.profile = { ...state.profile!, typicalSleepHours: 8 };
    const snap = assemble(state)!;
    const pc = toPerformanceContext(snap, state);
    expect(pc.observed.sleepHours).toBe(5);
    expect(pc.signals.sleepHours.source).toBe("checkin");
    expect(pc.sleep.source).toBe("checkin");
  });

  it("wearable unavailable: wearable.available false and sleep source is not wearable", () => {
    const state = buildQaScenario("healthy_full", { date: FIXED });
    state.wearableConnections = [];
    const snap = assemble(state)!;
    const pc = toPerformanceContext(snap, state);
    expect(pc.wearable.available).toBe(false);
    expect(pc.signals.sleepHours.source).not.toBe("wearable");
    expect(pc.dataFreshness.wearableAvailable).toBe(false);
  });

  it("multi-device: context identity is userId, not device channel", () => {
    const state = buildQaScenario("healthy_full", { date: FIXED });
    state.userId = "user-canonical-aaa";
    const snapA = assemble(state, { userId: "user-canonical-aaa" })!;
    const snapB = assemble({ ...state, deviceId: "device-bbbbbbbb" } as AppState, {
      userId: "user-canonical-aaa",
    })!;
    const pcA = toPerformanceContext(snapA, state);
    const pcB = toPerformanceContext(snapB, state);
    expect(pcA.identity.userId).toBe("user-canonical-aaa");
    expect(pcB.identity.userId).toBe("user-canonical-aaa");
    expect(pcA.inputFingerprint).toBe(pcB.inputFingerprint);
  });

  it("freeze: PerformanceContext is immutable (LLM must not mutate)", () => {
    const snap = assemble(buildQaScenario("healthy_full", { date: FIXED }))!;
    const pc = toPerformanceContext(snap);
    expect(Object.isFrozen(pc)).toBe(true);
    expect(Object.isFrozen(pc.observed)).toBe(true);
    expect(Object.isFrozen(pc.signals)).toBe(true);
    expect(() => {
      (pc as { confidence: number }).confidence = 0;
    }).toThrow();
    expect(() => {
      (pc.observed as { sleepHours: number | null }).sleepHours = 99;
    }).toThrow();
  });

  it("partial getters: training/nutrition/recovery/behavior without decisions authority", () => {
    const state = buildQaScenario("healthy_full", { date: FIXED });
    const snap = assemble(state)!;
    const pc = toPerformanceContext(snap, state);
    const training = getTrainingContext(pc);
    const nutrition = getNutritionContext(pc);
    const recovery = getRecoveryContext(pc);
    const behavior = getBehaviorContext(pc);
    expect(training.domain).toBe("training");
    expect(nutrition.domain).toBe("nutrition");
    expect(recovery.domain).toBe("recovery");
    expect(behavior.domain).toBe("behavior");
    expect("decisions" in training).toBe(false);
    expect(recovery.signals.sleepHours.source).toBe(pc.signals.sleepHours.source);
    expect(recovery.constraints.safetyOk).toBe(pc.constraints.safetyOk);
  });

  it("reproducibility: same state → same fingerprint and contextVersion path", () => {
    const state = buildQaScenario("healthy_full", { date: FIXED });
    const a = assemble(state)!;
    const b = assemble(state)!;
    expect(a.inputFingerprint).toBe(b.inputFingerprint);
    const pcA = toPerformanceContext(a, state);
    const pcB = toPerformanceContext(b, state);
    expect(pcA.inputFingerprint).toBe(pcB.inputFingerprint);
    expect(pcA.contextVersion).toBe(pcB.contextVersion);
    expect(pcA.observed.sleepHours).toBe(pcB.observed.sleepHours);
    expect(pcA.derived.recoveryScore).toBe(pcB.derived.recoveryScore);
  });

  it("categories stay separated: recommendations ≠ decisions", () => {
    const snap = assemble(buildQaScenario("healthy_full", { date: FIXED }))!;
    const pc = toPerformanceContext(snap);
    expect(pc.decisions).toBe(snap.decisions);
    expect(pc.recommendations).toBe(snap.recommendations);
    expect(pc.observed).not.toHaveProperty("trainingMode");
    expect(pc.derived).not.toHaveProperty("trainingMode");
  });

  it("user without profile: assemble returns null (no parallel context invented)", () => {
    const state: AppState = { ...emptyState, profile: null, userId: "user-noprofile-aa" };
    expect(assemble(state)).toBeNull();
  });

  it("all required areas exist; recent_outcomes from sessions when state passed", () => {
    const state = buildQaScenario("healthy_full", { date: FIXED });
    const snap = assemble(state)!;
    const pc = toPerformanceContext(snap, state);
    for (const key of [
      "identity",
      "profile",
      "goals",
      "training",
      "nutrition",
      "recovery",
      "sleep",
      "behavior",
      "body",
      "wearable",
      "commerce",
      "environment",
      "social",
      "constraints",
      "recent_decisions",
      "recent_outcomes",
      "observed",
      "derived",
      "recommendations",
      "decisions",
    ] as const) {
      expect(pc[key]).toBeDefined();
    }
    expect(pc.recent_decisions.length).toBe(snap.decisions.decisions.length);
    if ((state.sessions?.length ?? 0) > 0) {
      expect(pc.recent_outcomes.some((o) => o.kind === "session_completed")).toBe(true);
    }
    expect(Array.isArray(pc.social.joinedHubIds)).toBe(true);
    expect(pc.dataFreshness.wearableAvailable).toBe(pc.wearable.available);
  });
});
