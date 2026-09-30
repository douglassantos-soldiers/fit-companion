import { describe, expect, it } from "vitest";
import {
  goalProgressCard,
  resolveProgressNextAction,
  weightDeltaRecent,
} from "./next-action";

describe("resolveProgressNextAction", () => {
  it("prioritizes meal / nutricao blocker", () => {
    const a = resolveProgressNextAction({
      blocker: { key: "nutricao", label: "Nutrição", score: 32 },
      livingPrimary: "train",
      score: 55,
    });
    expect(a.to).toBe("/nutricao");
    expect(a.ctaLabel).toMatch(/Nutrição/i);
  });

  it("routes sleep primary to home check-in", () => {
    const a = resolveProgressNextAction({
      blocker: null,
      livingPrimary: "sleep",
      score: 60,
      coachLine: "Durma 8h",
    });
    expect(a.to).toBe("/");
    expect(a.title).toMatch(/sono/i);
  });

  it("suggests corpo on ritual day without photos", () => {
    const a = resolveProgressNextAction({
      blocker: { key: "forca", label: "Treinamento", score: 70 },
      livingPrimary: "train",
      score: 70,
      isRitualDay: true,
      hasBodyPhotos: false,
    });
    expect(a.to).toBe("/progresso/corpo");
  });

  it("defaults to train when score is low", () => {
    const a = resolveProgressNextAction({
      blocker: { key: "consistencia", label: "Consistência", score: 20 },
      score: 30,
    });
    expect(a.to).toBe("/treino");
  });
});

describe("goalProgressCard", () => {
  it("narrates weight trend for massa", () => {
    const card = goalProgressCard({
      goal: "massa",
      weightDelta7d: 0.8,
      strengthDelta28d: null,
      prCountWeek: 0,
      proteinHitDays7d: 3,
      sleepAvg7d: null,
    });
    expect(card.line).toContain("+0.8");
  });

  it("narrates performance with strength + PRs", () => {
    const card = goalProgressCard({
      goal: "performance",
      weightDelta7d: null,
      strengthDelta28d: 4,
      prCountWeek: 2,
      proteinHitDays7d: 5,
      sleepAvg7d: 7,
    });
    expect(card.line).toContain("Strength");
    expect(card.line).toContain("PR");
  });
});

describe("weightDeltaRecent", () => {
  it("returns null with fewer than 2 weights", () => {
    expect(weightDeltaRecent([{ date: "2026-09-01", weightKg: 80 }])).toBeNull();
  });

  it("computes delta across window", () => {
    const delta = weightDeltaRecent(
      [
        { date: "2026-09-01", weightKg: 80 },
        { date: "2026-09-10", weightKg: 81.5 },
      ],
      14,
    );
    expect(delta).toBe(1.5);
  });
});
