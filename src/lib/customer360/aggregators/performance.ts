import type { AppState } from "@/lib/types";
import type { Performance360 } from "@/lib/customer360/types";
import { listExercisesWithHistory } from "@/lib/engine/exercise-history";
import { weekOverWeek } from "@/lib/engine/dimensions";
import { computeMuscleLoad } from "@/lib/training/muscle-load";
import { currentPersonalRecords } from "@/lib/training/prs";
import { exerciseStrengthTrend } from "@/lib/training/one-rm";
import { hitsForExercise } from "@/lib/engine/exercise-history";

export function aggregatePerformance(state: AppState): Performance360 {
  const profile = state.profile;
  const sessions28 = state.sessions.filter((s) => {
    const d = new Date(s.date);
    const lim = new Date();
    lim.setDate(lim.getDate() - 28);
    return d >= lim;
  });
  const volume28d = sessions28.reduce((s, x) => s + x.volumeKg, 0);
  let hardStreak = 0;
  const sorted = [...state.sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const s of sorted) {
    if (s.rpe === "dificil") hardStreak += 1;
    else break;
  }

  const history = listExercisesWithHistory(state.sessions, 50);
  const prs = currentPersonalRecords(state.sessions);
  const wow = weekOverWeek(state.sessions);
  let volumeTrend: Performance360["volumeTrend"] = "unknown";
  if (wow.volumeDeltaPct == null) volumeTrend = "unknown";
  else if (wow.volumeDeltaPct > 5) volumeTrend = "up";
  else if (wow.volumeDeltaPct < -5) volumeTrend = "down";
  else volumeTrend = "flat";

  const top = history[0];
  const strengthTrend = top
    ? exerciseStrengthTrend(hitsForExercise(top.exerciseId, state.sessions))
    : "unknown";

  const loads = computeMuscleLoad(state.sessions).filter((m) => m.muscle !== "cardio");
  const eff = loads.map((m) => m.rolling_7d);
  const avg = eff.length ? eff.reduce((a, b) => a + b, 0) / eff.length : 0;
  const variance =
    eff.length > 0 ? eff.reduce((a, b) => a + Math.abs(b - avg), 0) / eff.length : 0;
  const muscleBalance = avg > 0 ? Math.max(0, Math.min(100, Math.round(100 - (variance / avg) * 40))) : null;

  const ormUp = history.filter((h) => h.trend === "up").length;
  const ormDown = history.filter((h) => h.trend === "down").length;
  let estimated1rmTrend: Performance360["estimated1rmTrend"] = "unknown";
  if (ormUp > ormDown + 1) estimated1rmTrend = "up";
  else if (ormDown > ormUp + 1) estimated1rmTrend = "down";
  else if (history.length) estimated1rmTrend = "flat";

  return {
    sessions28d: sessions28.length,
    volume28d: Math.round(volume28d),
    trainingFrequency: profile?.daysPerWeek ?? 0,
    avgRpeHardStreak: hardStreak,
    performanceLevel: profile?.level ?? null,
    exerciseCount: history.length,
    prCount: prs.filter((p) => p.prType === "WEIGHT_PR" || p.prType === "ESTIMATED_1RM_PR").length,
    estimated1rmTrend,
    volumeTrend,
    muscleBalance,
    strengthTrend,
  };
}
