/**
 * QA / Test mode — preview fixtures only. Never mutates production without ENABLE_QA_MODE.
 */
import { emptyState, type AppState, type MealEntry, type Profile, type SessionLog, todayKey } from "@/lib/types";
import { DEFAULT_USER_TIMEZONE } from "@/lib/timezone";

export function isQaModeEnabled(): boolean {
  if (process.env["NODE_ENV"] === "production" && process.env["ENABLE_QA_MODE"] !== "true") {
    return false;
  }
  return process.env["ENABLE_QA_MODE"] === "true" || process.env["NODE_ENV"] === "test";
}

function baseProfile(over: Partial<Profile> = {}): Profile {
  return {
    name: "QA User",
    goal: "performance",
    level: "intermediario",
    daysPerWeek: 4,
    age: 28,
    heightCm: 178,
    weightKg: 80,
    equipment: "academia",
    restrictions: [],
    createdAt: new Date().toISOString(),
    typicalSleepHours: 7.5,
    timezone: DEFAULT_USER_TIMEZONE,
    ...over,
  };
}

function session(
  id: string,
  date: string,
  opts: { durationMin?: number; rpe?: SessionLog["rpe"] } = {},
): SessionLog {
  return {
    id,
    dayId: date,
    title: "QA session",
    date,
    durationMin: opts.durationMin ?? 60,
    exercises: [],
    volumeKg: 1000,
    ...(opts.rpe ? { rpe: opts.rpe } : {}),
  };
}

function meal(id: string, date: string, proteinG: number): MealEntry {
  return {
    id,
    date,
    slot: "almoco",
    label: "QA meal",
    proteinG,
    kcal: 400 + proteinG * 2,
    quality: "verde",
    sourceKind: "informed",
  };
}

export type QaScenarioId =
  | "healthy_full"
  | "low_sleep"
  | "low_sleep_high_rpe"
  | "high_rpe"
  | "short_time"
  | "no_equipment"
  | "repeated_high_load"
  | "good_recovery"
  | "nutrition_incomplete"
  | "low_nutrition"
  | "strong_nutrition"
  | "good_adherence"
  | "low_adherence"
  | "weekend_pattern"
  | "plateau"
  | "rest_day"
  | "deload";

export type BuildQaScenarioOpts = {
  /** Pin calendar day (YYYY-MM-DD) — use a weekday for healthy_full to avoid weekend rest. */
  date?: string;
};

/** Build an AppState fixture for deterministic engine tests / QA preview. */
export function buildQaScenario(id: QaScenarioId, opts?: BuildQaScenarioOpts): AppState {
  const date = opts?.date ?? todayKey();
  // daysPerWeek 7 → living plan always has a training day for fixed-date tests
  const profile = baseProfile({ daysPerWeek: 7 });
  const state: AppState = {
    ...emptyState,
    profile,
    userId: "qa-user",
  };

  switch (id) {
    case "healthy_full":
      state.dayCheckIns = {
        [date]: { date, sleepHours: 8, energy: "alta", availableMin: 60 },
      };
      break;
    case "low_sleep":
      state.dayCheckIns = {
        [date]: { date, sleepHours: 5, energy: "ok", availableMin: 60 },
      };
      break;
    case "high_rpe":
      state.dayCheckIns = {
        [date]: { date, sleepHours: 7.5, energy: "ok", availableMin: 60 },
      };
      state.sessions = [
        session("1", shift(date, -1), { rpe: "dificil" }),
        session("2", shift(date, -2), { rpe: "dificil" }),
        session("3", shift(date, -3), { rpe: "dificil" }),
      ];
      break;
    case "low_sleep_high_rpe":
      state.dayCheckIns = {
        [date]: { date, sleepHours: 5, energy: "baixa", availableMin: 60 },
      };
      state.sessions = [
        session("1", shift(date, -1), { rpe: "dificil" }),
        session("2", shift(date, -2), { rpe: "dificil" }),
        session("3", shift(date, -3), { rpe: "dificil" }),
      ];
      break;
    case "short_time":
      state.dayCheckIns = {
        [date]: { date, sleepHours: 7, energy: "ok", availableMin: 30 },
      };
      break;
    case "no_equipment":
      state.dayCheckIns = {
        [date]: { date, sleepHours: 7, energy: "ok", availableMin: 45, noEquipment: true },
      };
      break;
    case "repeated_high_load":
      state.sessions = [1, 2, 3, 4, 5].map((n) =>
        session(String(n), shift(date, -n), { durationMin: 70, rpe: "dificil" }),
      );
      state.dayCheckIns = {
        [date]: { date, sleepHours: 6.5, energy: "ok", availableMin: 60 },
      };
      break;
    case "good_recovery":
      state.dayCheckIns = {
        [date]: { date, sleepHours: 8, energy: "alta", availableMin: 90, soreness: 1, stress: 1 },
      };
      break;
    case "nutrition_incomplete":
    case "low_nutrition":
      state.dayCheckIns = {
        [date]: { date, sleepHours: 7, energy: "ok", availableMin: 60 },
      };
      state.meals = [meal("m1", shift(date, -1), 15)];
      break;
    case "strong_nutrition":
    case "good_adherence": {
      const meals: MealEntry[] = [];
      for (let i = 0; i < 7; i += 1) {
        const d = shift(date, -i);
        for (const slot of ["cafe", "almoco", "jantar"] as const) {
          meals.push({
            id: `${d}-${slot}`,
            date: d,
            slot,
            label: slot,
            proteinG: 45,
            kcal: 520,
            quality: "verde",
            sourceKind: "informed",
          });
        }
      }
      state.meals = meals;
      state.dayCheckIns = {
        [date]: { date, sleepHours: 7.5, energy: "alta", availableMin: 60 },
      };
      state.sessions = [1, 2, 3, 4].map((n) =>
        session(String(n), shift(date, -n), { durationMin: 50, rpe: "ok" }),
      );
      break;
    }
    case "low_adherence": {
      state.dayCheckIns = {
        [date]: { date, sleepHours: 7, energy: "ok", availableMin: 60 },
      };
      // Sparse meals weekdays only — low protein
      state.meals = [1, 3, 5].map((n) => meal(`m${n}`, shift(date, -n), 12));
      state.sessions = [session("1", shift(date, -10), { durationMin: 40 })];
      break;
    }
    case "weekend_pattern": {
      const meals: MealEntry[] = [];
      for (let i = 0; i < 14; i += 1) {
        const d = shift(date, -i);
        const wd = new Date(`${d}T12:00:00`).getDay();
        if (wd === 0 || wd === 6) continue;
        meals.push(meal(`m-${d}-a`, d, 40), meal(`m-${d}-b`, d, 35));
      }
      state.meals = meals;
      state.dayCheckIns = {
        [date]: { date, sleepHours: 7, energy: "ok", availableMin: 60 },
      };
      break;
    }
    case "plateau": {
      // Same exercise loads repeatedly → plateau_detected via exercise-history
      const exercises = [
        {
          exerciseId: "bench_press",
          sets: [
            { reps: 8, weightKg: 60 },
            { reps: 8, weightKg: 60 },
            { reps: 8, weightKg: 60 },
          ],
        },
      ];
      state.sessions = [1, 2, 3, 4, 5, 6].map((n) => ({
        ...session(String(n), shift(date, -n * 3), { durationMin: 55, rpe: "ok" }),
        exercises: exercises as SessionLog["exercises"],
      }));
      state.dayCheckIns = {
        [date]: { date, sleepHours: 7.5, energy: "ok", availableMin: 60 },
      };
      break;
    }
    case "rest_day":
      state.dayCheckIns = {
        [date]: { date, sleepHours: 5.5, energy: "baixa", availableMin: 20, soreness: 4 },
      };
      break;
    case "deload":
      state.sessions = [1, 2, 3].map((n) =>
        session(String(n), shift(date, -n), { durationMin: 65, rpe: "dificil" }),
      );
      state.dayCheckIns = {
        [date]: { date, sleepHours: 6, energy: "baixa", availableMin: 50 },
      };
      break;
    default:
      break;
  }

  return state;
}

function shift(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
