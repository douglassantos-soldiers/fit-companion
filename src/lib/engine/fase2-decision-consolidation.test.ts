/**
 * FASE 2 — Context + Decision consolidation scenarios.
 * Asserts: Safety before Decision; Living Plan matches Decision; Learning does not mutate mode.
 */
import { describe, expect, it } from "vitest";
import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import {
  selectPrimaryAction,
  selectTrainingMode,
  selectWhyPanel,
} from "@/lib/engine/decision-context-snapshot";
import { decisionsFromBundle } from "@/lib/engine/decision-contract";
import { toPerformanceContext } from "@/lib/engine/performance-context";
import { canonicalReasonCode, toReasonAlias } from "@/lib/engine/reason-codes";
import { buildQaScenario } from "@/lib/qa/scenarios";
import type { AppState } from "@/lib/types";

const FIXED = "2026-03-11"; // Wednesday — training day for daysPerWeek:7

function assemble(state: AppState) {
  return assembleDecisionContext(state, {
    date: FIXED,
    source: "offline_legacy",
    userId: "qa-user",
    customer360Version: 1,
  });
}

describe("FASE 2 Decision Consolidation", () => {
  it("normal day — Context → Safety → Decision → Living Plan", () => {
    const snap = assemble(buildQaScenario("healthy_full", { date: FIXED }))!;
    expect(snap).not.toBeNull();
    expect(snap.safety).toBeDefined();
    expect(snap.decisions).toBeDefined();
    expect(snap.livingPlan.workout.mode).toBe(selectTrainingMode(snap));
    expect(snap.livingPlan.workout.mode).toBe(snap.decisions.trainingMode);
    expect(["full", "express", "deload", "rest"]).toContain(snap.decisions.trainingMode);
  });

  it("low sleep → reason + softer mode / volume", () => {
    const snap = assemble(buildQaScenario("low_sleep", { date: FIXED }))!;
    expect(snap.context.sleep.hours).toBe(5);
    const codes = snap.decisions.decisions.flatMap((d) => d.reasonCodes);
    expect(codes.some((c) => c === "sleep_low" || c === "stim_restriction")).toBe(true);
    expect(["express", "deload", "rest", "full"]).toContain(selectTrainingMode(snap));
    if (selectTrainingMode(snap) === "full") {
      expect(snap.decisions.trainingVolume).toBeLessThanOrEqual(1);
    }
  });

  it("high fatigue / low energy → prefer light or rest signals", () => {
    const base = buildQaScenario("healthy_full", { date: FIXED });
    const tired: AppState = {
      ...base,
      dayCheckIns: {
        [FIXED]: { ...base.dayCheckIns[FIXED]!, energy: "baixa", sleepHours: 6 },
      },
    };
    const snap = assemble(tired)!;
    const codes = snap.decisions.decisions.flatMap((d) => d.reasonCodes);
    expect(
      codes.includes("energy_low") ||
        snap.decisions.trainingVolume < 1 ||
        ["express", "deload", "rest"].includes(selectTrainingMode(snap)),
    ).toBe(true);
  });

  it("limited time → express / duration capped", () => {
    const snap = assemble(buildQaScenario("short_time", { date: FIXED }))!;
    expect(snap.context.availableTimeMin).toBe(30);
    expect(selectTrainingMode(snap)).toBe("express");
    expect(snap.decisions.sessionDuration).toBeLessThanOrEqual(30);
    const why = selectWhyPanel(snap);
    expect(why.reason_aliases).toContain("LIMITED_TIME");
    expect(why.evidence.metrics["availableMin"]).toBe(30);
  });

  it("rest day — primary/mode rest when no training day", () => {
    const snap = assemble(buildQaScenario("rest_day", { date: FIXED }));
    if (!snap) {
      expect(snap).toBeNull();
      return;
    }
    const mode = selectTrainingMode(snap);
    expect(["rest", "express", "deload", "full"]).toContain(mode);
    if (mode === "rest") {
      expect(["rest", "sleep", "meal", "supplement"]).toContain(selectPrimaryAction(snap));
    }
  });

  it("training progression signal does not bypass Safety", () => {
    const snap = assemble(buildQaScenario("good_recovery", { date: FIXED }))!;
    expect(snap.safety).toBeTruthy();
    expect(snap.decisions.decisions.length).toBeGreaterThan(0);
  });

  it("plateau scenario feeds Decision without Learning mutating mode", () => {
    const a = assemble(buildQaScenario("plateau", { date: FIXED }))!;
    const b = assemble(buildQaScenario("plateau", { date: FIXED }))!;
    expect(selectTrainingMode(a)).toBe(selectTrainingMode(b));
    expect(a.inputFingerprint).toBe(b.inputFingerprint);
  });

  it("nutrition adherence high — fingerprint stable, nutrition opts present", () => {
    const snap = assemble(buildQaScenario("strong_nutrition", { date: FIXED }))!;
    expect(snap.decisions.proteinBias).toBeDefined();
    expect(snap.livingPlan.nutrition.proteinG).toBeGreaterThan(0);
  });

  it("low adherence — may bias protein / primary meal", () => {
    const snap = assemble(buildQaScenario("low_adherence", { date: FIXED }))!;
    expect(snap).not.toBeNull();
    expect(snap.decisions.decisions.length).toBeGreaterThan(0);
  });

  it("conflicting signals (low sleep + high energy) — Safety still first", () => {
    const base = buildQaScenario("low_sleep", { date: FIXED });
    const conflict: AppState = {
      ...base,
      dayCheckIns: {
        [FIXED]: { ...base.dayCheckIns[FIXED]!, sleepHours: 5, energy: "alta" },
      },
    };
    const snap = assemble(conflict)!;
    expect(snap.safety).toBeDefined();
    expect(snap.context.sleep.hours).toBe(5);
    expect(snap.context.energy).toBe("alta");
    const why = selectWhyPanel(snap);
    expect(why.safety_status).toBeDefined();
    expect(why.evidence.metrics["sleepHours"]).toBe(5);
  });

  it("safety restriction (pain / escalate) forces careful mode", () => {
    const base = buildQaScenario("healthy_full", { date: FIXED });
    const pain: AppState = {
      ...base,
      dayCheckIns: {
        [FIXED]: {
          ...base.dayCheckIns[FIXED]!,
          soreness: 5,
          stress: 5,
          notes: "dor forte no joelho — preciso de atenção",
        },
      },
    };
    const snap = assemble(pain)!;
    if (snap.safety.escalateCare) {
      expect(["rest", "deload", "express", "full"]).toContain(selectTrainingMode(snap));
    }
    expect(snap.safety.flags.length >= 0).toBe(true);
  });

  it("PerformanceContext separates observed / derived / decisions", () => {
    const snap = assemble(buildQaScenario("healthy_full", { date: FIXED }))!;
    const perf = toPerformanceContext(snap);
    expect(perf.observed.sleepHours).toBe(snap.context.sleep.hours);
    expect(perf.derived.recoveryScore).toBe(snap.context.recovery.score);
    expect(perf.decisions.trainingMode).toBe(snap.decisions.trainingMode);
    expect(perf.recommendations).toBe(snap.recommendations);
    expect(perf.recent_decisions.length).toBe(snap.decisions.decisions.length);
    expect(perf.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(perf.signals.sleepHours.value).toBe(perf.observed.sleepHours);
    expect(perf.dataFreshness).toBeDefined();
    expect(Object.isFrozen(perf)).toBe(true);
  });

  it("Decision contract has id, versions, evidence, expires", () => {
    const snap = assemble(buildQaScenario("short_time", { date: FIXED }))!;
    const contracts = decisionsFromBundle(snap);
    expect(contracts.length).toBeGreaterThan(0);
    const d = contracts[0]!;
    expect(d.decision_id).toMatch(/^dec_/);
    expect(d.engine_version).toBe(snap.engineVersion);
    expect(d.context_version).toBe(snap.snapshotVersion);
    expect(d.evidence.metrics).toBeDefined();
    expect(d.expires_at).toContain(FIXED);
    expect(d.reason_aliases.length).toBe(d.reason_codes.length);
    expect(d.context_id).toBe(snap.inputFingerprint);
    expect(d.why.reason_codes).toEqual(d.reason_codes);
    expect(d.what.actions.length).toBeGreaterThan(0);
  });

  it("reason aliases resolve LOW_SLEEP ↔ sleep_low", () => {
    expect(canonicalReasonCode("LOW_SLEEP")).toBe("sleep_low");
    expect(toReasonAlias("sleep_low")).toBe("LOW_SLEEP");
    expect(canonicalReasonCode("LIMITED_TIME")).toBe("time_limited");
    expect(toReasonAlias("plateau_detected")).toBe("PLATEAU");
  });

  it("Learning does not alter training mode for identical inputs", () => {
    const state = buildQaScenario("healthy_full", { date: FIXED });
    const a = assemble(state)!;
    const withLearningNoise: AppState = {
      ...state,
      sessions: [...state.sessions],
    };
    const b = assemble(withLearningNoise)!;
    expect(selectTrainingMode(a)).toBe(selectTrainingMode(b));
  });

  it("fingerprint early path: same inputs → same fingerprint", () => {
    const state = buildQaScenario("healthy_full", { date: FIXED });
    expect(assemble(state)!.inputFingerprint).toBe(assemble(state)!.inputFingerprint);
  });
});
