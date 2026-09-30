import { describe, expect, it } from "vitest";
import type { MuscleRecoverySnapshot } from "@/lib/engine/recovery";
import {
  bestStimulusDayId,
  isMuscleRecoveryEmpty,
  muscleRecoveryTeaser,
  recoveryActionHint,
  trainNowLabel,
} from "@/lib/training/recovery-ui";

function snap(
  partial: Partial<MuscleRecoverySnapshot> & Pick<MuscleRecoverySnapshot, "muscle" | "label">,
): MuscleRecoverySnapshot {
  return {
    freshness: 100,
    load7d: 0,
    load28d: 0,
    estimatedRecovery: 100,
    recoveryEstimate: 100,
    directLoad7d: 0,
    directLoad28d: 0,
    effectiveLoad: 0,
    fatigueContribution: 0,
    status: "unknown",
    confidence: 0.4,
    reasonCodes: ["undertrained_muscle"],
    lastTrainedHours: null,
    ...partial,
  };
}

describe("recovery-ui", () => {
  it("detects empty load map", () => {
    const snaps = [
      snap({ muscle: "peito", label: "Peito" }),
      snap({ muscle: "pernas", label: "Pernas" }),
      snap({ muscle: "cardio", label: "Cardio", status: "unknown" }),
    ];
    expect(isMuscleRecoveryEmpty(snaps)).toBe(true);
    expect(recoveryActionHint(snaps, null).empty).toBe(true);
    expect(muscleRecoveryTeaser(snaps)).toMatch(/sem carga/i);
  });

  it("suggests express when today groups are fatigued", () => {
    const snaps = [
      snap({
        muscle: "peito",
        label: "Peito",
        status: "fatigued",
        freshness: 20,
        load7d: 12,
        reasonCodes: ["recent_training"],
      }),
      snap({
        muscle: "ombros",
        label: "Ombros",
        status: "fatigued",
        freshness: 25,
        load7d: 10,
        reasonCodes: ["recent_training"],
      }),
      snap({
        muscle: "triceps",
        label: "Tríceps",
        status: "ok",
        freshness: 50,
        load7d: 6,
        reasonCodes: [],
      }),
      snap({ muscle: "costas", label: "Costas", status: "fresh", freshness: 90, load7d: 4 }),
      snap({ muscle: "biceps", label: "Bíceps", status: "fresh", freshness: 85, load7d: 3 }),
      snap({ muscle: "pernas", label: "Pernas", status: "fresh", freshness: 80, load7d: 5 }),
      snap({ muscle: "core", label: "Core", status: "ok", freshness: 60, load7d: 4 }),
    ];
    const hint = recoveryActionHint(
      snaps,
      {
        id: "day-1",
        title: "Empurrar",
        exercises: [],
        groups: ["peito", "ombros", "triceps"],
      },
      { express: false },
    );
    expect(hint.empty).toBe(false);
    expect(hint.preferExpress).toBe(true);
    expect(hint.ctaLabel).toMatch(/leve|Express/i);
  });

  it("picks best stimulus by recoveryScore when no catalog groups", () => {
    const id = bestStimulusDayId(
      [
        { id: "a", title: "A", exercises: [], recoveryScore: 40 },
        { id: "b", title: "B", exercises: [], recoveryScore: 80 },
      ],
      [],
    );
    expect(id).toBe("b");
  });

  it("labels train now by mode", () => {
    expect(trainNowLabel({ express: true })).toBe("Começar Express");
    expect(trainNowLabel({ express: false, recoveryScore: 20 })).toBe("Treinar leve");
    expect(trainNowLabel({ express: false, trainingMode: "rest" })).toBe("Ver plano de hoje");
    expect(trainNowLabel({ express: false })).toBe("Treinar agora");
  });
});
