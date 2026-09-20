/**
 * Meal builder — MealItem from FoodItem + quantity, nutrient snapshots.
 */
import { foodById } from "@/lib/nutrition/food-catalog";
import { resolveGrams } from "@/lib/nutrition/food-serving";
import { qualityFromMacros, scaleMacros, sumMacros } from "@/lib/nutrition/nutrients";
import type {
  FoodSource,
  MacroSnapshot,
  MealItem,
  MealItemNutrientSnapshot,
  NutrientKind,
} from "@/lib/nutrition/types";

export function buildMealItem(opts: {
  foodId: string;
  quantity: number;
  unit: string;
  grams?: number;
  confidence?: number;
  sourceKind?: "informed" | "estimated";
  foodSource?: FoodSource;
  kind?: NutrientKind;
}): MealItem | null {
  const food = foodById(opts.foodId);
  if (!food) return null;

  const resolved = opts.grams != null
    ? { grams: opts.grams }
    : resolveGrams(opts.foodId, opts.quantity, opts.unit);

  const macros = scaleMacros(food.per100g, resolved.grams / 100);
  const source: FoodSource = opts.foodSource ?? (opts.sourceKind === "estimated" ? "ai_estimate" : food.source);
  const kind: NutrientKind =
    opts.kind ?? (source === "ai_estimate" ? "estimated" : source === "internal" || source === "taco" ? "observed" : "derived");
  const confidence = opts.confidence ?? (kind === "estimated" ? 0.55 : food.confidence);

  // Never treat AI estimate as observed
  const safeKind: NutrientKind = source === "ai_estimate" ? "estimated" : kind;

  const nutrientSnapshot: MealItemNutrientSnapshot = {
    ...macros,
    capturedAt: new Date().toISOString(),
    source,
    kind: safeKind,
    confidence,
  };

  return {
    foodId: food.id,
    foodName: food.name,
    quantity: opts.quantity,
    unit: opts.unit,
    grams: Math.round(resolved.grams * 10) / 10,
    nutrientSnapshot,
    confidence,
    sourceKind: opts.sourceKind ?? (safeKind === "estimated" ? "estimated" : "informed"),
    foodSource: source,
  };
}

export function mealItemsMacros(items: MealItem[]): MacroSnapshot {
  return sumMacros(items.map((i) => i.nutrientSnapshot));
}

export function mealFromItems(
  items: MealItem[],
  label?: string,
): {
  label: string;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG: number;
  kcal: number;
  quality: "verde" | "amarelo" | "laranja";
  items: MealItem[];
  nutrientSnapshot: MealItemNutrientSnapshot;
  confidence: number;
  sourceKind: "informed" | "estimated";
} {
  const macros = mealItemsMacros(items);
  const confidences = items.map((i) => i.confidence);
  const confidence =
    confidences.length > 0
      ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100
      : 1;
  const anyEstimated = items.some((i) => i.sourceKind === "estimated" || i.foodSource === "ai_estimate");
  const minConf = confidences.length ? Math.min(...confidences) : 1;
  const kind: NutrientKind = anyEstimated ? "estimated" : "observed";
  const source: FoodSource = anyEstimated ? "ai_estimate" : "internal";

  const names = items.map((i) => i.foodName ?? i.foodId).filter(Boolean);
  const autoLabel =
    names.length === 0
      ? "Refeição"
      : names.length <= 3
        ? names.join(", ")
        : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;

  return {
    label: label?.trim() || autoLabel,
    proteinG: Math.round(macros.proteinG),
    carbG: Math.round(macros.carbG),
    fatG: Math.round(macros.fatG),
    fiberG: Math.round(macros.fiberG ?? 0),
    kcal: Math.round(macros.energyKcal),
    quality: qualityFromMacros(macros.proteinG, macros.energyKcal),
    items,
    nutrientSnapshot: {
      ...macros,
      capturedAt: new Date().toISOString(),
      source,
      kind,
      confidence: minConf,
    },
    confidence: anyEstimated ? Math.min(confidence, minConf) : 1,
    sourceKind: anyEstimated ? "estimated" : "informed",
  };
}
