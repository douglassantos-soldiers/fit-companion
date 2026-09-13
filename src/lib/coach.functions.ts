import { createServerFn } from "@tanstack/react-start";

export type CoachProvider = "chatgpt" | "claude";

interface CoachInput {
  provider: CoachProvider;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

function parseInput(input: unknown): CoachInput {
  const value = input as Partial<CoachInput> | null;
  if (!value || (value.provider !== "chatgpt" && value.provider !== "claude")) {
    throw new Error("Provedor inválido");
  }
  if (!Array.isArray(value.messages) || value.messages.length === 0) {
    throw new Error("Mensagens ausentes");
  }
  return {
    provider: value.provider,
    system: typeof value.system === "string" ? value.system : "",
    messages: value.messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? ""),
    })),
  };
}

export const askAiCoach = createServerFn({ method: "POST" })
  .inputValidator(parseInput)
  .handler(async ({ data }) => {
    if (data.provider === "chatgpt") {
      const key = process.env["OPENAI_API_KEY"];
      if (!key) throw new Error("A chave da OpenAI ainda não foi configurada.");

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "system", content: data.system }, ...data.messages],
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`OpenAI (${res.status}): ${detail.slice(0, 300)}`);
      }

      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return { text: json.choices?.[0]?.message?.content?.trim() || "Não consegui responder agora." };
    }

    const key = process.env["ANTHROPIC_API_KEY"];
    if (!key) throw new Error("A chave da Anthropic ainda não foi configurada.");

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
        system: data.system,
        messages: data.messages,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Anthropic (${res.status}): ${detail.slice(0, 300)}`);
    }

    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (json.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim();
    return { text: text || "Não consegui responder agora." };
  });
