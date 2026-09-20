/**
 * Barcode / EAN helpers (Fase 13). Local catalog first; OFF mapping is pure.
 */
import { allFoods, defaultServing, foodByEan } from "@/lib/nutrition/food-catalog";
import { qualityFromMacros, scaleMacros } from "@/lib/nutrition/nutrients";
import type {
  FoodItem,
  FoodSource,
  MacroSnapshot,
  MealItem,
  MealItemNutrientSnapshot,
  MicroKey,
  NutrientKind,
  NutrientValue,
} from "@/lib/nutrition/types";

export function parseEan(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8 || digits.length === 13 || digits.length === 12) return digits;
  return null;
}

export type OffNutriments = Record<string, number | string | undefined>;

export type BarcodeHit = {
  ean: string;
  name: string;
  brand?: string;
  grams: number;
  per100g: MacroSnapshot;
  source: FoodSource;
  kind: NutrientKind;
  confidence: number;
  foodId?: string;
  found: true;
};

const MICRO_OFF: Array<{ off: string; key: MicroKey; unit: string; scale: number }> = [
  { off: "iron_100g", key: "ironMg", unit: "mg", scale: 1000 },
  { off: "calcium_100g", key: "calciumMg", unit: "mg", scale: 1000 },
  { off: "magnesium_100g", key: "magnesiumMg", unit: "mg", scale: 1000 },
  { off: "zinc_100g", key: "zincMg", unit: "mg", scale: 1000 },
  { off: "potassium_100g", key: "potassiumMg", unit: "mg", scale: 1 },
  { off: "vitamin-a_100g", key: "vitaminAUcg", unit: "µg", scale: 1e6 },
  { off: "vitamin-c_100g", key: "vitaminCMg", unit: "mg", scale: 1000 },
  { off: "vitamin-d_100g", key: "vitaminDUcg", unit: "µg", scale: 1e6 },
  { off: "vitamin-b12_100g", key: "vitaminB12Ucg", unit: "µg", scale: 1e6 },
];

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function offVal(n: OffNutriments, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = num(n[k]);
    if (v != null) return v;
  }
  return null;
}

export function mapOffNutriments(n: OffNutriments): { macros: MacroSnapshot; complete: boolean } {
  const energy = offVal(n, "energy-kcal_100g", "energy-kcal", "energy_kcal_100g") ?? 0;
  const protein = offVal(n, "proteins_100g", "proteins") ?? 0;
  const carb = offVal(n, "carbohydrates_100g", "carbohydrates") ?? 0;
  const fat = offVal(n, "fat_100g", "fat") ?? 0;
  const fiber = offVal(n, "fiber_100g", "fiber");
  const sugar = offVal(n, "sugars_100g", "sugars");
  const sodiumG = offVal(n, "sodium_100g", "sodium");
  const complete = energy > 0 && (protein > 0 || carb > 0 || fat > 0);

  const extras: Record<string, NutrientValue> = {};
  for (const m of MICRO_OFF) {
    const raw = offVal(n, m.off);
    if (raw == null || raw <= 0) continue;
    const value = Math.round(raw * m.scale * 1000) / 1000;
    if (value <= 0) continue;
    extras[m.key] = {
      key: m.key,
      value,
      unit: m.unit,
      source: "imported",
      kind: "estimated",
      confidence: 0.6,
    };
  }

  const macros: MacroSnapshot = {
    energyKcal: Math.round(energy),
    proteinG: Math.round(protein * 10) / 10,
    carbG: Math.round(carb * 10) / 10,
    fatG: Math.round(fat * 10) / 10,
  };
  if (fiber != null) macros.fiberG = Math.round(fiber * 10) / 10;
  if (sugar != null) macros.sugarG = Math.round(sugar * 10) / 10;
  if (sodiumG != null) macros.sodiumMg = Math.round(sodiumG * 1000);
  if (Object.keys(extras).length) macros.extras = extras;
  return { macros, complete };
}

export function lookupLocalBarcode(ean: string): BarcodeHit | null {
  const parsed = parseEan(ean);
  if (!parsed) return null;
  const food = foodByEan(parsed) ?? allFoods(false).find((f) => f.ean && parseEan(f.ean) === parsed);
  if (!food) return null;
  const serving = defaultServing(food.id);
  const grams = serving?.gramsEquivalent ?? 100;
  const hit: BarcodeHit = {
    ean: parsed,
    name: food.name,
    grams,
    per100g: food.per100g,
    source: food.source,
    kind: food.source === "internal" || food.source === "taco" ? "observed" : "derived",
    confidence: food.confidence,
    foodId: food.id,
    found: true,
  };
  if (food.brand) hit.brand = food.brand;
  return hit;
}

/** Local catalog EAN wins over Open Food Facts. */
export function resolveBarcodeHit(
  ean: string,
  offProduct?: Parameters<typeof barcodeHitFromOffProduct>[1],
): BarcodeHit | null {
  const local = lookupLocalBarcode(ean);
  if (local) return local;
  if (offProduct) return barcodeHitFromOffProduct(ean, offProduct);
  return null;
}

export function barcodeHitFromOffProduct(
  ean: string,
  product: { product_name?: string; brands?: string; nutriments?: OffNutriments; serving_quantity?: number | string },
): BarcodeHit | null {
  const parsed = parseEan(ean);
  if (!parsed) return null;
  const name = String(product.product_name ?? "").trim();
  if (!name) return null;
  const { macros, complete } = mapOffNutriments(product.nutriments ?? {});
  const gramsRaw = num(product.serving_quantity);
  const grams = gramsRaw && gramsRaw > 0 && gramsRaw < 2000 ? gramsRaw : 100;
  const hit: BarcodeHit = {
    ean: parsed,
    name,
    grams,
    per100g: macros,
    source: "imported",
    kind: complete ? "derived" : "estimated",
    confidence: complete ? 0.7 : 0.5,
    found: true,
  };
  const brand = String(product.brands ?? "").split(",")[0]?.trim();
  if (brand) hit.brand = brand;
  return hit;
}

export function mealItemFromBarcode(hit: BarcodeHit): MealItem {
  const macros = scaleMacros(hit.per100g, hit.grams / 100);
  const snapshot: MealItemNutrientSnapshot = {
    ...macros,
    capturedAt: new Date().toISOString(),
    source: hit.source,
    kind: hit.kind,
    confidence: hit.confidence,
  };
  return {
    foodId: hit.foodId ?? `ean:${hit.ean}`,
    foodName: hit.name,
    quantity: 1,
    unit: `${Math.round(hit.grams)} g`,
    grams: hit.grams,
    nutrientSnapshot: snapshot,
    confidence: hit.confidence,
    sourceKind: hit.kind === "estimated" ? "estimated" : "informed",
    foodSource: hit.source,
  };
}

export function mealFromBarcode(hit: BarcodeHit) {
  const item = mealItemFromBarcode(hit);
  const m = item.nutrientSnapshot;
  return {
    label: hit.brand ? `${hit.name} · ${hit.brand}` : hit.name,
    proteinG: Math.round(m.proteinG),
    kcal: Math.round(m.energyKcal),
    carbG: Math.round(m.carbG),
    fatG: Math.round(m.fatG),
    fiberG: Math.round(m.fiberG ?? 0),
    quality: qualityFromMacros(m.proteinG, m.energyKcal),
    items: [item],
    sourceKind: item.sourceKind,
    foodSource: hit.source,
    confidence: hit.confidence,
  };
}

export function foodHasEan(food: FoodItem, ean: string): boolean {
  return Boolean(food.ean && parseEan(food.ean) === parseEan(ean));
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
    };
  }
}
