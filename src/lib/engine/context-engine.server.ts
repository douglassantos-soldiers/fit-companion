/**
 * Context Engine — server entrypoints.
 * userId must already be trusted (resolveTrustedIdentity / admin).
 * Never trusts client-supplied userId; never mutates domain via LLM.
 */
import { getOrBuildDecisionContext } from "@/lib/engine/decision-context.server";
import {
  getBehaviorContext,
  getNutritionContext,
  getRecoveryContext,
  getTrainingContext,
  toPerformanceContext,
  type BehaviorContextView,
  type NutritionContextView,
  type PerformanceContext,
  type RecoveryContextView,
  type TrainingContextView,
} from "@/lib/engine/context-engine";

/**
 * Build (or reuse fingerprint-matched) DecisionContextSnapshot, then map to PerformanceContext.
 */
export async function getPerformanceContext(
  userId: string,
  date?: string,
): Promise<PerformanceContext | null> {
  const id = String(userId ?? "").trim();
  if (!id || id.length < 8) return null;
  const result = await getOrBuildDecisionContext(id, date);
  if (!result?.snapshot) return null;
  return toPerformanceContext(result.snapshot, result.state);
}

export async function getTrainingContextForUser(
  userId: string,
  date?: string,
): Promise<TrainingContextView | null> {
  const pc = await getPerformanceContext(userId, date);
  return pc ? getTrainingContext(pc) : null;
}

export async function getNutritionContextForUser(
  userId: string,
  date?: string,
): Promise<NutritionContextView | null> {
  const pc = await getPerformanceContext(userId, date);
  return pc ? getNutritionContext(pc) : null;
}

export async function getRecoveryContextForUser(
  userId: string,
  date?: string,
): Promise<RecoveryContextView | null> {
  const pc = await getPerformanceContext(userId, date);
  return pc ? getRecoveryContext(pc) : null;
}

export async function getBehaviorContextForUser(
  userId: string,
  date?: string,
): Promise<BehaviorContextView | null> {
  const pc = await getPerformanceContext(userId, date);
  return pc ? getBehaviorContext(pc) : null;
}
