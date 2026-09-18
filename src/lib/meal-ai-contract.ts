/** Pure meal-AI input/output helpers (safe for unit tests without createServerFn). */

import type { MealQuality, MealSlot } from "@/lib/types";

const MAX_B64 = 4_500_000; // ~3.3MB binary
const MAX_TEXT = 2000;

export type MealAiMode = "photo" | "voice" | "text";

export interface MealAiInput {
  mode: MealAiMode;
  slot: MealSlot;
  /** Base64 without data-URL prefix for photo/voice */
  mediaBase64?: string;
  mimeType?: string;
  /** Free-text description (or Whisper transcript) */
  text?: string;
}

export interface MealAiSuggestion {
  label: string;
  proteinG: number;
  kcal: number;
  quality: MealQuality;
  confidence: number;
  notes?: string;
}

export type MealAiError = "unauthorized" | "rate_limited" | "not_configured" | "upstream" | "invalid";

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

  if (value.mode === "text") {
    const text = String(value.text ?? "").trim().slice(0, MAX_TEXT);
    if (!text) throw new Error("Texto ausente");
    return { mode: "text", slot: value.slot, text };
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
    mediaBase64,
    mimeType,
    ...(value.text ? { text: String(value.text).slice(0, MAX_TEXT) } : {}),
  };
}

export function parseMealAiSuggestion(raw: unknown): MealAiSuggestion {
  const value = (typeof raw === "string" ? safeJson(raw) : raw) as Partial<MealAiSuggestion> | null;
  if (!value || typeof value !== "object") throw new Error("Resposta inválida");

  const label = String(value.label ?? "").trim().slice(0, 120);
  const proteinG = Math.max(0, Math.min(200, Math.round(Number(value.proteinG) || 0)));
  const kcal = Math.max(0, Math.min(3000, Math.round(Number(value.kcal) || 0)));
  const quality = QUALITIES.includes(value.quality as MealQuality)
    ? (value.quality as MealQuality)
    : proteinG >= 30
      ? "verde"
      : proteinG >= 15
        ? "amarelo"
        : "laranja";
  const confidence = Math.max(0, Math.min(1, Number(value.confidence) || 0.5));
  if (!label || (!proteinG && !kcal)) throw new Error("Macros ausentes");

  return {
    label,
    proteinG,
    kcal,
    quality,
    confidence,
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
    "Você estima macros de uma refeição para o app Soldiers Performance.",
    "Responda SOMENTE um JSON válido, sem markdown:",
    '{"label":"string","proteinG":number,"kcal":number,"quality":"verde"|"amarelo"|"laranja","confidence":0-1,"notes":"opcional"}',
    `Slot da refeição: ${slot}.`,
    "quality verde = boa proteína/qualidade; amarelo = ok; laranja = fraca.",
    "Seja conservador nas calorias. Português do Brasil no label.",
  ].join("\n");
}
