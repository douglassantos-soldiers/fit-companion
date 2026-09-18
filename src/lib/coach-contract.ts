/** Pure coach input/system helpers (safe for unit tests without createServerFn). */

export type CoachProvider = "chatgpt" | "claude";

const MAX_MESSAGES = 24;
const MAX_MSG_CHARS = 2000;
const MAX_CONTEXT_CHARS = 4000;

export interface CoachInput {
  provider: CoachProvider;
  context: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export function parseCoachInput(input: unknown): CoachInput {
  const value = input as Partial<CoachInput> | null;
  if (!value || (value.provider !== "chatgpt" && value.provider !== "claude")) {
    throw new Error("Provedor inválido");
  }
  if (!Array.isArray(value.messages) || value.messages.length === 0) {
    throw new Error("Mensagens ausentes");
  }
  const messages = value.messages.slice(-MAX_MESSAGES).map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content: String(m.content ?? "").slice(0, MAX_MSG_CHARS),
  }));
  return {
    provider: value.provider,
    context: String(value.context ?? "").slice(0, MAX_CONTEXT_CHARS),
    messages,
  };
}

export function buildCoachSystemPrompt(context: string): string {
  return [
    "Você é o coach de performance do app Soldiers (treino, nutrição e suplementação).",
    "Responda sempre em português do Brasil, tom direto, no máximo 6 frases.",
    "Não invente dados médicos; não faça diagnóstico.",
    "Contexto do usuário:",
    context || "(sem contexto)",
  ].join("\n");
}
