/**
 * Learning applies only to valid attributed outcomes.
 */
import { describe, expect, it } from "vitest";
import {
  applyAttributedEvaluationsToPatterns,
  applyEvaluationsToPatterns,
  evaluateShortSessionOutcome,
} from "@/lib/engine/outcome-learning";
import { PATTERN_MIN_OBS, type LearnedPattern } from "@/lib/engine/learned-patterns";
import { shouldLearnFromAttribution } from "@/lib/engine/attribution";

const DATE = "2026-03-11";

function emptyPrefersShort(): LearnedPattern {
  return {
    kind: "prefers_short_sessions",
    status: "candidate",
    confidence: 0.35,
    evidenceCount: 0,
    minObservations: PATTERN_MIN_OBS.prefers_short_sessions,
    lastObservedAt: DATE,
    evidence: [],
    successfulOutcomes: 0,
    failedOutcomes: 0,
  };
}

describe("attribution learning gate", () => {
  it("unknown e weak não incrementam successfulOutcomes", () => {
    const ev = evaluateShortSessionOutcome({
      sessionDurationMin: 30,
      workoutCompleted: true,
      rpe: "ok",
    });
    expect(ev.result).toBe("success");
    const next = applyAttributedEvaluationsToPatterns(
      [emptyPrefersShort()],
      [
        {
          evaluation: ev,
          attributionType: "unknown",
          attributionConfidence: 0.9,
          outcomeQuality: "success",
        },
        {
          evaluation: ev,
          attributionType: "weak",
          attributionConfidence: 0.4,
          outcomeQuality: "unknown",
        },
      ],
      DATE,
    );
    expect(next[0]?.successfulOutcomes).toBe(0);
    expect(
      shouldLearnFromAttribution({
        attributionType: "weak",
        attributionConfidence: 0.4,
        outcomeQuality: "unknown",
      }),
    ).toBe(false);
  });

  it("6+ success diretos preferem Express (prefers_short_sessions / express_training_high_adherence)", () => {
    const ev = evaluateShortSessionOutcome({
      sessionDurationMin: 28,
      workoutCompleted: true,
      rpe: "facil",
    });
    let patterns: LearnedPattern[] = [emptyPrefersShort()];
    for (let i = 0; i < 6; i += 1) {
      patterns = applyAttributedEvaluationsToPatterns(
        patterns,
        [
          {
            evaluation: ev,
            attributionType: "direct",
            attributionConfidence: 0.9,
            outcomeQuality: "success",
          },
        ],
        DATE,
      );
    }
    const p = patterns.find((x) => x.kind === "prefers_short_sessions")!;
    expect(p.successfulOutcomes).toBe(6);
    expect(p.evidenceCount).toBeGreaterThanOrEqual(6);
    expect(p.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("evaluateShortSessionOutcome permanece inalterado (gate só na aplicação)", () => {
    const ev = evaluateShortSessionOutcome({
      sessionDurationMin: 50,
      workoutCompleted: true,
      rpe: "ok",
    });
    expect(ev.result).toBe("inconclusive");
    const viaLegacy = applyEvaluationsToPatterns([], [ev], DATE);
    expect(viaLegacy).toEqual([]);
  });
});
