import { describe, expect, it } from "vitest";
import { evaluateSafety, notesSuggestEscalation } from "@/lib/engine/safety";
import { rankRecommendations } from "@/lib/engine/recommendation";
import { emptyState, type LivingPlanSnapshot } from "@/lib/types";

function basePlan(overrides: Partial<LivingPlanSnapshot> = {}): LivingPlanSnapshot {
  return {
    date: "2026-09-18",
    generatedAt: new Date().toISOString(),
    score: 70,
    blocker: null,
    traffic: {
      training: "green",
      nutrition: "yellow",
      recovery: "green",
      consistency: "green",
    },
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
    habits: { title: "Consistência", tip: "Faça a versão de 20 minutos." },
    narrative: "Treine hoje.",
    why: ["Plano padrão"],
    whyByChange: [],
    diffFromYesterday: [],
    ...overrides,
  };
}

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
    expect(v.escalateCare).toBe(false);
  });

  it("escalates on serious note keywords without diagnosing", () => {
    expect(notesSuggestEscalation("senti dor no peito depois do treino")).toBe(true);
    const today = new Date().toISOString().slice(0, 10);
    const v = evaluateSafety({
      ...emptyState,
      dayCheckIns: {
        [today]: {
          date: today,
          sleepHours: 7,
          energy: "ok",
          availableMin: 60,
          notes: "falta de ar leve ontem",
        },
      },
      sessions: [],
      profile: null,
    });
    expect(v.escalateCare).toBe(true);
    expect(v.ok).toBe(false);
    expect(v.flags).toContain("escalate_care");
    expect(v.reasons.some((r) => r.includes("profissional"))).toBe(true);
  });

  it("escalates on max soreness — not routine volume adaptation", () => {
    const today = new Date().toISOString().slice(0, 10);
    const v = evaluateSafety({
      ...emptyState,
      dayCheckIns: {
        [today]: {
          date: today,
          sleepHours: 7,
          energy: "ok",
          availableMin: 60,
          soreness: 5,
        },
      },
      sessions: [],
      profile: null,
    });
    expect(v.escalateCare).toBe(true);
    expect(v.flags).toContain("pain_signal");
    expect(v.blockStims).toBe(true);
  });
});

describe("Recommendation Engine", () => {
  it("ranks train or rest from living plan", () => {
    const plan = basePlan();
    const safety = evaluateSafety(emptyState);
    const recs = rankRecommendations({ livingPlan: plan, safety, goal: "massa" });
    expect(recs[0]?.kind).toMatch(/train|rest|meal|sleep|supplement|product|coach/);
    expect(recs.length).toBeGreaterThan(2);
  });

  it("prioritizes escalate care over train", () => {
    const today = new Date().toISOString().slice(0, 10);
    const safety = evaluateSafety({
      ...emptyState,
      dayCheckIns: {
        [today]: {
          date: today,
          sleepHours: 7,
          energy: "ok",
          availableMin: 60,
          notes: "dor no peito",
        },
      },
    });
    const recs = rankRecommendations({
      livingPlan: basePlan({ workout: { ...basePlan().workout, mode: "rest", volumeFactor: 0 } }),
      safety,
      goal: "massa",
    });
    expect(recs[0]?.id).toBe("rec-escalate");
  });
});
