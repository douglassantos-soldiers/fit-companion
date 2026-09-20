import type { MealEntry, MealSlot } from "@/lib/types";
import { MEAL_SLOT_LABEL, todayKey } from "@/lib/types";

export function lastMealForSlot(meals: MealEntry[], slot: MealSlot, beforeDate = todayKey()): MealEntry | null {
  const prior = meals
    .filter((m) => m.slot === slot && m.date.slice(0, 10) < beforeDate)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return prior[0] ?? null;
}

export function copyMealToSlot(entry: MealEntry, slot: MealSlot): Omit<MealEntry, "id" | "date"> {
  const next: Omit<MealEntry, "id" | "date"> = {
    slot,
    label: entry.label,
    proteinG: entry.proteinG,
    kcal: entry.kcal,
    quality: entry.quality,
    servings: entry.servings ?? 1,
    sourceKind: entry.sourceKind ?? "informed",
  };
  if (entry.carbG != null) next.carbG = entry.carbG;
  if (entry.fatG != null) next.fatG = entry.fatG;
  if (entry.fiberG != null) next.fiberG = entry.fiberG;
  if (entry.presetId) next.presetId = entry.presetId;
  if (entry.confidence != null) next.confidence = entry.confidence;
  if (entry.items) next.items = entry.items;
  if (entry.foodSource) next.foodSource = entry.foodSource;
  return next;
}

export function proteinGapLine(proteinG: number, goal: number, nextSlot?: MealSlot | null): string | null {
  const missing = Math.round(goal - proteinG);
  if (goal <= 0) return null;
  if (missing <= 0) return `Proteína no alvo · ${Math.round(proteinG)}/${goal} g`;
  const slot = nextSlot ? ` · ${MEAL_SLOT_LABEL[nextSlot]} agora` : "";
  return `Faltam ${missing} g de proteína${slot}`;
}

export function nutritionProofLine(meals: MealEntry[], proteinGoal: number, days = 7): string | null {
  if (proteinGoal <= 0) return null;
  let hit = 0;
  for (let i = 1; i <= days; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = todayKey(d);
    const protein = meals.filter((m) => m.date.slice(0, 10) === date).reduce((s, m) => s + m.proteinG, 0);
    if (protein >= proteinGoal * 0.9) hit += 1;
  }
  if (hit === 0) return null;
  return `Proteína ${hit}/${days} dias na meta`;
}

export function clampServings(n: number) {
  return Math.min(3, Math.max(0.25, Math.round(n * 4) / 4));
}
