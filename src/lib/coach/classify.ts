/**
 * Classify coach turns — factual / contextual / explanatory / actionable / medical.
 */
import type { CoachTurnKind } from "@/lib/coach/types";

const MEDICAL_RE =
  /\b(dor\s+no\s+peito|diagn[oó]stico|doen[cç]a|les[aã]o\s+grave|m[eé]dic[oa]|hospital|emerg[eê]ncia|infarto|sangramento|falta\s+de\s+ar|convuls)/i;

const ACTIONABLE_RE =
  /\b(ajusta|adapta|muda\s+o\s+treino|reduz\s+volume|descans|recomend|quero\s+descansar|montar\s+plano|fazer\s+hoje|começar\s+check.?in)/i;

const EXPLAIN_RE =
  /\b(por\s*que|porque|porquê|why|explica|raz[aã]o|motivo).*(treino|leve|volume|kcal|plano|mudou|descans)/i;

const FACTUAL_RE =
  /\b(quantos|quanto|qual\s+(foi|é)|meu\s+pr|1\s*rm|prote[ií]na\s+hoje|kcal\s+hoje|sono\s+hoje|quantas\s+sess)/i;

const CONTEXTUAL_RE =
  /\b(como\s+estou|como\s+est[aá]|resumo|semana|recupera[cç][aã]o|nutri[cç][aã]o|padr[aã]o)/i;

export function classifyCoachTurn(text: string): CoachTurnKind {
  const t = text.trim();
  if (!t) return "contextual";
  if (MEDICAL_RE.test(t)) return "medical";
  if (EXPLAIN_RE.test(t) || /por\s*que\s+meu/i.test(t)) return "explanatory";
  if (ACTIONABLE_RE.test(t)) return "actionable";
  if (FACTUAL_RE.test(t)) return "factual";
  if (CONTEXTUAL_RE.test(t)) return "contextual";
  return "contextual";
}

export function requiresSafetyFirst(kind: CoachTurnKind): boolean {
  return kind === "medical" || kind === "actionable";
}
