import { createServerFn } from "@tanstack/react-start";
import { rateLimitKey, readAccessSession } from "@/lib/access-session.server";
import {
  buildCoachSystemPrompt,
  parseCoachInput,
  type CoachProvider,
} from "@/lib/coach-contract";

export type { CoachProvider };
export { parseCoachInput, buildCoachSystemPrompt };

/**
 * AI Coach — system prompt is built server-side from a short context string (not free-form client system).
 * Requires access session cookie. Rate-limited per email.
 */
export const askAiCoach = createServerFn({ method: "POST" })
  .inputValidator(parseCoachInput)
  .handler(async ({ data }) => {
    const session = readAccessSession();
    if (!session) {
      return { text: "", error: "unauthorized" as const };
    }
    const rlKey = `coach:${session.email}`;
    if (!rateLimitKey(rlKey, 30, 60 * 60_000)) {
      return { text: "", error: "rate_limited" as const };
    }

    const system = buildCoachSystemPrompt(data.context);

    if (data.provider === "chatgpt") {
      const key = process.env["OPENAI_API_KEY"];
      if (!key) return { text: "", error: "not_configured" as const };

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 800,
          messages: [{ role: "system", content: system }, ...data.messages],
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        console.error("OpenAI error", res.status, detail.slice(0, 200));
        return { text: "", error: "upstream" as const };
      }

      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return {
        text: json.choices?.[0]?.message?.content?.trim() || "Não consegui responder agora.",
      };
    }

    const key = process.env["ANTHROPIC_API_KEY"];
    if (!key) return { text: "", error: "not_configured" as const };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 800,
        system,
        messages: data.messages,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Anthropic error", res.status, detail.slice(0, 200));
      return { text: "", error: "upstream" as const };
    }

    const json = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = json.content?.map((c) => c.text ?? "").join("").trim();
    return { text: text || "Não consegui responder agora." };
  });
