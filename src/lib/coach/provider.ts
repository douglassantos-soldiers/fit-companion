/**
 * LLM provider adapter — no business rules here.
 */
export type CoachProviderId = "chatgpt" | "claude";

export type ProviderMessage = { role: "user" | "assistant"; content: string };

export type ProviderRequest = {
  provider: CoachProviderId;
  system: string;
  messages: ProviderMessage[];
  maxTokens?: number;
};

export type ProviderResult =
  | { text: string; model: string; error?: undefined }
  | { text: ""; model: string; error: "not_configured" | "upstream" };

export async function callCoachProvider(req: ProviderRequest): Promise<ProviderResult> {
  const maxTokens = req.maxTokens ?? 800;

  if (req.provider === "chatgpt") {
    const key = process.env["OPENAI_API_KEY"];
    if (!key) return { text: "", model: "gpt-4o", error: "not_configured" };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: maxTokens,
        messages: [{ role: "system", content: req.system }, ...req.messages],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("OpenAI coach error", res.status, detail.slice(0, 200));
      return { text: "", model: "gpt-4o", error: "upstream" };
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return {
      text: json.choices?.[0]?.message?.content?.trim() || "Não consegui responder agora.",
      model: "gpt-4o",
    };
  }

  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) return { text: "", model: "claude-sonnet-4-5", error: "not_configured" };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      system: req.system,
      messages: req.messages,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("Anthropic coach error", res.status, detail.slice(0, 200));
    return { text: "", model: "claude-sonnet-4-5", error: "upstream" };
  }
  const json = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = json.content?.map((c) => c.text ?? "").join("").trim();
  return { text: text || "Não consegui responder agora.", model: "claude-sonnet-4-5" };
}
