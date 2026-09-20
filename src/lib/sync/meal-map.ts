/**
 * Shared meal_entries ↔ MealEntry mapping (Phase 2 macros + items).
 */
import type {
  FoodLineageSource,
  MealEntry,
  MealItemEntry,
  MealNutrientSnapshot,
  MealQuality,
  MealSlot,
  MealSourceKind,
} from "@/lib/types";

type Row = Record<string, unknown>;

const LINEAGE: FoodLineageSource[] = ["taco", "user", "imported", "ai_estimate", "internal"];

function asLineage(v: unknown): FoodLineageSource | undefined {
  return typeof v === "string" && LINEAGE.includes(v as FoodLineageSource)
    ? (v as FoodLineageSource)
    : undefined;
}

function mapNutrientSnapshot(raw: unknown): MealNutrientSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  const source = asLineage(s["source"]) ?? "internal";
  const kind =
    s["kind"] === "observed" || s["kind"] === "derived" || s["kind"] === "estimated"
      ? s["kind"]
      : "derived";
  const snap: MealNutrientSnapshot = {
    energyKcal: Number(s["energyKcal"] ?? 0),
    proteinG: Number(s["proteinG"] ?? 0),
    carbG: Number(s["carbG"] ?? 0),
    fatG: Number(s["fatG"] ?? 0),
    capturedAt: String(s["capturedAt"] ?? new Date().toISOString()),
    source,
    kind,
    confidence: Number(s["confidence"] ?? 1),
  };
  if (s["fiberG"] != null) snap.fiberG = Number(s["fiberG"]);
  if (s["sugarG"] != null) snap.sugarG = Number(s["sugarG"]);
  if (s["sodiumMg"] != null) snap.sodiumMg = Number(s["sodiumMg"]);
  return snap;
}

function mapMealItem(raw: unknown): MealItemEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const i = raw as Record<string, unknown>;
  const snapshot = mapNutrientSnapshot(i["nutrientSnapshot"]);
  if (!snapshot || typeof i["foodId"] !== "string") return null;
  const item: MealItemEntry = {
    foodId: i["foodId"],
    quantity: Number(i["quantity"] ?? 1),
    unit: String(i["unit"] ?? "g"),
    grams: Number(i["grams"] ?? 0),
    nutrientSnapshot: snapshot,
    confidence: Number(i["confidence"] ?? 1),
    sourceKind: i["sourceKind"] === "estimated" ? "estimated" : "informed",
  };
  if (typeof i["id"] === "string") item.id = i["id"];
  if (typeof i["foodName"] === "string") item.foodName = i["foodName"];
  const fs = asLineage(i["foodSource"]);
  if (fs) item.foodSource = fs;
  return item;
}

export function mapMealEntryRow(row: Row): MealEntry {
  const payload = (row["payload"] as Record<string, unknown> | null) ?? {};
  const entry: MealEntry = {
    id: String(row["client_id"] || row["id"] || crypto.randomUUID()),
    date: String(row["date"] ?? ""),
    slot: (payload["slot"] as MealSlot) || ((row["meal_type"] as MealSlot) ?? "almoco"),
    label: String(row["name"] || payload["label"] || "Refeição"),
    proteinG: Number(row["protein_g"] ?? payload["proteinG"] ?? 0),
    kcal: Number(row["kcal"] ?? payload["kcal"] ?? 0),
    quality: (payload["quality"] as MealQuality) ?? "amarelo",
  };
  const carb = row["carbs_g"] ?? payload["carbG"];
  const fat = row["fat_g"] ?? payload["fatG"];
  const fiber = row["fiber_g"] ?? payload["fiberG"];
  if (carb != null) entry.carbG = Number(carb);
  if (fat != null) entry.fatG = Number(fat);
  if (fiber != null) entry.fiberG = Number(fiber);

  if (typeof payload["presetId"] === "string") entry.presetId = payload["presetId"];
  if (typeof payload["servings"] === "number") entry.servings = payload["servings"];
  if (payload["sourceKind"] === "informed" || payload["sourceKind"] === "estimated") {
    entry.sourceKind = payload["sourceKind"] as MealSourceKind;
  }
  if (typeof payload["confidence"] === "number") entry.confidence = payload["confidence"];
  if (payload["aiMode"] === "photo" || payload["aiMode"] === "voice" || payload["aiMode"] === "text") {
    entry.aiMode = payload["aiMode"];
  }
  if (payload["correctedFromAi"] === true) entry.correctedFromAi = true;
  if (typeof row["version"] === "number") entry.version = row["version"];

  const itemsRaw = payload["items"];
  if (Array.isArray(itemsRaw)) {
    const items = itemsRaw.map(mapMealItem).filter((x): x is MealItemEntry => Boolean(x));
    if (items.length) entry.items = items;
  }
  const snap = mapNutrientSnapshot(payload["nutrientSnapshot"]);
  if (snap) entry.nutrientSnapshot = snap;
  const fs = asLineage(payload["foodSource"]);
  if (fs) entry.foodSource = fs;

  return entry;
}

export function mealEntryToDbPayload(m: MealEntry) {
  return {
    slot: m.slot,
    label: m.label,
    quality: m.quality,
    presetId: m.presetId,
    servings: m.servings,
    proteinG: m.proteinG,
    kcal: m.kcal,
    carbG: m.carbG,
    fatG: m.fatG,
    fiberG: m.fiberG,
    sourceKind: m.sourceKind,
    confidence: m.confidence,
    aiMode: m.aiMode,
    correctedFromAi: m.correctedFromAi,
    items: m.items,
    nutrientSnapshot: m.nutrientSnapshot,
    foodSource: m.foodSource,
  };
}

export function mealItemsToRows(
  meals: MealEntry[],
  channel: { user_id: string; device_id: string },
) {
  const rows: Array<Record<string, unknown>> = [];
  for (const m of meals) {
    for (const [idx, item] of (m.items ?? []).entries()) {
      const clientId = item.id ?? `${m.id}:item:${idx}`;
      rows.push({
        ...channel,
        client_id: clientId,
        meal_client_id: m.id,
        food_id: item.foodId,
        food_name: item.foodName ?? null,
        quantity: item.quantity,
        unit: item.unit,
        grams: item.grams,
        nutrient_snapshot: item.nutrientSnapshot,
        confidence: item.confidence,
        source: item.foodSource ?? (item.sourceKind === "estimated" ? "ai_estimate" : "internal"),
        source_kind: item.sourceKind,
        version: m.version ?? 1,
        updated_at: new Date().toISOString(),
      });
    }
  }
  return rows;
}
