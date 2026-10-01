import { createServerFn } from "@tanstack/react-start";
import { resolveTrustedIdentity } from "@/lib/session-identity.server";
import {
  mealAiSystemPrompt,
  mergeVoiceParseIntoSuggestion,
  parseMealAiInput,
  parseMealAiSuggestion,
  type MealAiError,
  type MealAiSuggestion,
} from "@/lib/meal-ai-contract";
import { parseVoiceFoodText } from "@/lib/nutrition/voice-parse";
import {
  invokeMealOpenAiHttp,
  invokeMealTextViaGateway,
} from "@/ai/gateway/meal-invoke";
import { getAgentAIConfig } from "@/ai/gateway/config";

export type { MealAiSuggestion, MealAiError };
export { parseMealAiInput, parseMealAiSuggestion, mealAiSystemPrompt };

type MealAiResult =
  | { suggestion: MealAiSuggestion; transcript?: string; error?: undefined }
  | { suggestion?: undefined; transcript?: string; error: MealAiError };

function enrichWithCatalog(text: string, suggestion: MealAiSuggestion): MealAiSuggestion {
  const voice = parseVoiceFoodText(text);
  return mergeVoiceParseIntoSuggestion(suggestion, voice);
}

async function estimateFromText(
  text: string,
  slot: ReturnType<typeof parseMealAiInput>["slot"],
  userId?: string,
) {
  // Deterministic catalog parse first — high confidence can skip inventing quantities
  const voice = parseVoiceFoodText(text);
  if (voice.items.length > 0 && voice.overallConfidence >= 0.75 && !voice.needsConfirmation) {
    const fromVoice = mergeVoiceParseIntoSuggestion(
      {
        label: voice.items.map((i) => i.foodName ?? i.foodId).join(", "),
        proteinG: Math.round(voice.items.reduce((s, i) => s + i.nutrientSnapshot.proteinG, 0)),
        kcal: Math.round(voice.items.reduce((s, i) => s + i.nutrientSnapshot.energyKcal, 0)),
        carbG: Math.round(voice.items.reduce((s, i) => s + i.nutrientSnapshot.carbG, 0)),
        fatG: Math.round(voice.items.reduce((s, i) => s + i.nutrientSnapshot.fatG, 0)),
        fiberG: Math.round(voice.items.reduce((s, i) => s + (i.nutrientSnapshot.fiberG ?? 0), 0)),
        quality:
          voice.items.reduce((s, i) => s + i.nutrientSnapshot.proteinG, 0) >= 30
            ? "verde"
            : voice.items.reduce((s, i) => s + i.nutrientSnapshot.proteinG, 0) >= 15
              ? "amarelo"
              : "laranja",
        confidence: voice.overallConfidence,
        needsConfirmation: false,
        candidates: [],
      },
      voice,
    );
    return fromVoice;
  }

  const gw = await invokeMealTextViaGateway({
    system: mealAiSystemPrompt(slot),
    userContent: `Descrição da refeição: ${text}`,
    ...(userId ? { userId } : {}),
    maxTokens: 500,
  });
  if (!gw.ok) {
    console.error("meal-ai gateway text", gw.code, gw.error.slice(0, 200));
    if (voice.items.length) {
      return enrichWithCatalog(text, {
        label: text.slice(0, 80),
        proteinG: Math.round(voice.items.reduce((s, i) => s + i.nutrientSnapshot.proteinG, 0)),
        kcal: Math.round(voice.items.reduce((s, i) => s + i.nutrientSnapshot.energyKcal, 0)),
        quality: "amarelo",
        confidence: voice.overallConfidence,
        needsConfirmation: true,
      });
    }
    return null;
  }
  const suggestion = parseMealAiSuggestion(gw.text);
  return enrichWithCatalog(text, suggestion);
}

async function estimateFromPhoto(
  base64: string,
  mimeType: string,
  slot: ReturnType<typeof parseMealAiInput>["slot"],
  userId?: string,
) {
  const config = getAgentAIConfig("meal_ai");
  const model = process.env["AI_OPENAI_MODEL"]?.trim() || config.model || "gpt-4o";
  const body = JSON.stringify({
    model,
    max_tokens: 300,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: mealAiSystemPrompt(slot) },
      {
        role: "user",
        content: [
          { type: "text", text: "Estime macros desta foto de refeição." },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}`, detail: "low" },
          },
        ],
      },
    ],
  });
  const gw = await invokeMealOpenAiHttp({
    kind: "vision",
    ...(userId ? { userId } : {}),
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!gw.ok) {
    console.error("meal-ai gateway vision", gw.code, gw.error.slice(0, 200));
    return null;
  }
  return parseMealAiSuggestion(gw.text);
}

async function transcribeVoice(
  base64: string,
  mimeType: string,
  userId?: string,
): Promise<string | null> {
  const binary = Buffer.from(base64, "base64");
  const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
  const form = new FormData();
  form.append("file", new Blob([binary], { type: mimeType }), `meal.${ext}`);
  form.append("model", "whisper-1");
  form.append("language", "pt");

  const gw = await invokeMealOpenAiHttp({
    kind: "whisper",
    ...(userId ? { userId } : {}),
    body: form,
  });
  if (!gw.ok) {
    console.error("meal-ai gateway whisper", gw.code, gw.error.slice(0, 200));
    return null;
  }
  return gw.text || null;
}

/**
 * Meal AI — vision / Whisper / text → structured macros (suggestion only).
 * FASE 23.3 — all provider calls via AI Gateway controls (no Decision Engine).
 * Requires resolveTrustedIdentity (access cookie + device bind). Rate-limited per user.
 */
export const analyzeMealAi = createServerFn({ method: "POST" })
  .inputValidator(parseMealAiInput)
  .handler(async ({ data }): Promise<MealAiResult> => {
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccess: true,
    });
    if (!identity) return { error: "unauthorized" };
    const rlKey = identity.email ?? identity.userId;
    {
      const { consumeNamedBurst } = await import("@/lib/security/burst-limit");
      const burst = await consumeNamedBurst({
        key: `ai:meal-ai:${rlKey}`,
        limit: 40,
        windowMs: 60 * 60_000,
      });
      if (!burst.ok) return { error: "rate_limited" };
    }

    const userId = identity.userId ?? identity.email;

    try {
      if (data.mode === "text") {
        const suggestion = await estimateFromText(data.text!, data.slot, userId);
        if (!suggestion) return { error: "upstream" };
        return { suggestion };
      }

      if (data.mode === "photo") {
        const suggestion = await estimateFromPhoto(
          data.mediaBase64!,
          data.mimeType ?? "image/jpeg",
          data.slot,
          userId,
        );
        if (!suggestion) return { error: "upstream" };
        return { suggestion };
      }

      // voice
      const transcript = await transcribeVoice(
        data.mediaBase64!,
        data.mimeType ?? "audio/webm",
        userId,
      );
      if (!transcript) return { error: "upstream" };
      const suggestion = await estimateFromText(transcript, data.slot, userId);
      if (!suggestion) return { error: "upstream", transcript };
      return { suggestion, transcript };
    } catch (e) {
      console.error("meal-ai handler", e);
      return { error: "upstream" };
    }
  });
