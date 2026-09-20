/**
 * Recovery from lapse — avoid "all or nothing" messaging.
 */
import { interventionForTrigger } from "@/lib/engine/behavior/interventions";
import type {
  BehaviorProfile,
  RecoveryFromLapse,
} from "@/lib/engine/behavior/types";
import { streak } from "@/lib/engine/dimensions";
import type { AppState } from "@/lib/types";
import { todayKey } from "@/lib/types";

export function detectLapses(
  state: AppState,
  profile: BehaviorProfile,
): RecoveryFromLapse[] {
  const out: RecoveryFromLapse[] = [];
  const s = streak(state.sessions ?? [], { freezeUsedDates: state.freezeUsedDates });
  const today = todayKey();
  const trainedToday = (state.sessions ?? []).some((x) => x.date.slice(0, 10) === today);
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return todayKey(d);
  })();
  const trainedYesterday = (state.sessions ?? []).some((x) => x.date.slice(0, 10) === yesterday);

  // Miss yesterday with prior streak — classic relapse framing
  if (!trainedYesterday && s === 0 && (state.sessions?.length ?? 0) >= 3 && !trainedToday) {
    const intervention =
      interventionForTrigger("TRAINING_SKIPPING_PATTERN", profile) ??
      interventionForTrigger("TIME_CONSTRAINT_PATTERN", profile);
    if (intervention) {
      out.push({
        reason: "Sequência quebrada — recomece com uma ação mínima",
        intervention,
        nextAction: intervention.action,
      });
    }
  }

  if (profile.mealAdherence < 0.4 && (state.meals?.length ?? 0) >= 4) {
    const intervention = interventionForTrigger("MEAL_LOGGING_DROP", profile);
    if (intervention) {
      out.push({
        reason: "Logging de refeições caiu — uma refeição já reconstrói o hábito",
        intervention,
        nextAction: intervention.action,
      });
    }
  }

  return out;
}
