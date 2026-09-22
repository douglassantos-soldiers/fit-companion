/**
 * Nutrient helpers — macros + extensible micros.
 * AI estimates must use kind: "estimated", never "observed".
 */
import type {
  FoodSource,
  MacroSnapshot,
  NutrientKind,
  NutrientKey,
  NutrientValue,
} from "@/lib/nutrition/types";
import type { MealEntry, MealItemEntry } from "@/lib/types";

export const MACRO_UNITS: Record<string, string> = {
  energyKcal: "kcal",
  proteinG: "g",
  carbG: "g",
  fatG: "g",
  fiberG: "g",
  sugarG: "g",
  sodiumMg: "mg",
};

export function emptyMacros(): MacroSnapshot {
  return { energyKcal: 0, proteinG: 0, carbG: 0, fatG: 0, fiberG: 0 };
}

export function scaleMacros(base: MacroSnapshot, factor: number): MacroSnapshot {
  const f = Math.max(0, factor);
  const out: MacroSnapshot = {
    energyKcal: round1(base.energyKcal * f),
    proteinG: round1(base.proteinG * f),
    carbG: round1(base.carbG * f),
    fatG: round1(base.fatG * f),
  };
  if (base.fiberG != null) out.fiberG = round1(base.fiberG * f);
  if (base.sugarG != null) out.sugarG = round1(base.sugarG * f);
  if (base.sodiumMg != null) out.sodiumMg = round1(base.sodiumMg * f);
  if (base.extras) {
    out.extras = {};
    for (const [k, v] of Object.entries(base.extras)) {
      out.extras[k] = { ...v, value: round1(v.value * f) };
    }
  }
  return out;
}

export function sumMacros(parts: MacroSnapshot[]): MacroSnapshot {
  const acc = emptyMacros();
  let sugar = 0;
  let sodium = 0;
  let hasSugar = false;
  let hasSodium = false;
  for (const p of parts) {
    acc.energyKcal += p.energyKcal;
    acc.proteinG += p.proteinG;
    acc.carbG += p.carbG;
    acc.fatG += p.fatG;
    acc.fiberG = (acc.fiberG ?? 0) + (p.fiberG ?? 0);
    if (p.sugarG != null) {
      sugar += p.sugarG;
      hasSugar = true;
    }
    if (p.sodiumMg != null) {
      sodium += p.sodiumMg;
      hasSodium = true;
    }
  }
  const out: MacroSnapshot = {
    energyKcal: Math.round(acc.energyKcal),
    proteinG: round1(acc.proteinG),
    carbG: round1(acc.carbG),
    fatG: round1(acc.fatG),
    fiberG: round1(acc.fiberG ?? 0),
  };
  if (hasSugar) out.sugarG = round1(sugar);
  if (hasSodium) out.sodiumMg = round1(sodium);

  const extras: Record<string, NutrientValue> = {};
  for (const p of parts) {
    if (!p.extras) continue;
    for (const [k, v] of Object.entries(p.extras)) {
      if (!v || v.value <= 0) continue;
      const prev = extras[k];
      extras[k] = prev
        ? { ...v, value: round1(prev.value + v.value), confidence: Math.min(prev.confidence, v.confidence) }
        : { ...v };
    }
  }
  if (Object.keys(extras).length) out.extras = extras;
  return out;
}

export function nutrientValue(
  key: NutrientKey,
  value: number,
  unit: string,
  source: FoodSource,
  kind: NutrientKind,
  confidence: number,
): NutrientValue {
  return { key, value, unit, source, kind, confidence };
}

/** Macro distribution fractions (protein/carb/fat by kcal approx 4/4/9). */
export function macroDistribution(m: MacroSnapshot): {
  protein: number;
  carb: number;
  fat: number;
} {
  const pKcal = m.proteinG * 4;
  const cKcal = m.carbG * 4;
  const fKcal = m.fatG * 9;
  const total = pKcal + cKcal + fKcal;
  if (total <= 0) return { protein: 0, carb: 0, fat: 0 };
  return {
    protein: round2(pKcal / total),
    carb: round2(cKcal / total),
    fat: round2(fKcal / total),
  };
}

export function qualityFromMacros(proteinG: number, kcal: number): "verde" | "amarelo" | "laranja" {
  if (proteinG >= 30 && kcal > 0 && proteinG / (kcal / 100) >= 4) return "verde";
  if (proteinG >= 15) return "amarelo";
  return "laranja";
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export const MICRO_LABELS_PT: Record<string, string> = {
  ironMg: "Ferro",
  calciumMg: "Cálcio",
  magnesiumMg: "Magnésio",
  zincMg: "Zinco",
  potassiumMg: "Potássio",
  vitaminAUcg: "Vitamina A",
  vitaminCMg: "Vitamina C",
  vitaminDUcg: "Vitamina D",
  vitaminB12Ucg: "Vitamina B12",
  fiberG: "Fibra",
  sodiumMg: "Sódio",
};

/** Whitelist — performance panel only (never open MicroKey list). */
export const PERFORMANCE_MICRO_KEYS = ["fiberG", "sodiumMg", "ironMg", "vitaminDUcg"] as const;
export type PerformanceMicroKey = (typeof PERFORMANCE_MICRO_KEYS)[number];

export const PERFORMANCE_MICRO_TARGETS: Record<
  PerformanceMicroKey,
  { goal: number; unit: string; label: string; ceiling?: boolean }
> = {
  fiberG: { goal: 30, unit: "g", label: "Fibra" },
  sodiumMg: { goal: 2000, unit: "mg", label: "Sódio", ceiling: true },
  ironMg: { goal: 14, unit: "mg", label: "Ferro" },
  vitaminDUcg: { goal: 15, unit: "µg", label: "Vitamina D" },
};

export type DayMicroLine = {
  key: string;
  label: string;
  value: number;
  unit: string;
  goal?: number;
  ceiling?: boolean;
};

function collectExtras(item: MealItemEntry | undefined, acc: Record<string, { value: number; unit: string }>) {
  if (!item) return;
  const extras = item.nutrientSnapshot?.extras;
  if (!extras) return;
  for (const [k, v] of Object.entries(extras)) {
    if (!v || v.value <= 0) continue;
    const prev = acc[k];
    acc[k] = { value: (prev?.value ?? 0) + v.value, unit: v.unit || prev?.unit || "" };
  }
}

/** Sum extras from logged meal items. Returns null when nothing to show (no empty micros UI). */
export function dayMicrosFromMeals(meals: MealEntry[]): DayMicroLine[] | null {
  const acc: Record<string, { value: number; unit: string }> = {};
  for (const meal of meals) {
    for (const item of meal.items ?? []) collectExtras(item, acc);
    const mealExtras = meal.nutrientSnapshot?.extras;
    if (mealExtras) {
      for (const [k, v] of Object.entries(mealExtras)) {
        if (!v || v.value <= 0) continue;
        const prev = acc[k];
        acc[k] = { value: (prev?.value ?? 0) + v.value, unit: v.unit || prev?.unit || "" };
      }
    }
  }
  const lines = Object.entries(acc)
    .filter(([, v]) => v.value > 0)
    .map(([key, v]) => ({
      key,
      label: MICRO_LABELS_PT[key] ?? key,
      value: round1(v.value),
      unit: v.unit,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  return lines.length ? lines : null;
}

/**
 * Performance micros only: fiber, sodium, iron, vitamin D.
 * Always returns 4 lines when meals.length > 0; never leaks other micros.
 */
export function dayPerformanceMicros(meals: MealEntry[]): DayMicroLine[] | null {
  if (!meals.length) return null;

  const acc: Record<PerformanceMicroKey, number> = {
    fiberG: 0,
    sodiumMg: 0,
    ironMg: 0,
    vitaminDUcg: 0,
  };

  for (const meal of meals) {
    if (meal.items?.length) {
      for (const item of meal.items) {
        const snap = item.nutrientSnapshot;
        acc.fiberG += snap?.fiberG ?? 0;
        acc.sodiumMg += snap?.sodiumMg ?? 0;
        acc.ironMg += snap?.extras?.ironMg?.value ?? 0;
        acc.vitaminDUcg += snap?.extras?.vitaminDUcg?.value ?? 0;
      }
    } else {
      acc.fiberG += meal.fiberG ?? meal.nutrientSnapshot?.fiberG ?? 0;
      acc.sodiumMg += meal.nutrientSnapshot?.sodiumMg ?? 0;
      acc.ironMg += meal.nutrientSnapshot?.extras?.ironMg?.value ?? 0;
      acc.vitaminDUcg += meal.nutrientSnapshot?.extras?.vitaminDUcg?.value ?? 0;
    }
  }

  return PERFORMANCE_MICRO_KEYS.map((key) => {
    const meta = PERFORMANCE_MICRO_TARGETS[key];
    return {
      key,
      label: meta.label,
      value: round1(acc[key]),
      unit: meta.unit,
      goal: meta.goal,
      ...(meta.ceiling ? { ceiling: true } : {}),
    };
  });
}
