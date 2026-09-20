/**
 * Micro-experiments (e.g. 7-day protein-at-breakfast).
 */
import type { BehaviorExperiment, BehaviorTrigger } from "@/lib/engine/behavior/types";
import { todayKey } from "@/lib/types";

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return todayKey(d);
}

export function proposeExperiments(
  triggers: BehaviorTrigger[],
  existing: BehaviorExperiment[] = [],
  now = todayKey(),
): BehaviorExperiment[] {
  const activeExisting = existing.filter((e) => e.status === "active");
  if (activeExisting.length) return existing;

  const out = [...existing];
  const meal = triggers.find((t) => t.active && (t.key === "WEEKEND_MEAL_GAP" || t.key === "MEAL_LOGGING_DROP"));
  if (meal) {
    out.push({
      id: `exp-protein-breakfast-${now}`,
      target: "Proteína no café por 7 dias",
      start: now,
      end: addDays(now, 7),
      baseline: 0.4,
      result: null,
      confidence: 0.5,
      status: "active",
    });
  }

  const time = triggers.find((t) => t.active && t.key === "TIME_CONSTRAINT_PATTERN");
  if (time && !out.some((e) => e.status === "active")) {
    out.push({
      id: `exp-express-week-${now}`,
      target: "Express 3x na semana",
      start: now,
      end: addDays(now, 7),
      baseline: 0.3,
      result: null,
      confidence: 0.55,
      status: "active",
    });
  }

  return out;
}

export function completeExperiment(
  exp: BehaviorExperiment,
  result: number,
): BehaviorExperiment {
  const delta = result - exp.baseline;
  return {
    ...exp,
    result,
    status: "completed",
    confidence: Math.min(0.9, Math.max(0.3, 0.5 + delta)),
  };
}
