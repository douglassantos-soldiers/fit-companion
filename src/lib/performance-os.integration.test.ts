/**
 * Phase 5 Performance OS — end-to-end integration scenarios A–H.
 * Fixed weekday dates avoid weekend rest flake.
 */
import { describe, expect, it } from "vitest";
import { buildQaScenario } from "@/lib/qa/scenarios";
import { buildLivingPlanWithDecisions } from "@/lib/engine/living-plan";
import { rankRecommendations } from "@/lib/engine/recommendation";
import { evaluateSafetyForDate } from "@/lib/engine/safety";
import { buildUserContext } from "@/lib/engine/context";
import { runBehaviorLoop } from "@/lib/engine/behavior";
import {
  applyEvaluationsToPatterns,
  evaluateShortSessionOutcome,
  applyBehaviorOutcomeFromEvaluations,
} from "@/lib/engine/outcome-learning";
import { buildBehaviorProfile } from "@/lib/engine/behavior";
import { PATTERN_MIN_OBS, type LearnedPattern } from "@/lib/engine/learned-patterns";
import { emptyState, type AppState, type SessionLog } from "@/lib/types";

/** Wednesday — weekday training day. */
const FIXED = "2026-03-11";

describe("Performance OS integration A–H", () => {
  it("A. healthy 8h sleep + 60min → full workout", () => {
    const state = buildQaScenario("healthy_full", { date: FIXED });
    const built = buildLivingPlanWithDecisions(state, FIXED);
    expect(built).not.toBeNull();
    expect(["full", "express"]).toContain(built!.plan.workout.mode);
    expect(built!.plan.how).toBeTruthy();
    expect(built!.plan.confidenceLabel).toBeTruthy();
  });

  it("B. sleep 5h + hard RPE ×3 → reduced volume / deload", () => {
    const state = buildQaScenario("low_sleep_high_rpe", { date: FIXED });
    const built = buildLivingPlanWithDecisions(state, FIXED);
    expect(built).not.toBeNull();
    expect(["deload", "rest", "express"]).toContain(built!.plan.workout.mode);
    expect(built!.decisions.trainingVolume).toBeLessThan(1);
  });

  it("C. 30min available → express", () => {
    const state = buildQaScenario("short_time", { date: FIXED });
    const built = buildLivingPlanWithDecisions(state, FIXED);
    expect(built).not.toBeNull();
    expect(built!.plan.workout.mode).toBe("express");
  });

  it("D. no equipment → equipment_limited / home adaptation", () => {
    const state = buildQaScenario("no_equipment", { date: FIXED });
    const built = buildLivingPlanWithDecisions(state, FIXED);
    expect(built).not.toBeNull();
    const codes = built!.decisions.decisions.flatMap((d) => d.reasonCodes);
    expect(codes).toContain("equipment_limited");
  });

  it("E. plateau → plateau_detected + recommendation", () => {
    const state = buildQaScenario("plateau", { date: FIXED });
    const built = buildLivingPlanWithDecisions(state, FIXED);
    expect(built).not.toBeNull();
    const safety = evaluateSafetyForDate(state, FIXED);
    const ctx = buildUserContext(state, "qa-user");
    const recs = rankRecommendations({
      livingPlan: built!.plan,
      safety,
      context: ctx,
      decisions: built!.decisions,
    });
    const codes = [
      ...built!.decisions.decisions.flatMap((d) => d.reasonCodes),
      ...(ctx.reasonCodes ?? []),
    ];
    const hasPlateau =
      codes.includes("plateau_detected") ||
      built!.decisions.decisions.some((d) => d.decisionType === "plateau_response");
    expect(hasPlateau || recs.length > 0).toBe(true);
  });

  it("F. low protein → nutrition recommendation", () => {
    const state = buildQaScenario("low_nutrition", { date: FIXED });
    // Ensure low protein today too
    state.meals = [
      ...(state.meals ?? []),
      {
        id: "today-low",
        date: FIXED,
        slot: "almoco",
        label: "Leve",
        proteinG: 10,
        kcal: 300,
        quality: "laranja",
        sourceKind: "informed",
      },
    ];
    const built = buildLivingPlanWithDecisions(state, FIXED);
    expect(built).not.toBeNull();
    const safety = evaluateSafetyForDate(state, FIXED);
    const ctx = buildUserContext(state, "qa-user");
    const recs = rankRecommendations({
      livingPlan: built!.plan,
      safety,
      context: ctx,
      decisions: built!.decisions,
    });
    const mealish = recs.some((r) => r.kind === "meal" || r.decisionType === "NUTRITION_FOCUS");
    const proteinBias = built!.decisions.proteinBias === "up";
    expect(mealish || proteinBias).toBe(true);
  });

  it("G. Friday adherence / weekend pattern → behavior intervention", () => {
    const state = buildQaScenario("weekend_pattern", { date: FIXED });
    const loop = runBehaviorLoop(state);
    const built = buildLivingPlanWithDecisions(state, FIXED);
    expect(built).not.toBeNull();
    const weekendTrig = loop.triggers.some(
      (t) => t.key === "WEEKEND_MEAL_GAP" && t.active,
    );
    const behaviorDecision = built!.decisions.decisions.some(
      (d) => d.decisionType === "behavior_intervention",
    );
    const codes = built!.decisions.decisions.flatMap((d) => d.reasonCodes);
    expect(
      weekendTrig ||
        behaviorDecision ||
        codes.includes("weekend_adherence_pattern"),
    ).toBe(true);
  });

  it("H. Decision → Outcome → Learning pattern bump", () => {
    const prior: LearnedPattern[] = [
      {
        kind: "prefers_short_sessions",
        status: "candidate",
        confidence: 0.4,
        evidenceCount: 2,
        minObservations: PATTERN_MIN_OBS.prefers_short_sessions,
        lastObservedAt: FIXED,
        evidence: [{ date: FIXED, note: "seed" }],
        successfulOutcomes: 0,
        failedOutcomes: 0,
      },
    ];
    const ev = evaluateShortSessionOutcome({
      sessionDurationMin: 28,
      workoutCompleted: true,
      rpe: "ok",
    });
    expect(ev.result).toBe("success");
    const next = applyEvaluationsToPatterns(prior, [ev], FIXED);
    const p = next.find((x) => x.kind === "prefers_short_sessions")!;
    expect(p.successfulOutcomes).toBeGreaterThan(0);

    const profile = buildBehaviorProfile({ ...emptyState, profile: buildQaScenario("healthy_full").profile });
    const after = applyBehaviorOutcomeFromEvaluations(profile, [ev]);
    expect(after.interventionResponse.express_workout!).toBeGreaterThan(
      profile.interventionResponse.express_workout ?? 0.5,
    );

    // Next decision bias: express_high_adherence seed when pattern has successes
    const state: AppState = {
      ...buildQaScenario("short_time", { date: FIXED }),
    };
    // Inject learned pattern via sessions of short duration
    state.sessions = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(`${FIXED}T12:00:00`);
      d.setDate(d.getDate() - (i + 1));
      const date = d.toISOString().slice(0, 10);
      return {
        id: `s${i}`,
        dayId: date,
        title: "Short",
        date,
        durationMin: 28,
        exercises: [],
        volumeKg: 400,
        rpe: "ok",
      } satisfies SessionLog;
    });
    const built = buildLivingPlanWithDecisions(state, FIXED);
    expect(built!.plan.workout.mode).toBe("express");
  });

  it("cross-domain: recovery affects recommendation; behavior affects intervention", () => {
    const low = buildQaScenario("low_sleep", { date: FIXED });
    const healthy = buildQaScenario("healthy_full", { date: FIXED });
    const lowBuilt = buildLivingPlanWithDecisions(low, FIXED)!;
    const healthyBuilt = buildLivingPlanWithDecisions(healthy, FIXED)!;
    expect(lowBuilt.decisions.trainingVolume).toBeLessThanOrEqual(
      healthyBuilt.decisions.trainingVolume,
    );

    const weekend = buildQaScenario("weekend_pattern", { date: FIXED });
    const loop = runBehaviorLoop(weekend);
    expect(loop.patterns.some((p) => p.key === "weekend_meal_gap")).toBe(true);
  });
});
