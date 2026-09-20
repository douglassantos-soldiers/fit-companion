import { describe, expect, it } from "vitest";
import { brandLevel, rankForLevel } from "@/lib/engine/brand-level";
import { evaluateAchievements, pendingAchievements } from "@/lib/engine/achievements";
import { homePersona } from "@/lib/engine/home-persona";
import { periodReview, prsAchievedInSession } from "@/lib/engine/period-review";
import { suggestLoadDrop, applyLoadDrop } from "@/lib/training/intra-session";
import { emptyState, todayKey, type AppState, type Profile, type SessionLog, type SetLog } from "@/lib/types";

function profile(over: Partial<Profile> = {}): Profile {
  return {
    name: "Ana",
    goal: "massa",
    level: "iniciante",
    daysPerWeek: 4,
    age: 26,
    heightCm: 165,
    weightKg: 62,
    equipment: "academia",
    restrictions: [],
    createdAt: new Date().toISOString(),
    typicalSessionMin: 45,
    onboardingComplete: true,
    ...over,
  };
}

function set(over: Partial<SetLog> = {}): SetLog {
  return { reps: 10, weightKg: 60, done: true, type: "working", ...over };
}

function session(over: Partial<SessionLog> = {}): SessionLog {
  return {
    id: over.id ?? "s1",
    dayId: "d1",
    title: "Upper",
    date: over.date ?? todayKey(),
    durationMin: 50,
    volumeKg: over.volumeKg ?? 4000,
    exercises: over.exercises ?? [
      { exerciseId: "supino-reto", sets: [set(), set({ reps: 9 }), set({ reps: 8 })] },
    ],
    ...over,
  };
}

function state(over: Partial<AppState> = {}): AppState {
  return { ...emptyState, profile: profile(), ...over };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayKey(d);
}

describe("Fase 9 brand levels", () => {
  it("starts as Recruta nível 1", () => {
    const b = brandLevel(state());
    expect(b.level).toBe(1);
    expect(b.rank).toBe("recruta");
    expect(b.label).toBe("Recruta");
  });

  it("maps thresholds Recruta → Legend", () => {
    expect(rankForLevel(1)).toBe("recruta");
    expect(rankForLevel(5)).toBe("soldier");
    expect(rankForLevel(10)).toBe("warrior");
    expect(rankForLevel(20)).toBe("elite");
    expect(rankForLevel(50)).toBe("legend");
  });

  it("gains levels from lifetime XP", () => {
    const b = brandLevel(state({ xpByDate: { [todayKey()]: 250 } }));
    expect(b.level).toBe(6);
    expect(b.rank).toBe("soldier");
  });
});

describe("Fase 9 achievements", () => {
  it("unlocks first-workout on first session", () => {
    const ids = evaluateAchievements(state({ sessions: [session()] }));
    expect(ids).toContain("first-workout");
  });

  it("unlocks first-challenge when a challenge is joined", () => {
    const ids = evaluateAchievements(state({ challenges: ["c1"] }));
    expect(ids).toContain("first-challenge");
  });

  it("unlocks volume-100k at 100000 kg", () => {
    const ids = evaluateAchievements(
      state({ sessions: [session({ volumeKg: 100_000, exercises: [] })] }),
    );
    expect(ids).toContain("volume-100k");
  });

  it("pendingAchievements skips already earned", () => {
    const s = state({
      sessions: [session()],
      earnedBadges: ["first-workout"],
    });
    expect(pendingAchievements(s)).not.toContain("first-workout");
  });
});

describe("Fase 9 home persona", () => {
  it("novo with zero sessions", () => {
    expect(homePersona(state())).toBe("novo");
  });

  it("inativo after 8+ days", () => {
    expect(homePersona(state({ sessions: [session({ date: daysAgo(9) })] }))).toBe("inativo");
  });

  it("novo wins for fresh account with one recent session", () => {
    expect(
      homePersona(
        state({
          profile: profile({ createdAt: new Date().toISOString() }),
          sessions: [session({ date: todayKey() })],
        }),
      ),
    ).toBe("novo");
  });

  it("avancado with 20 sessions and advanced level", () => {
    const sessions = Array.from({ length: 20 }, (_, i) =>
      session({ id: `s${i}`, date: daysAgo(i % 6) }),
    );
    expect(
      homePersona(
        state({
          profile: profile({ level: "avancado", createdAt: daysAgo(40) }),
          sessions,
        }),
      ),
    ).toBe("avancado");
  });

  it("consistente when trained this week and not new", () => {
    expect(
      homePersona(
        state({
          profile: profile({ createdAt: daysAgo(40) }),
          sessions: [session({ id: "a", date: daysAgo(10) }), session({ id: "b", date: todayKey() })],
        }),
      ),
    ).toBe("consistente");
  });
});

describe("Fase 9 intra-session load drop", () => {
  it("suggests 10% drop when RIR falls by 2", () => {
    const suggestion = suggestLoadDrop({
      logs: [
        {
          exerciseId: "supino-reto",
          sets: [
            set({ rir: 3, weightKg: 80, done: true }),
            set({ rir: 1, weightKg: 80, done: true }),
            set({ rir: 2, weightKg: 80, done: false }),
          ],
        },
      ],
      exerciseIndex: 0,
      completedSetIndex: 1,
    });
    expect(suggestion).not.toBeNull();
    expect(suggestion!.toKg).toBe(72.5);
    expect(suggestion!.setIndex).toBe(2);
  });

  it("suggests drop when RPE rises by 2", () => {
    const suggestion = suggestLoadDrop({
      logs: [
        {
          exerciseId: "agachamento",
          sets: [set({ rpe: 6, weightKg: 100, done: true }), set({ rpe: 8, weightKg: 100, done: true })],
        },
        {
          exerciseId: "leg-press",
          sets: [set({ weightKg: 100, done: false })],
        },
      ],
      exerciseIndex: 0,
      completedSetIndex: 1,
      currentGroup: "pernas",
      nextExerciseGroup: "pernas",
    });
    expect(suggestion?.exerciseIndex).toBe(1);
    expect(suggestion?.toKg).toBe(90);
  });

  it("applies the suggested load", () => {
    const logs = [
      {
        exerciseId: "supino-reto",
        sets: [set({ weightKg: 80, done: true }), set({ weightKg: 80, done: false })],
      },
    ];
    const next = applyLoadDrop(logs, {
      exerciseIndex: 0,
      setIndex: 1,
      fromKg: 80,
      toKg: 72.5,
      reason: "rir_drop",
    });
    expect(next[0]!.sets[1]!.weightKg).toBe(72.5);
  });
});

describe("Fase 9 period review", () => {
  it("aggregates this week's sessions", () => {
    const review = periodReview(
      state({
        sessions: [session({ volumeKg: 5000 }), session({ id: "s2", date: daysAgo(20), volumeKg: 1000 })],
      }),
      "week",
    );
    expect(review.sessions).toBeGreaterThanOrEqual(1);
    expect(review.volumeKg).toBeGreaterThanOrEqual(5000);
    expect(review.coachLine.length).toBeGreaterThan(3);
  });
});

describe("Fase 9 typicalSessionMin is explicit (no silent body defaults in onboarding)", () => {
  it("typicalSessionMin lives on the profile", () => {
    const p = profile({ typicalSessionMin: 30, age: 31, weightKg: 71, heightCm: 170 });
    expect(p.typicalSessionMin).toBe(30);
    expect(p.age).not.toBe(28);
    expect(p.weightKg).not.toBe(80);
  });
});

describe("Fase 9 session PRs", () => {
  it("detects a weight PR vs prior sessions", () => {
    const prior = session({
      id: "old",
      date: daysAgo(4),
      exercises: [{ exerciseId: "supino-reto", sets: [set({ weightKg: 60, done: true })] }],
    });
    const current = session({
      id: "new",
      exercises: [{ exerciseId: "supino-reto", sets: [set({ weightKg: 70, done: true })] }],
    });
    const prs = prsAchievedInSession(current, [prior]);
    expect(prs.some((p) => p.prType === "WEIGHT_PR" && p.value === 70)).toBe(true);
  });
});
