/**
 * Deterministic PT-BR voice/text food parsing.
 * Does not invent brand or quantity when not stated.
 */
import { searchFoods } from "@/lib/nutrition/food-search";
import { buildMealItem } from "@/lib/nutrition/meal-builder";
import type { MealItem } from "@/lib/nutrition/types";

export type VoiceParseCandidate = {
  raw: string;
  foodId?: string;
  foodName?: string;
  quantity?: number;
  unit?: string;
  grams?: number;
  confidence: number;
  matched: boolean;
};

export type VoiceParseResult = {
  text: string;
  candidates: VoiceParseCandidate[];
  items: MealItem[];
  overallConfidence: number;
  needsConfirmation: boolean;
};

const SEGMENT_SPLIT = /\s*(?:,|;|\be\b|\bmais\b|\bcom\b)\s*/i;

/** Patterns: "150g de arroz", "180 g frango", "uma banana", "2 colheres de aveia" */
const QTY_FOOD =
  /^(?:(\d+(?:[.,]\d+)?)\s*(g|kg|ml|colher(?:es)?(?:\s+de\s+sopa)?|x[ií]cara(?:s)?|fatia(?:s)?|unidade(?:s)?|un|scoop(?:s)?|pote(?:s)?|copo(?:s)?|prato(?:s)?|fil[eé](?:s)?)?\s*(?:de\s+)?(.+)|(?:(uma?|dois|duas|um)\s+)(.+))$/i;

const WORD_QTY: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
};

function parseSegment(raw: string): VoiceParseCandidate {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { raw, confidence: 0, matched: false };
  }

  let quantity: number | undefined;
  let unit: string | undefined;
  let foodQuery: string | undefined;

  const m = trimmed.match(QTY_FOOD);
  if (m) {
    if (m[1] != null) {
      quantity = Number(String(m[1]).replace(",", "."));
      unit = (m[2] ?? "g").toLowerCase();
      foodQuery = m[3]?.trim();
    } else if (m[4] != null) {
      quantity = WORD_QTY[m[4].toLowerCase()] ?? 1;
      unit = "unidade";
      foodQuery = m[5]?.trim();
    }
  } else {
    foodQuery = trimmed;
  }

  if (!foodQuery) {
    return { raw: trimmed, confidence: 0.1, matched: false };
  }

  const hits = searchFoods(foodQuery, { limit: 3 });
  const best = hits[0];
  if (!best || best.score < 50) {
    const miss: VoiceParseCandidate = {
      raw: trimmed,
      foodName: foodQuery,
      confidence: 0.25,
      matched: false,
    };
    if (quantity != null) miss.quantity = quantity;
    if (unit) miss.unit = unit;
    return miss;
  }

  const hasQty = quantity != null && quantity > 0;
  const resolvedUnit = unit ?? (hasQty ? "g" : best.serving.label);
  const resolvedQty = hasQty ? quantity! : 1;

  const confidence = hasQty
    ? Math.min(0.95, 0.55 + best.score / 200)
    : Math.min(0.55, 0.35 + best.score / 300);

  const hit: VoiceParseCandidate = {
    raw: trimmed,
    foodId: best.food.id,
    foodName: best.food.name,
    quantity: resolvedQty,
    unit: hasQty ? resolvedUnit : best.serving.label,
    confidence,
    matched: true,
  };
  if (hasQty && (unit === "g" || unit === "kg" || unit === "ml" || !unit)) {
    hit.grams = unit === "kg" ? resolvedQty * 1000 : resolvedQty;
  } else if (!hasQty) {
    hit.grams = best.serving.gramsEquivalent;
  }
  return hit;
}

export function parseVoiceFoodText(text: string): VoiceParseResult {
  const cleaned = text.trim().slice(0, 2000);
  const segments = cleaned
    .split(SEGMENT_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);

  const candidates = segments.map(parseSegment);
  const items: MealItem[] = [];

  for (const c of candidates) {
    if (!c.matched || !c.foodId || c.quantity == null || !c.unit) continue;
    const opts: Parameters<typeof buildMealItem>[0] = {
      foodId: c.foodId,
      quantity: c.quantity,
      unit: c.unit,
      confidence: c.confidence,
      sourceKind: "estimated",
      foodSource: "ai_estimate",
      kind: "estimated",
    };
    if (c.grams != null) opts.grams = c.grams;
    const item = buildMealItem(opts);
    if (item) items.push(item);
  }

  const confidences = candidates.map((c) => c.confidence);
  const overallConfidence =
    confidences.length > 0
      ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100
      : 0;

  const unmatched = candidates.some((c) => !c.matched);
  const lowConf = overallConfidence < 0.7;
  const missingQty = candidates.some(
    (c) => c.matched && c.raw && !/\d/.test(c.raw) && !/^(uma?|dois|duas|um)\s/i.test(c.raw.trim()),
  );

  return {
    text: cleaned,
    candidates,
    items,
    overallConfidence,
    needsConfirmation: unmatched || lowConf || missingQty || items.length === 0,
  };
}
