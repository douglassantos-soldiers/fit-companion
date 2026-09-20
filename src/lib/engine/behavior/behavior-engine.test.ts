/**
 * Phase 4 Behavior Engine — 10 DoD scenarios.
 */
import { describe, expect, it } from "vitest";
import {
  applyBehaviorOutcome,
  completeExperiment,
  detectLapses,
  runBehaviorLoop,
} from "@/lib/engine/behavior";
import { buildBehaviorProfile } from "@/lib/engine/behavior/profile";
import {
  applyBehaviorOutcomeFromEvaluations,
  evaluateShortSessionOutcome,
} from "@/lib/engine/outcome-learning";
import { lessonForToday } from "@/data/habit-lessons";
import { pickDailyQuests } from "@/data/daily-quests";
import {
  emptyState,
  todayKey,
  type AppState,
  type MealEntry,
  type Profile,
  type SessionLog,
} from "@/lib/types";

function dateNDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayKey(d);
}

function session(partial: Partial<SessionLog> & { date: string }): SessionLog {
  return {
    id: partial.id ?? `s-${partial.date}-${Math.random().toString(36).slice(2, 6)}`,
    dayId: partial.dayId ?? partial.date,
    date: partial.date,
    title: partial.title ?? "Treino",
    durationMin: partial.durationMin ?? 40,
    rpe: partial.rpe ?? "ok",
    exercises: partial.exercises ?? [],
    volumeKg: partial.volumeKg ?? 1000,
  };
}

function meal(date: string, protein = 30): MealEntry {
  return {
    id: `m-${date}-${Math.random().toString(36).slice(2, 6)}`,
    date,
    slot: "almoco",
    label: "Refeição",
    proteinG: protein,
    kcal: 370,
    quality: "verde",
  };
}

const profile: Profile = {
  name: "Teste",
  goal: "massa",
  level: "intermediario",
  daysPerWeek: 4,
  age: 30,
  heightCm: 175,
  weightKg: 80,
  equipment: "academia",
  restrictions: [],
  createdAt: new Date().toISOString(),
  typicalSleepHours: 7,
};

function baseState(over: Partial<AppState> = {}): AppState {
  return {
    ...emptyState,
    profile,
    ...over,
  };
}

describe("Behavior Engine", () => {
  it("1. baixa aderência sexta → LOW_FRIDAY_ADHERENCE + express", () => {
    const sessions: SessionLog[] = [];
    for (let i = 0; i < 28; i += 1) {
      const date = dateNDaysAgo(i);
      const wd = new Date(`${date}T12:00:00`).getDay();
      if (wd === 5) continue;
      if (wd >= 1 && wd <= 4) {
        sessions.push(session({ date, durationMin: 45 }));
      }
    }
    const state = baseState({ sessions });
    const loop = runBehaviorLoop(state);
    const fri = loop.triggers.find((t) => t.key === "LOW_FRIDAY_ADHERENCE");
    expect(fri?.active).toBe(true);
    expect(loop.interventions.some((i) => i.type === "express_workout")).toBe(true);
  });

  it("2. meal gap fim de semana → WEEKEND_MEAL_GAP", () => {
    const clean: MealEntry[] = [];
    for (let i = 0; i < 14; i += 1) {
      const date = dateNDaysAgo(i);
      const wd = new Date(`${date}T12:00:00`).getDay();
      if (wd === 0 || wd === 6) continue;
      clean.push(meal(date), { ...meal(date), id: `m2-${date}` });
    }
    const state = baseState({ meals: clean, sessions: [session({ date: dateNDaysAgo(1) })] });
    const loop = runBehaviorLoop(state);
    expect(loop.triggers.some((t) => t.key === "WEEKEND_MEAL_GAP" && t.active)).toBe(true);
    expect(
      lessonForToday(new Date(), {
        triggers: loop.triggers,
        patterns: loop.patterns,
        profile: loop.profile,
        weekday: 6,
      }).tags,
    ).toContain("weekend");
  });

  it("3. treino curto funcionando → TIME_CONSTRAINT + express preference", () => {
    const sessions = Array.from({ length: 8 }, (_, i) =>
      session({ date: dateNDaysAgo(i), durationMin: 30 }),
    );
    const state = baseState({ sessions });
    const loop = runBehaviorLoop(state);
    expect(
      loop.patterns.some(
        (p) => p.key === "long_workout_avoidance" || p.key === "prefers_short_sessions",
      ),
    ).toBe(true);
    const trig = loop.triggers.find((t) => t.key === "TIME_CONSTRAINT_PATTERN");
    expect(trig?.active).toBe(true);
    const quests = pickDailyQuests(todayKey(), "dev-1", {
      triggers: loop.triggers,
      patterns: loop.patterns,
      profile: loop.profile,
      weekday: 1,
    });
    expect(quests.some((q) => q.kind === "train" || q.kind === "xp_goal")).toBe(true);
  });

  it("4. intervenção falhando → interventionResponse cai", () => {
    const profileB = buildBehaviorProfile(baseState({ sessions: [session({ date: todayKey() })] }));
    const next = applyBehaviorOutcome(profileB, "express_workout", false);
    expect(next.interventionResponse.express_workout!).toBeLessThan(
      profileB.interventionResponse.express_workout ?? 0.5,
    );
  });

  it("5. intervenção repetidamente ok → taxa sobe", () => {
    let p = buildBehaviorProfile(baseState());
    for (let i = 0; i < 4; i += 1) {
      p = applyBehaviorOutcome(p, "meal_swap", true);
    }
    expect(p.interventionResponse.meal_swap!).toBeGreaterThan(0.7);
  });

  it("6. mudança de padrão — short sessions outcome bridge", () => {
    const p = buildBehaviorProfile(baseState());
    const ev = evaluateShortSessionOutcome({
      sessionDurationMin: 25,
      workoutCompleted: true,
      rpe: "ok",
    });
    expect(ev.result).toBe("success");
    const next = applyBehaviorOutcomeFromEvaluations(p, [ev]);
    expect(next.interventionResponse.express_workout!).toBeGreaterThan(
      p.interventionResponse.express_workout ?? 0.5,
    );
  });

  it("7. experimento completo", () => {
    const state = baseState({
      meals: Array.from({ length: 10 }, (_, i) => meal(dateNDaysAgo(i))),
      sessions: Array.from({ length: 6 }, (_, i) =>
        session({ date: dateNDaysAgo(i), durationMin: 35 }),
      ),
    });
    // Force weekend gap so experiment proposes
    const weekdayMeals = Array.from({ length: 12 }, (_, i) => {
      const d = dateNDaysAgo(i);
      const wd = new Date(`${d}T12:00:00`).getDay();
      if (wd === 0 || wd === 6) return null;
      return meal(d);
    }).filter(Boolean) as MealEntry[];
    const loop = runBehaviorLoop(
      baseState({
        meals: weekdayMeals,
        sessions: Array.from({ length: 6 }, (_, i) =>
          session({ date: dateNDaysAgo(i), durationMin: 35 }),
        ),
      }),
    );
    const exp = loop.experiments.find((e) => e.status === "active");
    expect(exp).toBeTruthy();
    const done = completeExperiment(exp!, 0.8);
    expect(done.status).toBe("completed");
    expect(done.result).toBe(0.8);
    expect(done.confidence).toBeGreaterThan(0.5);
  });

  it("8. relapse — sequência quebrada gera recovery", () => {
    const sessions = [
      session({ date: dateNDaysAgo(5), durationMin: 40 }),
      session({ date: dateNDaysAgo(4), durationMin: 40 }),
      session({ date: dateNDaysAgo(3), durationMin: 40 }),
    ];
    const state = baseState({ sessions });
    const p = buildBehaviorProfile(state);
    const lapses = detectLapses(state, p);
    expect(lapses.length).toBeGreaterThan(0);
    expect(lapses[0]!.nextAction.length).toBeGreaterThan(5);
  });

  it("9. recuperação — after lapse intervention is actionable micro", () => {
    const sessions = [
      session({ date: dateNDaysAgo(4) }),
      session({ date: dateNDaysAgo(3) }),
      session({ date: dateNDaysAgo(2) }),
    ];
    const loop = runBehaviorLoop(baseState({ sessions }));
    const lapse = loop.lapses[0];
    expect(lapse).toBeTruthy();
    expect(["express_workout", "micro_goal", "meal_swap", "reminder"]).toContain(
      lapse!.intervention.type,
    );
  });

  it("10. baixa confiança — sem trigger com 1 evidência", () => {
    const state = baseState({
      sessions: [session({ date: dateNDaysAgo(1), durationMin: 40 })],
      meals: [meal(dateNDaysAgo(1))],
    });
    const loop = runBehaviorLoop(state);
    expect(loop.triggers.every((t) => !t.active)).toBe(true);
    expect(loop.interventions.length).toBe(0);
  });
});
