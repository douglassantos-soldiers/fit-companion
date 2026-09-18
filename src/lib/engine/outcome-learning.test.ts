/**
 * FASE 5 Outcome learning loop tests.
 */
import { describe, expect, it } from "vitest";
import {
  applyEvaluationsToPatterns,
  evaluateShortSessionOutcome,
  evaluateVolumeReductionOutcome,
} from "@/lib/engine/outcome-learning";
import { PATTERN_MIN_OBS, type LearnedPattern } from "@/lib/engine/learned-patterns";
import { todayKey } from "@/lib/types";

describe("Outcome learning", () => {
  it("volume reduction + completed + RPE ok + energy D+1 → success", () => {
    const ev = evaluateVolumeReductionOutcome({
      volumeFactor: 0.7,
      workoutCompleted: true,
      rpe: "ok",
      nextDayEnergy: "alta",
    });
    expect(ev.result).toBe("success");
    expect(ev.kind).toBe("volume_reduction_helps");
  });

  it("volume reduction + RPE difícil + energy baixa → fail", () => {
    const ev = evaluateVolumeReductionOutcome({
      volumeFactor: 0.7,
      workoutCompleted: true,
      rpe: "dificil",
      nextDayEnergy: "baixa",
    });
    expect(ev.result).toBe("fail");
  });

  it("awaits D+1 when nextDayEnergy missing → inconclusive", () => {
    const ev = evaluateVolumeReductionOutcome({
      volumeFactor: 0.7,
      workoutCompleted: true,
      rpe: "ok",
      nextDayEnergy: null,
    });
    expect(ev.result).toBe("inconclusive");
  });

  it("short session completed with ok RPE → success", () => {
    const ev = evaluateShortSessionOutcome({
      sessionDurationMin: 30,
      workoutCompleted: true,
      rpe: "facil",
    });
    expect(ev.result).toBe("success");
    expect(ev.kind).toBe("prefers_short_sessions");
  });

  it("applyEvaluationsToPatterns increments successfulOutcomes", () => {
    const prior: LearnedPattern[] = [
      {
        kind: "volume_reduction_helps",
        status: "candidate",
        confidence: 0.4,
        evidenceCount: 1,
        minObservations: PATTERN_MIN_OBS.volume_reduction_helps,
        lastObservedAt: todayKey(),
        evidence: [{ date: todayKey(), note: "seed" }],
        successfulOutcomes: 0,
        failedOutcomes: 0,
      },
    ];
    const next = applyEvaluationsToPatterns(
      prior,
      [
        {
          kind: "volume_reduction_helps",
          result: "success",
          note: "Volume 70% + energia alta D+1",
        },
      ],
      todayKey(),
    );
    const p = next.find((x) => x.kind === "volume_reduction_helps")!;
    expect(p.successfulOutcomes).toBe(1);
    expect(p.evidenceCount).toBeGreaterThanOrEqual(2);
  });

  it("inconclusive evaluations do not mutate patterns", () => {
    const prior: LearnedPattern[] = [];
    const next = applyEvaluationsToPatterns(
      prior,
      [
        {
          kind: "volume_reduction_helps",
          result: "inconclusive",
          note: "aguardando",
        },
      ],
      todayKey(),
    );
    expect(next).toEqual([]);
  });
});
