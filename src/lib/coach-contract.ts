/** Pure coach input/system/structured helpers (safe for unit tests without createServerFn). */

import type { CoachAction, CoachEvidencePack, CoachProposal, CoachTurnKind } from "@/lib/coach/types";
import { classifyCoachTurn } from "@/lib/coach/classify";

export type CoachProvider = "chatgpt" | "claude";

const MAX_MESSAGES = 24;
const MAX_MSG_CHARS = 2000;

export interface CoachInput {
  provider: CoachProvider;
  deviceId?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  /** Optional workflow hint from client — never trusted for auth/context */
  workflow?: "morning-checkin" | "post-workout" | "weekly-review" | "recovery-adjustment" | "plateau-analysis" | "nutrition-review";
}

export type CoachStructuredKind = "why" | "today" | "general";

export type CoachStructuredReply = {
  kind: CoachStructuredKind;
  summary: string;
  why: string[];
  decisions: Array<{ type: string; value: string; explanation: string }>;
  safetyNotice?: string;
  turnKind?: CoachTurnKind;
  proposals?: CoachProposal[];
  actions?: CoachAction[];
  evidence?: CoachEvidencePack;
};

export function parseCoachInput(input: unknown): CoachInput {
  const value = input as Partial<CoachInput> & { context?: unknown; system?: unknown } | null;
  if (!value || (value.provider !== "chatgpt" && value.provider !== "claude")) {
    throw new Error("Provedor inválido");
  }
  if (!Array.isArray(value.messages) || value.messages.length === 0) {
    throw new Error("Mensagens ausentes");
  }
  // Ignore any client-supplied critical context / system prompt (FASE 6 + Phase 3).
  void value.context;
  void value.system;
  const messages = value.messages.slice(-MAX_MESSAGES).map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content: String(m.content ?? "").slice(0, MAX_MSG_CHARS),
  }));
  const workflows = [
    "morning-checkin",
    "post-workout",
    "weekly-review",
    "recovery-adjustment",
    "plateau-analysis",
    "nutrition-review",
  ] as const;
  const workflow =
    typeof value.workflow === "string" && (workflows as readonly string[]).includes(value.workflow)
      ? (value.workflow as CoachInput["workflow"])
      : undefined;
  return {
    provider: value.provider,
    ...(typeof value.deviceId === "string" ? { deviceId: value.deviceId.slice(0, 128) } : {}),
    messages,
    ...(workflow ? { workflow } : {}),
  };
}

export function buildCoachSystemPrompt(serverContext: string, safetyNotice?: string): string {
  return [
    "Você é o coach de performance do app Soldiers (treino, nutrição e suplementação).",
    "Responda sempre em português do Brasil, tom direto, no máximo 6 frases.",
    "Não invente dados médicos; não faça diagnóstico.",
    "Não faça diagnósticos psicológicos nem rotule transtornos — só padrões de comportamento observados (aderência, sono, logging).",
    "Engines calculam. Decision Engine decide. Você só explica. UI executa.",
    "NÃO recalcule volume, calorias, modo de treino ou bloqueio de stims — use as decisões listadas.",
    "Se propor uma ação diferente da decisão do motor, declare explicitamente: 'proposta alternativa (não é a decisão do motor)'.",
    "Quando perguntarem por que o plano mudou ou está leve, cite evidências reais (sono, RPE streak, decision).",
    "Nunca invente justificativas que não estejam no contexto ou nos dados de tools.",
    safetyNotice ? `AVISO DE SEGURANÇA (obrigatório mencionar com cuidado, sem diagnosticar): ${safetyNotice}` : "",
    "Contexto do usuário (montado no servidor a partir de Customer 360 + engines):",
    serverContext || "(sem contexto)",
  ]
    .filter(Boolean)
    .join("\n");
}

const WHY_RE =
  /(por\s*que|porque|porquê|why).*(mudou|treino|calor|kcal|prote[ií]na|descans|plano|recomend|leve)/i;
const TODAY_RE = /(o\s*que.*(fazer|fazer\s+hoje)|treino\s+de\s+hoje|plano\s+de\s+hoje|hoje)/i;

export function detectCoachIntent(userText: string): CoachStructuredKind {
  const t = userText.trim();
  if (WHY_RE.test(t) || /por\s*que\s+meu/i.test(t)) return "why";
  if (TODAY_RE.test(t) && !WHY_RE.test(t)) return "today";
  return "general";
}

export { classifyCoachTurn };

export function buildStructuredCoachReply(opts: {
  kind: CoachStructuredKind;
  summary: string;
  why: string[];
  decisions: Array<{ type: string; value: string | number | boolean; explanation: string }>;
  safetyNotice?: string;
  turnKind?: CoachTurnKind;
  proposals?: CoachProposal[];
  actions?: CoachAction[];
  evidence?: CoachEvidencePack;
}): CoachStructuredReply {
  const reply: CoachStructuredReply = {
    kind: opts.kind,
    summary: opts.summary,
    why: opts.why.slice(0, 8),
    decisions: opts.decisions.slice(0, 10).map((d) => ({
      type: d.type,
      value: String(d.value),
      explanation: d.explanation,
    })),
  };
  if (opts.safetyNotice) reply.safetyNotice = opts.safetyNotice;
  if (opts.turnKind) reply.turnKind = opts.turnKind;
  if (opts.proposals?.length) reply.proposals = opts.proposals;
  if (opts.actions?.length) reply.actions = opts.actions;
  if (opts.evidence) reply.evidence = opts.evidence;
  return reply;
}
