/**
 * FASE 7 — Nutrition Intelligence helpers (active slots, redistribution).
 */
import type { MealSlot, NutritionProfile, Profile } from "@/lib/types";

export const ALL_MEAL_SLOTS: MealSlot[] = ["cafe", "almoco", "lanche", "jantar"];

export const FOOD_RESTRICTION_OPTIONS = ["Lactose", "Glúten", "Carne", "Porco"] as const;

/** Resolve which meal slots are active for this profile. */
export function activeMealSlots(profile: Profile): MealSlot[] {
  const np = profile.nutritionProfile;
  if (np?.activeSlots?.length) {
    return ALL_MEAL_SLOTS.filter((s) => np.activeSlots!.includes(s));
  }
  if (np?.mealWindows) {
    const enabled = ALL_MEAL_SLOTS.filter((s) => {
      const w = np.mealWindows?.[s];
      if (w == null) return !(profile.skipBreakfast && s === "cafe");
      return w.enabled !== false;
    });
    if (enabled.length) return enabled;
  }
  if (profile.skipBreakfast) {
    return ALL_MEAL_SLOTS.filter((s) => s !== "cafe");
  }
  return [...ALL_MEAL_SLOTS];
}

/** Build / merge nutrition profile from onboarding flags. */
export function buildNutritionProfileFromFlags(opts: {
  skipBreakfast?: boolean;
  lunchOutOften?: boolean;
  existing?: NutritionProfile;
}): NutritionProfile {
  const activeSlots = opts.skipBreakfast
    ? ALL_MEAL_SLOTS.filter((s) => s !== "cafe")
    : opts.existing?.activeSlots?.length
      ? opts.existing.activeSlots
      : [...ALL_MEAL_SLOTS];

  const out: NutritionProfile = {
    foodPreferences: opts.existing?.foodPreferences ?? [],
    foodRestrictions: opts.existing?.foodRestrictions ?? [],
    activeSlots,
  };
  if (opts.existing?.mealWindows) out.mealWindows = opts.existing.mealWindows;
  if (opts.existing?.eatingDifficulty) out.eatingDifficulty = opts.existing.eatingDifficulty;
  if (opts.existing?.budgetLevel) out.budgetLevel = opts.existing.budgetLevel;
  if (opts.existing?.eatsOutFrequency) {
    out.eatsOutFrequency = opts.existing.eatsOutFrequency;
  } else if (opts.lunchOutOften) {
    out.eatsOutFrequency = "frequente";
  }
  if (opts.existing?.adherenceNotes) out.adherenceNotes = opts.existing.adherenceNotes;
  if (opts.existing?.countWheyInMacros) out.countWheyInMacros = true;
  return out;
}

/** Scale factor to redistribute intake across N active slots vs 4 default. */
export function redistributionFactor(activeCount: number, baseSlots = 4): number {
  if (activeCount <= 0) return 1;
  return baseSlots / activeCount;
}
