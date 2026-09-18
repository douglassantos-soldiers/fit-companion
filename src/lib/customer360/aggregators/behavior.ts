import { streak } from "@/lib/engine/dimensions";
import type { AppState } from "@/lib/types";
import type { Behavior360 } from "@/lib/customer360/types";

export function aggregateBehavior(state: AppState): Behavior360 {
  const logDays = Object.values(state.supplementLogs ?? {}).filter((ids) => ids.length > 0).length;
  return {
    workoutsCompleted: state.sessions.length,
    mealsLogged: (state.meals ?? []).length,
    weightLogs: state.weights.length,
    supplementDays: logDays,
    coachMessages: (state.chat ?? []).length,
    streak: streak(state.sessions, { freezeUsedDates: state.freezeUsedDates }),
  };
}
