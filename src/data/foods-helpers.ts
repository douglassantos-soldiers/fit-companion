/**
 * Shared food seed helpers — lote 1 + lote 2.
 * Internal macros only; no licensed TACO rows.
 */
import type {
  FoodCategory,
  FoodItem,
  FoodServing,
  MacroSnapshot,
  NutrientValue,
} from "@/lib/nutrition/types";

export const INTERNAL_SOURCE_VERSION = "soldiers-internal-v1";

export type FoodDef = {
  id: string;
  name: string;
  category: FoodCategory;
  synonyms?: string[];
  brand?: string;
  /** Real GTIN/EAN when known — never invent. */
  ean?: string;
  /** per 100g */
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  /** Performance micros per 100g (optional curated) */
  ironMg?: number;
  vitaminDUcg?: number;
  servings?: Array<{ id: string; label: string; grams: number; isDefault?: boolean }>;
  confidence?: number;
  sourceVersion?: string;
};

function microExtra(
  key: "ironMg" | "vitaminDUcg",
  value: number,
  unit: string,
): NutrientValue {
  return {
    key,
    value,
    unit,
    source: "internal",
    kind: "observed",
    confidence: 0.8,
  };
}

export function per100(d: FoodDef): MacroSnapshot {
  const out: MacroSnapshot = {
    energyKcal: d.kcal,
    proteinG: d.proteinG,
    carbG: d.carbG,
    fatG: d.fatG,
    ...(d.fiberG != null ? { fiberG: d.fiberG } : {}),
    ...(d.sugarG != null ? { sugarG: d.sugarG } : {}),
    ...(d.sodiumMg != null ? { sodiumMg: d.sodiumMg } : {}),
  };
  const extras: Record<string, NutrientValue> = {};
  if (d.ironMg != null && d.ironMg > 0) extras.ironMg = microExtra("ironMg", d.ironMg, "mg");
  if (d.vitaminDUcg != null && d.vitaminDUcg > 0) {
    extras.vitaminDUcg = microExtra("vitaminDUcg", d.vitaminDUcg, "µg");
  }
  if (Object.keys(extras).length) out.extras = extras;
  return out;
}

export function toFood(d: FoodDef): FoodItem {
  const defaultServing = d.servings?.find((s) => s.isDefault) ?? d.servings?.[0];
  const item: FoodItem = {
    id: d.id,
    name: d.name,
    category: d.category,
    source: "internal",
    servingReference: defaultServing?.id ?? "s-100g",
    active: true,
    confidence: d.confidence ?? 0.85,
    per100g: per100(d),
  };
  if (d.brand) item.brand = d.brand;
  if (d.ean) item.ean = d.ean.replace(/\D/g, "");
  if (d.synonyms?.length) item.synonyms = d.synonyms;
  if (d.sourceVersion) item.sourceVersion = d.sourceVersion;
  return item;
}

export function toServings(d: FoodDef): FoodServing[] {
  const list = d.servings?.length
    ? d.servings
    : [{ id: "s-100g", label: "100 g", grams: 100, isDefault: true as const }];
  return list.map((s) => {
    const serving: FoodServing = {
      id: `${d.id}:${s.id}`,
      foodId: d.id,
      label: s.label,
      gramsEquivalent: s.grams,
    };
    if (s.isDefault) serving.isDefault = true;
    return serving;
  });
}
