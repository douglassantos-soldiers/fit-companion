/**
 * Nutrition Intelligence domain types (Phase 2).
 * Catalog + meal composition — independent of AppState MealEntry facade.
 */

export type FoodSource = "taco" | "user" | "imported" | "ai_estimate" | "internal";
export type NutrientKind = "observed" | "derived" | "estimated";

export type MacroKey =
  | "energyKcal"
  | "proteinG"
  | "carbG"
  | "fatG"
  | "fiberG"
  | "sugarG"
  | "sodiumMg";

export type MicroKey =
  | "ironMg"
  | "calciumMg"
  | "magnesiumMg"
  | "zincMg"
  | "potassiumMg"
  | "vitaminAUcg"
  | "vitaminCMg"
  | "vitaminDUcg"
  | "vitaminB12Ucg";

export type NutrientKey = MacroKey | MicroKey | string;

export interface NutrientValue {
  key: NutrientKey;
  value: number;
  unit: string;
  source: FoodSource;
  kind: NutrientKind;
  confidence: number;
}

export interface MacroSnapshot {
  energyKcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  /** Extensible micros / fatty acids / amino acids */
  extras?: Record<string, NutrientValue>;
}

export type FoodCategory =
  | "cereais"
  | "tuberculos"
  | "leguminosas"
  | "hortalicas"
  | "frutas"
  | "carnes"
  | "aves"
  | "peixes"
  | "ovos"
  | "laticinios"
  | "oleaginosas"
  | "oleos"
  | "bebidas"
  | "industrializados"
  | "suplementos"
  | "outros";

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  category: FoodCategory;
  source: FoodSource;
  /** Default serving id or label reference */
  servingReference: string;
  active: boolean;
  confidence: number;
  synonyms?: string[];
  /** GTIN/EAN when known (internal match before Open Food Facts) */
  ean?: string;
  /** Nutrients per 100 g (canonical) */
  per100g: MacroSnapshot;
}

export interface FoodServing {
  id: string;
  foodId: string;
  label: string;
  gramsEquivalent: number;
  isDefault?: boolean;
}

export interface MealItemNutrientSnapshot extends MacroSnapshot {
  capturedAt: string;
  source: FoodSource;
  kind: NutrientKind;
  confidence: number;
}

export interface MealItem {
  id?: string;
  foodId: string;
  foodName?: string;
  quantity: number;
  unit: string;
  grams: number;
  nutrientSnapshot: MealItemNutrientSnapshot;
  confidence: number;
  sourceKind: "informed" | "estimated";
  foodSource?: FoodSource;
}

export interface RecipeItem {
  foodId: string;
  quantity: number;
  unit: string;
  grams: number;
}

export type RecipeDifficulty = "facil" | "medio" | "dificil";

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  prepMinutes?: number;
  cookMinutes?: number;
  difficulty?: RecipeDifficulty;
  items: RecipeItem[];
  /** Aggregated macros for the full recipe (before /servings) */
  totalMacros: MacroSnapshot;
  tags?: string[];
  source: FoodSource;
}

export interface FoodSearchHit {
  food: FoodItem;
  serving: FoodServing;
  summary: MacroSnapshot;
  score: number;
}
