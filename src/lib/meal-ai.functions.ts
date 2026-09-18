import { createServerFn } from "@tanstack/react-start";
import { rateLimitKey, readAccessSession } from "@/lib/access-session.server";
import {
  mealAiSystemPrompt,
  parseMealAiInput,
  parseMealAiSuggestion,
  type MealAiError,
  type MealAiSuggestion,
} from "@/lib/meal-ai-contract";

export type { MealAiSuggestion, MealAiError };
export { parseMealAiInput, parseMealAiSuggestion, mealAiSystemPrompt };

type MealAiResult =
  | { suggestion: MealAiSuggestion; transcript?: string; error?: undefined }
  | { suggestion?: undefined; transcript?: string; error: MealAiError };

async function estimateFromText(text: string, slot: ReturnType<typeof parseMealAiInput>["slot"], key: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: mealAiSystemPrompt(slot) },
        { role: "user", content: `Descrição da refeição: ${text}` },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("OpenAI meal text error", res.status, detail.slice(0, 200));
    return null;
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "";
  return parseMealAiSuggestion(content);
}

async function estimateFromPhoto(
  base64: string,
  mimeType: string,
  slot: ReturnType<typeof parseMealAiInput>["slot"],
  key: string,
) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o",
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
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("OpenAI meal vision error", res.status, detail.slice(0, 200));
    return null;
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "";
  return parseMealAiSuggestion(content);
}

async function transcribeVoice(base64: string, mimeType: string, key: string): Promise<string | null> {
  const binary = Buffer.from(base64, "base64");
  const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
  const form = new FormData();
  form.append("file", new Blob([binary], { type: mimeType }), `meal.${ext}`);
  form.append("model", "whisper-1");
  form.append("language", "pt");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("OpenAI whisper error", res.status, detail.slice(0, 200));
    return null;
  }
  const json = (await res.json()) as { text?: string };
  return json.text?.trim() || null;
}

/**
 * Meal AI — vision / Whisper / text → structured macros.
 * Requires access session cookie. Rate-limited per email.
 */
export const analyzeMealAi = createServerFn({ method: "POST" })
  .inputValidator(parseMealAiInput)
  .handler(async ({ data }): Promise<MealAiResult> => {
    const session = readAccessSession();
    if (!session) return { error: "unauthorized" };
    if (!rateLimitKey(`meal-ai:${session.email}`, 40, 60 * 60_000)) {
      return { error: "rate_limited" };
    }

    const key = process.env["OPENAI_API_KEY"];
    if (!key) return { error: "not_configured" };

    try {
      if (data.mode === "text") {
        const suggestion = await estimateFromText(data.text!, data.slot, key);
        if (!suggestion) return { error: "upstream" };
        return { suggestion };
      }

      if (data.mode === "photo") {
        const suggestion = await estimateFromPhoto(
          data.mediaBase64!,
          data.mimeType ?? "image/jpeg",
          data.slot,
          key,
        );
        if (!suggestion) return { error: "upstream" };
        return { suggestion };
      }

      // voice
      const transcript = await transcribeVoice(
        data.mediaBase64!,
        data.mimeType ?? "audio/webm",
        key,
      );
      if (!transcript) return { error: "upstream" };
      const suggestion = await estimateFromText(transcript, data.slot, key);
      if (!suggestion) return { error: "upstream", transcript };
      return { suggestion, transcript };
    } catch (e) {
      console.error("meal-ai handler", e);
      return { error: "upstream" };
    }
  });
