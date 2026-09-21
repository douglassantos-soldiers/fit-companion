/**
 * InterventionResponse — counts from persisted outcomes, never invented traits.
 */
import type { InterventionType } from "@/lib/engine/behavior/types";
import type { InterventionResponse, LearningOutcome } from "@/lib/engine/learning/types";

export function emptyInterventionResponse(type: InterventionType): InterventionResponse {
  return {
    type,
    successCount: 0,
    failureCount: 0,
    neutralCount: 0,
    confidence: 0.5,
    lastUsedAt: null,
  };
}

export function confidenceFromCounts(
  successCount: number,
  failureCount: number,
  neutralCount: number,
): number {
  const n = successCount + failureCount + neutralCount;
  const raw = (successCount + 0.5) / (n + 1);
  return Math.round(Math.max(0.1, Math.min(0.95, raw)) * 1000) / 1000;
}

export function applyInterventionOutcome(
  list: InterventionResponse[],
  type: InterventionType,
  result: LearningOutcome,
  at: string,
): InterventionResponse[] {
  const next = [...list];
  const idx = next.findIndex((r) => r.type === type);
  const cur = idx >= 0 ? next[idx]! : emptyInterventionResponse(type);
  const successCount = cur.successCount + (result === "success" ? 1 : 0);
  const failureCount = cur.failureCount + (result === "fail" ? 1 : 0);
  const neutralCount = cur.neutralCount + (result === "neutral" ? 1 : 0);
  const row: InterventionResponse = {
    type,
    successCount,
    failureCount,
    neutralCount,
    confidence: confidenceFromCounts(successCount, failureCount, neutralCount),
    lastUsedAt: at,
  };
  if (idx >= 0) next[idx] = row;
  else next.push(row);
  return next;
}

export function scalarsFromResponses(
  list: InterventionResponse[] | undefined,
): Partial<Record<InterventionType, number>> {
  const out: Partial<Record<InterventionType, number>> = {};
  for (const r of list ?? []) {
    out[r.type] = r.confidence;
  }
  return out;
}

export function mergeInterventionResponses(
  prior: InterventionResponse[] | undefined,
  incoming: InterventionResponse[] | undefined,
): InterventionResponse[] {
  const map = new Map<InterventionType, InterventionResponse>();
  for (const r of prior ?? []) map.set(r.type, r);
  for (const r of incoming ?? []) {
    const prev = map.get(r.type);
    if (!prev) {
      map.set(r.type, r);
      continue;
    }
    const successCount = Math.max(prev.successCount, r.successCount);
    const failureCount = Math.max(prev.failureCount, r.failureCount);
    const neutralCount = Math.max(prev.neutralCount, r.neutralCount);
    const lastUsedAt =
      (prev.lastUsedAt ?? "") >= (r.lastUsedAt ?? "") ? prev.lastUsedAt : r.lastUsedAt;
    map.set(r.type, {
      type: r.type,
      successCount,
      failureCount,
      neutralCount,
      confidence: confidenceFromCounts(successCount, failureCount, neutralCount),
      lastUsedAt,
    });
  }
  return [...map.values()];
}
