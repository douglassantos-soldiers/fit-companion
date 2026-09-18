/** Pure coach input/system/structured helpers (safe for unit tests without createServerFn). */

export type CoachProvider = "chatgpt" | "claude";

const MAX_MESSAGES = 24;
const MAX_MSG_CHARS = 2000;

export interface CoachInput {
  provider: CoachProvider;
  deviceId?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export type CoachStructuredKind = "why" | "today" | "general";

export type CoachStructuredReply = {
  kind: CoachStructuredKind;
  summary: string;
  why: string[];
  decisions: Array<{ type: string; value: string; explanation: string }>;
  safetyNotice?: string;
};

export function parseCoachInput(input: unknown): CoachInput {
  const value = input as Partial<CoachInput> & { context?: unknown } | null;
  if (!value || (value.provider !== "chatgpt" && value.provider !== "claude")) {
    throw new Error("Provedor inválido");
  }
  if (!Array.isArray(value.messages) || value.messages.length === 0) {
    throw new Error("Mensagens ausentes");
  }
  // Ignore any client-supplied critical context (FASE 6).
  void value.context;
  const messages = value.messages.slice(-MAX_MESSAGES).map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content: String(m.content ?? "").slice(0, MAX_MSG_CHARS),
  }));
  return {
    provider: value.provider,
    deviceId: typeof value.deviceId === "string" ? value.deviceId.slice(0, 128) : undefined,
    messages,
  };
}

export function buildCoachSystemPrompt(serverContext: string, safetyNotice?: string): string {
  return [
    "Você é o coach de performance do app Soldiers (treino, nutrição e suplementação).",
    "Responda sempre em português do Brasil, tom direto, no máximo 6 frases.",
    "Não invente dados médicos; não faça diagnóstico.",
    "Engines calculam. Decision Engine decide. Você só explica. UI executa.",
    "NÃO recalcule volume, calorias, modo de treino ou bloqueio de stims — use as decisões listadas.",
    "Quando perguntarem por que o plano mudou, use reason codes + bloco de decisões.",
    safetyNotice ? `AVISO DE SEGURANÇA (obrigatório mencionar com cuidado, sem diagnosticar): ${safetyNotice}` : "",
    "Contexto do usuário (montado no servidor a partir de Customer 360 + engines):",
    serverContext || "(sem contexto)",
  ]
    .filter(Boolean)
    .join("\n");
}

const WHY_RE =
  /(por\s*que|porque|porquê|why).*(mudou|treino|calor|kcal|prote[ií]na|descans|plano|recomend)/i;
const TODAY_RE = /(o\s*que.*(fazer|fazer\s+hoje)|treino\s+de\s+hoje|plano\s+de\s+hoje|hoje)/i;

export function detectCoachIntent(userText: string): CoachStructuredKind {
  const t = userText.trim();
  if (WHY_RE.test(t) || /por\s*que\s+meu/i.test(t)) return "why";
  if (TODAY_RE.test(t) && !WHY_RE.test(t)) return "today";
  return "general";
}

export function buildStructuredCoachReply(opts: {
  kind: CoachStructuredKind;
  summary: string;
  why: string[];
  decisions: Array<{ type: string; value: string | number | boolean; explanation: string }>;
  safetyNotice?: string;
}): CoachStructuredReply {
  return {
    kind: opts.kind,
    summary: opts.summary,
    why: opts.why.slice(0, 8),
    decisions: opts.decisions.slice(0, 10).map((d) => ({
      type: d.type,
      value: String(d.value),
      explanation: d.explanation,
    })),
    ...(opts.safetyNotice ? { safetyNotice: opts.safetyNotice } : {}),
  };
}
