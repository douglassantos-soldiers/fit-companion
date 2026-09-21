/**
 * Server-side decision context — compatibility wrapper around getOrBuildDecisionContext.
 * DOMAIN → Customer360 → Context → Safety → Decision → Living Plan
 */
import type { Customer360 } from "@/lib/customer360/types";
import type { ContextSnapshot } from "@/lib/engine/context-snapshot";
import type { DecisionBundle } from "@/lib/engine/decision";
import type { DecisionContextSnapshot } from "@/lib/engine/decision-context-snapshot";
import type { SafetyVerdict } from "@/lib/engine/safety";
import type { AppState } from "@/lib/types";
import { evaluateSafetyForDate } from "@/lib/engine/safety";

export type ServerDecisionContext = {
  userId: string;
  date: string;
  timezone: string;
  state: AppState;
  customer360: Customer360 | null;
  snapshot: ContextSnapshot | null;
  safety: SafetyVerdict;
  decisions: DecisionBundle | null;
  stale360: boolean;
  decisionContext?: DecisionContextSnapshot | null;
};

/**
 * Build authoritative decision context for a user/date from DB-hydrated state + C360.
 */
export async function buildServerDecisionContext(
  userId: string,
  date?: string,
): Promise<ServerDecisionContext | null> {
  if (!userId) return null;

  const { getOrBuildDecisionContext } = await import("@/lib/engine/decision-context.server");
  const built = await getOrBuildDecisionContext(userId, date);
  if (!built) return null;

  const dc = built.snapshot;
  const timezone = dc?.timezone ?? built.state.profile?.timezone ?? "America/Sao_Paulo";
  const targetDate = dc?.date ?? date ?? "";
  const safety = dc?.safety ?? evaluateSafetyForDate(built.state, targetDate);

  const result: ServerDecisionContext = {
    userId,
    date: targetDate,
    timezone,
    state: built.state,
    customer360: built.customer360,
    snapshot: dc?.context ?? null,
    safety,
    decisions: dc?.decisions ?? null,
    stale360: built.stale360,
  };
  if (dc) result.decisionContext = dc;
  return result;
}
