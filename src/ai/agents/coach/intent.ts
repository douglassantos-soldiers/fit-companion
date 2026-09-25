/**
 * Coach Agent intent — WHY plan + domain labels.
 */

export type CoachAgentIntentKind =
  | "why_plan_changed"
  | "training"
  | "nutrition"
  | "recovery"
  | "behavior"
  | "performance"
  | "general";

const WHY_RE =
  /\b(por\s*que|porque|porquê|why|explica|raz[aã]o|motivo).*(plano|treino|volume|kcal|mudou|descans|leve|decis)/i;

const WHY_ALT = /por\s*que\s+meu/i;

export function detectCoachAgentIntent(message: string): CoachAgentIntentKind {
  const t = message.trim().toLowerCase();
  if (!t) return "general";
  if (WHY_RE.test(t) || WHY_ALT.test(t) || /plano\s+mudou/i.test(t)) {
    return "why_plan_changed";
  }
  if (/\b(trein|volume|exerc|workout|progress|deload)/.test(t)) return "training";
  if (/\b(comida|refei|macro|prote|nutri|dieta|calor)/.test(t)) return "nutrition";
  if (/\b(cansad|fadig|sono|sleep|recover|recupera|dormi)/.test(t)) return "recovery";
  if (/\b(h[aá]bito|ader[eê]ncia|checkin|fric)/.test(t)) return "behavior";
  if (/\b(performance|resultado|tend[eê]ncia|risco|overview)/.test(t)) {
    return "performance";
  }
  return "general";
}

/** Enrich orchestrator intent string for WHY so explain_decision is preferred. */
export function intentForOrchestrator(message: string, kind: CoachAgentIntentKind): string {
  if (kind === "why_plan_changed") {
    return `${message} — explicar decisão do plano (explain_decision analyze_outcome)`;
  }
  return message;
}
