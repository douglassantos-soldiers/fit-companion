/**
 * Allowed coach actions — UI deep-links only; no critical table writes.
 */
import type { CoachAction, CoachActionId } from "@/lib/coach/types";

const ACTION_META: Record<CoachActionId, { label: string; href: string }> = {
  adapt_workout: { label: "Abrir treino", href: "/treino" },
  recommend_rest: { label: "Ver plano de hoje", href: "/" },
  recommend_meal: { label: "Abrir nutrição", href: "/nutricao" },
  recommend_sleep: { label: "Fazer check-in", href: "/" },
  recommend_hydration: { label: "Registrar água", href: "/nutricao" },
  start_checkin: { label: "Começar check-in", href: "/" },
  open_training: { label: "Abrir treino", href: "/treino" },
  open_nutrition: { label: "Abrir nutrição", href: "/nutricao" },
};

export function coachAction(id: CoachActionId): CoachAction {
  const meta = ACTION_META[id];
  return { id, label: meta.label, href: meta.href };
}

export function actionsFromIds(ids: CoachActionId[]): CoachAction[] {
  const seen = new Set<CoachActionId>();
  const out: CoachAction[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(coachAction(id));
  }
  return out;
}

export const ALLOWED_COACH_ACTIONS = Object.keys(ACTION_META) as CoachActionId[];
