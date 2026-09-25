/** Pure meal-AI input/output helpers (safe for unit tests without createServerFn). */

import type { MealQuality, MealSlot } from "@/lib/types";

const MAX_B64 = 4_500_000; // ~3.3MB binary
const MAX_TEXT = 2000;
const CONFIRM_THRESHOLD = 0.7;

export type MealAiMode = "photo" | "voice" | "text";

export interface MealAiInput {
  mode: MealAiMode;
  slot: MealSlot;
  /** Device canal — required for resolveTrustedIdentity (never trust client userId). */
  deviceId: string;
  /** Base64 without data-URL prefix for photo/voice */
  mediaBase64?: string;
  mimeType?: string;
  /** Free-text description (or Whisper transcript) */
  text?: string;
}

export interface MealAiCandidate {
  foodId?: string;
  name: string;
  quantity?: number;
  unit?: string;
  grams?: number;
  proteinG?: number;
  carbG?: number;
  fatG?: number;
  fiberG?: number;
  kcal?: number;
  confidence: number;
}

export interface MealAiSuggestion {
  label: string;
  proteinG: number;
  kcal: number;
  carbG?: number;
  fatG?: number;
  fiberG?: number;
  quality: MealQuality;
  confidence: number;
  notes?: string;
  candidates?: MealAiCandidate[];
  needsConfirmation?: boolean;
}

export type MealAiError =
  "unauthorized" | "rate_limited" | "not_configured" | "upstream" | "invalid";

const SLOTS: MealSlot[] = ["cafe", "almoco", "lanche", "jantar"];
const QUALITIES: MealQuality[] = ["verde", "amarelo", "laranja"];

export function parseMealAiInput(input: unknown): MealAiInput {
  const value = input as Partial<MealAiInput> | null;
  if (!value || (value.mode !== "photo" && value.mode !== "voice" && value.mode !== "text")) {
    throw new Error("Modo inválido");
  }
  if (!value.slot || !SLOTS.includes(value.slot)) {
    throw new Error("Slot inválido");
  }
  const deviceId = String(value.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) {
    throw new Error("deviceId inválido");
  }

  if (value.mode === "text") {
    const text = String(value.text ?? "")
      .trim()
      .slice(0, MAX_TEXT);
    if (!text) throw new Error("Texto ausente");
    return { mode: "text", slot: value.slot, deviceId, text };
  }

  const mediaBase64 = String(value.mediaBase64 ?? "").replace(/^data:[^;]+;base64,/, "");
  if (!mediaBase64 || mediaBase64.length > MAX_B64) {
    throw new Error("Mídia inválida ou muito grande");
  }
  const mimeType =
    value.mode === "photo"
      ? String(value.mimeType ?? "image/jpeg").slice(0, 80)
      : String(value.mimeType ?? "audio/webm").slice(0, 80);

  return {
    mode: value.mode,
    slot: value.slot,
    deviceId,
    mediaBase64,
    mimeType,
    ...(value.text ? { text: String(value.text).slice(0, MAX_TEXT) } : {}),
  };
}

function parseCandidate(raw: unknown): MealAiCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const name = String(c["name"] ?? "")
    .trim()
    .slice(0, 120);
  if (!name) return null;
  const out: MealAiCandidate = {
    name,
    confidence: Math.max(0, Math.min(1, Number(c["confidence"]) || 0.5)),
  };
  if (typeof c["foodId"] === "string") out.foodId = c["foodId"].slice(0, 80);
  if (c["quantity"] != null) out.quantity = Number(c["quantity"]);
  if (typeof c["unit"] === "string") out.unit = c["unit"].slice(0, 40);
  if (c["grams"] != null) out.grams = Number(c["grams"]);
  if (c["proteinG"] != null) out.proteinG = Number(c["proteinG"]);
  if (c["carbG"] != null) out.carbG = Number(c["carbG"]);
  if (c["fatG"] != null) out.fatG = Number(c["fatG"]);
  if (c["fiberG"] != null) out.fiberG = Number(c["fiberG"]);
  if (c["kcal"] != null) out.kcal = Number(c["kcal"]);
  return out;
}

export function parseMealAiSuggestion(raw: unknown): MealAiSuggestion {
  const value = (typeof raw === "string" ? safeJson(raw) : raw) as Partial<MealAiSuggestion> | null;
  if (!value || typeof value !== "object") throw new Error("Resposta inválida");

  const label = String(value.label ?? "")
    .trim()
    .slice(0, 120);
  const proteinG = Math.max(0, Math.min(200, Math.round(Number(value.proteinG) || 0)));
  const kcal = Math.max(0, Math.min(3000, Math.round(Number(value.kcal) || 0)));
  const carbG =
    value.carbG != null
      ? Math.max(0, Math.min(500, Math.round(Number(value.carbG) || 0)))
      : undefined;
  const fatG =
    value.fatG != null
      ? Math.max(0, Math.min(200, Math.round(Number(value.fatG) || 0)))
      : undefined;
  const fiberG =
    value.fiberG != null
      ? Math.max(0, Math.min(100, Math.round(Number(value.fiberG) || 0)))
      : undefined;
  const quality = QUALITIES.includes(value.quality as MealQuality)
    ? (value.quality as MealQuality)
    : proteinG >= 30
      ? "verde"
      : proteinG >= 15
        ? "amarelo"
        : "laranja";
  const confidence = Math.max(0, Math.min(1, Number(value.confidence) || 0.5));
  if (!label || (!proteinG && !kcal)) throw new Error("Macros ausentes");

  const candidates = Array.isArray(value.candidates)
    ? value.candidates.map(parseCandidate).filter((c): c is MealAiCandidate => Boolean(c))
    : [];

  const ambiguous =
    candidates.length > 1 && candidates.some((c) => c.confidence < CONFIRM_THRESHOLD);
  const needsConfirmation =
    value.needsConfirmation === true ||
    confidence < CONFIRM_THRESHOLD ||
    ambiguous ||
    candidates.length === 0;

  return {
    label,
    proteinG,
    kcal,
    ...(carbG != null ? { carbG } : {}),
    ...(fatG != null ? { fatG } : {}),
    ...(fiberG != null ? { fiberG } : {}),
    quality,
    confidence,
    needsConfirmation,
    ...(candidates.length ? { candidates } : {}),
    ...(value.notes ? { notes: String(value.notes).slice(0, 240) } : {}),
  };
}

function safeJson(s: string): unknown {
  const trimmed = s.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(body.slice(start, end + 1));
    }
    throw new Error("JSON inválido");
  }
}

export function mealAiSystemPrompt(slot: MealSlot): string {
  return [
    "Você estima macros e alimentos candidatos de uma refeição para o app Soldiers Training.",
    "Responda SOMENTE um JSON válido, sem markdown:",
    '{"label":"string","proteinG":number,"carbG":number,"fatG":number,"fiberG":number,"kcal":number,"quality":"verde"|"amarelo"|"laranja","confidence":0-1,"needsConfirmation":boolean,"candidates":[{"name":"string","quantity":number,"unit":"g|unidade|colher","grams":number,"confidence":0-1}],"notes":"opcional"}',
    `Slot da refeição: ${slot}.`,
    "quality verde = boa proteína/qualidade; amarelo = ok; laranja = fraca.",
    "Seja conservador nas calorias. Português do Brasil no label.",
    "NÃO invente marca ou quantidade não informada — omita quantity/grams se incerto e baixe confidence.",
    "needsConfirmation=true se confidence < 0.7 ou houver ambiguidade.",
    "candidates: liste alimentos identificados com porção estimada quando possível.",
  ].join("\n");
}

/** Enrich LLM suggestion with deterministic voice/catalog parse when text is available. */
export function mergeVoiceParseIntoSuggestion(
  suggestion: MealAiSuggestion,
  voice: {
    items: Array<{
      foodId: string;
      foodName?: string;
      quantity: number;
      unit: string;
      grams: number;
      confidence: number;
      nutrientSnapshot: {
        energyKcal: number;
        proteinG: number;
        carbG: number;
        fatG: number;
        fiberG?: number;
      };
    }>;
    overallConfidence: number;
    needsConfirmation: boolean;
    candidates: Array<{
      foodId?: string;
      foodName?: string;
      quantity?: number;
      unit?: string;
      grams?: number;
      confidence: number;
      matched: boolean;
    }>;
  },
): MealAiSuggestion {
  const fromVoice: MealAiCandidate[] = voice.candidates
    .filter((c) => c.matched && c.foodId)
    .map((c) => {
      const item = voice.items.find((i) => i.foodId === c.foodId);
      const cand: MealAiCandidate = {
        name: c.foodName ?? c.foodId!,
        confidence: c.confidence,
      };
      if (c.foodId) cand.foodId = c.foodId;
      if (c.quantity != null) cand.quantity = c.quantity;
      if (c.unit) cand.unit = c.unit;
      if (c.grams != null) cand.grams = c.grams;
      if (item) {
        cand.proteinG = Math.round(item.nutrientSnapshot.proteinG);
        cand.carbG = Math.round(item.nutrientSnapshot.carbG);
        cand.fatG = Math.round(item.nutrientSnapshot.fatG);
        cand.kcal = Math.round(item.nutrientSnapshot.energyKcal);
        if (item.nutrientSnapshot.fiberG != null) {
          cand.fiberG = Math.round(item.nutrientSnapshot.fiberG);
        }
      }
      return cand;
    });

  const candidates = fromVoice.length ? fromVoice : (suggestion.candidates ?? []);
  let proteinG = suggestion.proteinG;
  let kcal = suggestion.kcal;
  let carbG = suggestion.carbG;
  let fatG = suggestion.fatG;
  let fiberG = suggestion.fiberG;
  let label = suggestion.label;

  if (voice.items.length > 0) {
    proteinG = Math.round(voice.items.reduce((s, i) => s + i.nutrientSnapshot.proteinG, 0));
    kcal = Math.round(voice.items.reduce((s, i) => s + i.nutrientSnapshot.energyKcal, 0));
    carbG = Math.round(voice.items.reduce((s, i) => s + i.nutrientSnapshot.carbG, 0));
    fatG = Math.round(voice.items.reduce((s, i) => s + i.nutrientSnapshot.fatG, 0));
    fiberG = Math.round(voice.items.reduce((s, i) => s + (i.nutrientSnapshot.fiberG ?? 0), 0));
    label = voice.items.map((i) => i.foodName ?? i.foodId).join(", ");
  }

  const confidence = Math.min(
    suggestion.confidence,
    voice.overallConfidence || suggestion.confidence,
  );
  const needsConfirmation =
    suggestion.needsConfirmation !== false &&
    (voice.needsConfirmation || confidence < CONFIRM_THRESHOLD || candidates.length === 0);

  const out: MealAiSuggestion = {
    label,
    proteinG,
    kcal,
    quality: suggestion.quality,
    confidence,
    candidates,
    needsConfirmation,
  };
  if (carbG != null) out.carbG = carbG;
  if (fatG != null) out.fatG = fatG;
  if (fiberG != null) out.fiberG = fiberG;
  if (suggestion.notes) out.notes = suggestion.notes;
  return out;
}

export { CONFIRM_THRESHOLD };
