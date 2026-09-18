import { describe, expect, it } from "vitest";
import { evaluateSafety } from "@/lib/engine/safety";
import { rankRecommendations } from "@/lib/engine/recommendation";
import { emptyState, type LivingPlanSnapshot } from "@/lib/types";

describe("Safety Engine", () => {
  it("blocks stims on low sleep", () => {
    const today = new Date().toISOString().slice(0, 10);
    const v = evaluateSafety({
      ...emptyState,
      dayCheckIns: {
        [today]: { date: today, sleepHours: 4.5, energy: "baixa", availableMin: 60 },
      },
      sessions: [],
      profile: null,
    });
    expect(v.blockStims).toBe(true);
    expect(v.preferLightTraining).toBe(true);
  });
});

describe("Recommendation Engine", () => {
  it("ranks train or rest from living plan", () => {
    const plan: LivingPlanSnapshot = {
      date: "2026-09-18",
      generatedAt: new Date().toISOString(),
      score: 70,
      blocker: null,
      traffic: { training: "green", nutrition: "yellow", recovery: "green" },
      workout: {
        mode: "full",
        title: "Push",
        estimatedMin: 50,
        dayId: "d1",
        volumeFactor: 1,
      },
      nutrition: { proteinG: 160, kcal: 2400, waterMl: 3000, skipBreakfast: false },
      supplements: [{ id: "creatina", name: "Creatina", timing: "Diário" }],
      sleepTargetHours: 8,
      narrative: "Treine hoje.",
      why: ["Plano padrão"],
      diffFromYesterday: [],
    };
    const safety = evaluateSafety(emptyState);
    const recs = rankRecommendations({ livingPlan: plan, safety, goal: "massa" });
    expect(recs[0]?.kind).toMatch(/train|rest|meal|sleep|supplement|product|coach/);
    expect(recs.length).toBeGreaterThan(2);
  });
});
