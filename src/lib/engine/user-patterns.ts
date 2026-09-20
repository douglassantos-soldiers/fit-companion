import { todayKey, type AppState } from "@/lib/types";

export type UserPatterns = {
  weekdaySessionCounts: Record<number, number>;
  weakestWeekday: number | null;
  mealGapWeekend: boolean;
  longWorkoutAvoidance: boolean;
  updatedAt: string;
};

/** EVENTS → FEATURES → PATTERNS (rule-based, no ML). */
export function extractUserPatterns(state: AppState): UserPatterns {
  const weekdaySessionCounts: Record<number, number> = {};
  for (let i = 0; i < 7; i++) weekdaySessionCounts[i] = 0;
  for (const s of state.sessions) {
    const wd = new Date(s.date).getDay();
    weekdaySessionCounts[wd] = (weekdaySessionCounts[wd] ?? 0) + 1;
  }

  let weakestWeekday: number | null = null;
  if (state.sessions.length >= 8) {
    let min = Infinity;
    for (let i = 0; i < 7; i++) {
      const c = weekdaySessionCounts[i] ?? 0;
      if (c < min) {
        min = c;
        weakestWeekday = i;
      }
    }
  }

  const weekendMeals = (state.meals ?? []).filter((m) => {
    const wd = new Date(m.date).getDay();
    return wd === 0 || wd === 6;
  }).length;
  const weekdayMeals = (state.meals ?? []).length - weekendMeals;
  const mealGapWeekend =
    weekdayMeals > 4 && weekendMeals < weekdayMeals * 0.35;

  const longSessions = state.sessions.filter((s) => s.durationMin >= 75).length;
  const shortSessions = state.sessions.filter((s) => s.durationMin > 0 && s.durationMin < 45).length;
  const longWorkoutAvoidance = state.sessions.length >= 6 && longSessions < shortSessions * 0.3;

  return {
    weekdaySessionCounts,
    weakestWeekday,
    mealGapWeekend,
    longWorkoutAvoidance,
    updatedAt: new Date().toISOString(),
  };
}

export function patternInsights(patterns: UserPatterns): string[] {
  const names = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const out: string[] = [];
  if (patterns.weakestWeekday != null) {
    out.push(`Você costuma treinar menos na ${names[patterns.weakestWeekday]}.`);
  }
  if (patterns.mealGapWeekend) {
    out.push("Você registra menos refeições no fim de semana.");
  }
  if (patterns.longWorkoutAvoidance) {
    out.push("Você tende a concluir melhor treinos mais curtos.");
  }
  return out;
}
