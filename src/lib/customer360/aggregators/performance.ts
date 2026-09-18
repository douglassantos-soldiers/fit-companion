import type { AppState } from "@/lib/types";
import type { Performance360 } from "@/lib/customer360/types";

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

  return {
    sessions28d: sessions28.length,
    volume28d: Math.round(volume28d),
    trainingFrequency: profile?.daysPerWeek ?? 0,
    avgRpeHardStreak: hardStreak,
    performanceLevel: profile?.level ?? null,
  };
}
