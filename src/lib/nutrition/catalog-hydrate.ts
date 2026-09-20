/**
 * Map CMS/DB food rows onto domain FoodItem (TACO hydrate). Pure — no I/O.
 */
import type { FoodCategory, FoodItem, FoodServing, FoodSource, NutrientValue } from "@/lib/nutrition/types";

const CATEGORIES = new Set<FoodCategory>([
  "cereais",
  "tuberculos",
  "leguminosas",
  "hortalicas",
  "frutas",
  "carnes",
  "aves",
  "peixes",
  "ovos",
  "laticinios",
  "oleaginosas",
  "oleos",
  "bebidas",
  "industrializados",
  "suplementos",
  "outros",
]);

const MACRO_KEYS = new Set(["energyKcal", "proteinG", "carbG", "fatG", "fiberG", "sugarG", "sodiumMg"]);

function asCategory(raw: unknown): FoodCategory {
  const s = String(raw ?? "outros");
  return CATEGORIES.has(s as FoodCategory) ? (s as FoodCategory) : "outros";
}

function asSource(raw: unknown): FoodSource {
  if (raw === "taco" || raw === "user" || raw === "imported" || raw === "ai_estimate" || raw === "internal") {
    return raw;
  }
  return "imported";
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

export function extrasFromNutrientRows(
  rows: Array<{ nutrient_key?: string; value?: number; unit?: string; source?: string; kind?: string; confidence?: number }>,
  foodSource: FoodSource,
): Record<string, NutrientValue> | undefined {
  const extras: Record<string, NutrientValue> = {};
  for (const row of rows) {
    const key = String(row.nutrient_key ?? "");
    if (!key || MACRO_KEYS.has(key)) continue;
    const value = num(row.value);
    if (value == null || value <= 0) continue;
    extras[key] = {
      key,
      value,
      unit: String(row.unit ?? ""),
      source: asSource(row.source ?? foodSource),
      kind: row.kind === "estimated" || row.kind === "derived" ? row.kind : "observed",
      confidence: typeof row.confidence === "number" ? row.confidence : 0.8,
    };
  }
  return Object.keys(extras).length ? extras : undefined;
}

export function foodItemFromCatalogRow(
  row: Record<string, unknown>,
  extras?: Record<string, NutrientValue>,
): FoodItem | null {
  const id = String(row["id"] ?? "").trim();
  const name = String(row["name"] ?? "").trim();
  if (!id || !name) return null;
  const perRaw = row["per100g"] && typeof row["per100g"] === "object" ? (row["per100g"] as Record<string, unknown>) : {};
  const food: FoodItem = {
    id,
    name,
    category: asCategory(row["category"]),
    source: asSource(row["source"]),
    servingReference: String(row["serving_reference"] ?? "s-100g"),
    active: row["active"] !== false,
    confidence: typeof row["confidence"] === "number" ? row["confidence"] : 0.8,
    per100g: {
      energyKcal: num(perRaw["energyKcal"]) ?? 0,
      proteinG: num(perRaw["proteinG"]) ?? 0,
      carbG: num(perRaw["carbG"]) ?? 0,
      fatG: num(perRaw["fatG"]) ?? 0,
    },
  };
  const brand = String(row["brand"] ?? "").trim();
  if (brand) food.brand = brand;
  const ean = String(row["ean"] ?? "").trim();
  if (ean) food.ean = ean;
  if (Array.isArray(row["synonyms"])) food.synonyms = (row["synonyms"] as unknown[]).map(String);
  const fiber = num(perRaw["fiberG"]);
  if (fiber != null) food.per100g.fiberG = fiber;
  const sugar = num(perRaw["sugarG"]);
  if (sugar != null) food.per100g.sugarG = sugar;
  const sodium = num(perRaw["sodiumMg"]);
  if (sodium != null) food.per100g.sodiumMg = sodium;
  if (extras) food.per100g.extras = extras;
  return food;
}

export function servingFromCatalogRow(row: Record<string, unknown>): FoodServing | null {
  const id = String(row["id"] ?? "").trim();
  const foodId = String(row["food_id"] ?? "").trim();
  const label = String(row["label"] ?? "").trim();
  const grams = num(row["grams_equivalent"]);
  if (!id || !foodId || !label || grams == null || grams <= 0) return null;
  const serving: FoodServing = { id, foodId, label, gramsEquivalent: grams };
  if (row["is_default"] === true) serving.isDefault = true;
  return serving;
}
