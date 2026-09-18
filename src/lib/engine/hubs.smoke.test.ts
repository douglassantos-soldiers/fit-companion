/**
 * Creator Hubs MVP smoke tests.
 * Run: npm test
 */
import { describe, expect, it } from "vitest";
import { HUBS, activeHubForState, hubBySlug } from "@/data/hubs";
import { challengeById, isRelativeChallenge } from "@/data/challenges";
import { challengeProgress } from "@/lib/social";
import { buildLivingPlan } from "@/lib/engine/living-plan";
import { emptyState, type Profile, type SessionLog } from "@/lib/types";

const profile: Profile = {
  name: "Hub Tester",
  goal: "massa",
  level: "intermediario",
  daysPerWeek: 4,
  age: 28,
  heightCm: 178,
  weightKg: 80,
  equipment: "academia",
  restrictions: [],
  createdAt: new Date().toISOString(),
};

function session(date: string, volumeKg: number): SessionLog {
  return {
    id: `s-${date}-${volumeKg}`,
    dayId: "d1",
    title: "Treino",
    date,
    durationMin: 45,
    exercises: [],
    volumeKg,
  };
}

describe("hubs seed", () => {
  it("seeds two hubs with challenges", () => {
    expect(HUBS).toHaveLength(2);
    expect(hubBySlug("soldiers-performance")?.challengeIds).toContain("evolucao-consistencia-14");
    expect(hubBySlug("projeto-massa-60")?.challengeIds).toContain("hub-massa-60");
  });

  it("hub-massa-60 is relative and progresses by %", () => {
    const c = challengeById("hub-massa-60")!;
    expect(isRelativeChallenge(c)).toBe(true);
    const p = challengeProgress(c, [session(new Date().toISOString().slice(0, 10), 12500)], 10000);
    expect(p.pct).toBe(25);
    expect(p.complete).toBe(true);
  });
});

describe("living plan hub context", () => {
  it("mentions active hub in narrative and why", () => {
    const hub = hubBySlug("projeto-massa-60")!;
    const state = {
      ...emptyState,
      profile,
      joinedHubIds: [hub.id],
      challenges: hub.challengeIds,
      challengeBaselines: { "hub-massa-60": 8000 },
    };
    const plan = buildLivingPlan(state);
    expect(plan).not.toBeNull();
    expect(plan!.narrative).toMatch(/Projeto Massa|Hub:/i);
    expect(plan!.why.some((w) => /Hub ativo/i.test(w))).toBe(true);
    expect(activeHubForState(state.joinedHubIds)?.slug).toBe("projeto-massa-60");
  });
});
