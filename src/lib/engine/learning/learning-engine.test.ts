/**
 * Learning Engine — Decision → Outcome → Signal scenarios.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LEARNING_CONTRACT_VERSION,
  LEARNING_ENGINE_VERSION,
  runLearningCycle,
  toLearningDecisionRef,
  type LearningDecisionRef,
  type LearningOutcome,
  type LearningSignalRecord,
} from "@/lib/engine/learning";

const emptyEvidence = { metrics: {} };

function decision(partial?: Partial<LearningDecisionRef>): LearningDecisionRef {
  return {
    decisionId: "dec_volume_1",
    userId: "user_1",
    contextId: "ctx_1",
    decisionType: "training_volume",
    engineVersion: "decision_v1",
    reasonCodes: ["recovery_low"],
    evidence: emptyEvidence,
    confidence: 0.8,
    safetyStatus: {
      escalateCare: false,
      blockStims: false,
      preferLightTraining: false,
      flags: [],
    },
    createdAt: "2026-09-24T12:00:00.000Z",
    ...partial,
  };
}

function outcome(partial?: Partial<LearningOutcome>): LearningOutcome {
  return {
    decisionId: "dec_volume_1",
    action: "reduce_accessory_volume",
    adherence: 0.92,
    result: "positive",
    measuredValue: "recovery_positive_d1",
    expectedValue: "REDUCE_FATIGUE",
    quality: "success",
    createdAt: "2026-09-25T08:00:00.000Z",
    outcomeId: "out_1",
    userId: "user_1",
    ...partial,
  };
}

describe("Learning Engine runLearningCycle", () => {
  it("positive outcome → learned + volume_reduction_helps narrative", () => {
    const res = runLearningCycle({
      decision: decision(),
      outcome: outcome(),
      recoveryContext: { recoveryLevel: "moderate" },
    });
    expect(res.status).toBe("learned");
    expect(res.engineVersion).toBe(LEARNING_ENGINE_VERSION);
    expect(res.events[0]?.kind).toMatch(/pattern_detected|attribution_recorded/);
    expect(res.signals).toHaveLength(1);
    const sig = res.signals[0]!;
    expect(sig.signal).toBe("volume_reduction_helps");
    expect(sig.narrative).toMatch(/volume acessório/i);
    expect(sig.narrative).toMatch(/recuperação moderada/i);
    expect(sig.confidence).toBeGreaterThan(0.4);
    expect(sig.blockedByGuardrail).toBe(false);
    expect(res.events[0]?.engine_version).toBe(LEARNING_ENGINE_VERSION);
    expect(res.events[0]?.contract_version).toBe(LEARNING_CONTRACT_VERSION);
  });

  it("negative outcome → pattern_weakened", () => {
    const res = runLearningCycle({
      decision: decision(),
      outcome: outcome({
        result: "negative",
        quality: "fail",
        adherence: 0.9,
        measuredValue: "recovery_still_low",
      }),
      recoveryContext: { recoveryLevel: "moderate" },
    });
    expect(res.status).toBe("learned");
    expect(res.events[0]?.kind).toBe("pattern_weakened");
    expect(res.signals[0]?.narrative).toMatch(/não melhorou/i);
  });

  it("partial adherence attenuates confidence", () => {
    const full = runLearningCycle({
      decision: decision(),
      outcome: outcome({ adherence: 0.95 }),
    });
    const partial = runLearningCycle({
      decision: decision(),
      outcome: outcome({
        adherence: 0.7,
        result: "mixed",
        quality: "mixed",
      }),
    });
    expect(partial.status).toBe("learned");
    expect(partial.signals[0]!.confidence).toBeLessThan(full.signals[0]!.confidence);
  });

  it("missing outcome → insufficient_outcome without promoted signal", () => {
    const res = runLearningCycle({
      decision: decision(),
      outcome: null,
    });
    expect(res.status).toBe("insufficient_outcome");
    expect(res.signals).toHaveLength(0);
    expect(res.events[0]?.evidence["status"]).toBe("insufficient_outcome");
  });

  it("pending quality also treated as missing", () => {
    const res = runLearningCycle({
      decision: decision(),
      outcome: outcome({ result: "missing", quality: "pending", adherence: null }),
    });
    expect(res.status).toBe("insufficient_outcome");
    expect(res.signals).toHaveLength(0);
  });

  it("conflicting outcomes → conflict + low confidence", () => {
    const res = runLearningCycle({
      decision: decision(),
      outcome: outcome({ result: "positive", quality: "success" }),
      siblingOutcomes: [
        outcome({
          outcomeId: "out_neg",
          result: "negative",
          quality: "fail",
          createdAt: "2026-09-25T10:00:00.000Z",
        }),
      ],
    });
    expect(res.status).toBe("conflict");
    expect(res.events[0]?.kind).toBe("pattern_weakened");
    expect(res.signals[0]!.confidence).toBeLessThanOrEqual(0.35);
  });

  it("repeated decision with consistent priors → pattern_reinforced", () => {
    const prior: LearningSignalRecord = {
      signalId: "ls_prior",
      signal: "volume_reduction_helps",
      narrative: "prior",
      decisionId: "dec_volume_1",
      confidence: 0.7,
      engineVersion: LEARNING_ENGINE_VERSION,
      createdAt: "2026-09-20T12:00:00.000Z",
      blockedByGuardrail: false,
    };
    const res = runLearningCycle({
      decision: decision(),
      outcome: outcome(),
      priorSignals: [prior],
      recoveryContext: { recoveryLevel: "moderate" },
    });
    expect(res.status).toBe("learned");
    expect(res.events[0]?.kind).toBe("pattern_reinforced");
    expect(res.signals[0]!.confidence).toBeGreaterThan(0.5);
  });

  it("learning signal example: REDUCE load + adherence + recovery", () => {
    const res = runLearningCycle({
      decision: decision({
        decisionType: "REDUCE_TRAINING_LOAD",
        decisionId: "dec_reduce_load",
      }),
      outcome: outcome({
        decisionId: "dec_reduce_load",
        action: "reduce_accessory_volume",
        adherence: 0.92,
        result: "positive",
        measuredValue: "positive_recovery_next_day",
      }),
      recoveryContext: { recoveryLevel: "moderate" },
    });
    expect(res.signals[0]?.signal).toBe("volume_reduction_helps");
    expect(res.signals[0]?.narrative).toMatch(/adesão 92%/i);
  });

  it("regression: guardrail blocks volume-increase bias under preferLightTraining", () => {
    const res = runLearningCycle({
      decision: decision({
        safetyStatus: {
          escalateCare: false,
          blockStims: false,
          preferLightTraining: true,
          flags: ["prefer_light"],
        },
      }),
      outcome: outcome({
        result: "negative",
        quality: "fail",
        action: "reduce_accessory_volume",
      }),
      recoveryContext: { recoveryLevel: "low" },
    });
    expect(res.status).toBe("blocked");
    expect(res.events[0]?.kind).toBe("bias_blocked");
    expect(res.signals[0]?.blockedByGuardrail).toBe(true);
  });

  it("regression: learning module source does not import computeDecisions / thresholds / living plan apply", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const files = [
      "run-learning.ts",
      "events.ts",
      "signals.ts",
      "outcome.ts",
      "decision-ref.ts",
      "version.ts",
    ];
    const banned =
      /computeDecisions|decision-thresholds|living-plan-materialize|applyLivingPlan|adminDb/;
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src, f).not.toMatch(banned);
    }
  });

  it("toLearningDecisionRef maps DecisionView fields", () => {
    const ref = toLearningDecisionRef({
      decisionId: "d1",
      userId: "u1",
      contextId: "c1",
      decisionType: "training_volume",
      decisionVersion: 1,
      engineVersion: "decision_v1",
      reasonCodes: ["recovery_low"],
      reasonAliases: ["LOW_RECOVERY"],
      evidence: emptyEvidence,
      confidence: 0.7,
      safetyStatus: {
        escalateCare: false,
        blockStims: false,
        preferLightTraining: false,
        flags: [],
      },
      createdAt: "2026-09-24T12:00:00.000Z",
      why: { reasonCodes: ["recovery_low"], reasonAliases: ["LOW_RECOVERY"] },
      what: { actions: [], decisionValue: 0.7 },
      expectedOutcome: { kind: "REDUCE_FATIGUE" },
    });
    expect(ref.decisionId).toBe("d1");
    expect(ref.decisionType).toBe("training_volume");
    expect(ref.engineVersion).toBe("decision_v1");
  });
});
