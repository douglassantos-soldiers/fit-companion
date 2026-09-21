/**
 * Persist / hydrate Behavior Engine rows (service_role).
 */
import { adminDbLoose } from "@/lib/db-admin";
import type {
  BehaviorExperiment,
  BehaviorIntervention,
  BehaviorPattern,
  InterventionType,
} from "@/lib/engine/behavior/types";

export async function upsertBehaviorPatterns(
  userId: string,
  patterns: BehaviorPattern[],
): Promise<boolean> {
  if (!userId || !patterns.length) return false;
  const db = await adminDbLoose();
  if (!db) return false;

  const rows = patterns.map((p) => ({
    user_id: userId,
    key: p.key,
    description: p.description,
    evidence: p.evidence,
    confidence: p.confidence,
    support_count: p.supportCount,
    first_observed_at: p.firstObservedAt,
    last_observed_at: p.lastObservedAt,
    status: p.status ?? "candidate",
    updated_at: new Date().toISOString(),
  }));

  const { error } = await db.from("behavior_patterns").upsert(rows, {
    onConflict: "user_id,key",
  });
  if (error) {
    console.warn("upsertBehaviorPatterns failed", error);
    return false;
  }
  return true;
}

export async function loadBehaviorPatterns(userId: string): Promise<BehaviorPattern[]> {
  if (!userId) return [];
  const db = await adminDbLoose();
  if (!db) return [];
  const { data, error } = await db
    .from("behavior_patterns")
    .select("*")
    .eq("user_id", userId)
    .order("confidence", { ascending: false });
  if (error || !data) return [];
  type PatternRow = {
    key: string;
    description: string | null;
    evidence: BehaviorPattern["evidence"] | null;
    confidence: number | null;
    support_count: number | null;
    first_observed_at: string | null;
    last_observed_at: string | null;
    status: string | null;
  };
  return (data as PatternRow[]).map((row) => ({
    key: row.key as BehaviorPattern["key"],
    description: String(row.description ?? ""),
    evidence: row.evidence ?? [],
    confidence: Number(row.confidence ?? 0.5),
    supportCount: Number(row.support_count ?? 0),
    firstObservedAt: String(row.first_observed_at ?? ""),
    lastObservedAt: String(row.last_observed_at ?? ""),
    status: (row.status as BehaviorPattern["status"]) ?? "candidate",
  }));
}

export async function insertBehaviorIntervention(
  userId: string,
  intervention: BehaviorIntervention,
): Promise<string | null> {
  if (!userId) return null;
  const db = await adminDbLoose();
  if (!db) return null;
  const { data, error } = await db
    .from("behavior_interventions")
    .insert({
      user_id: userId,
      trigger_key: intervention.trigger,
      type: intervention.type,
      action: intervention.action,
      reason: intervention.reason,
      expected_outcome: intervention.expectedOutcome,
      status: "proposed",
      channel: intervention.channel ?? null,
      confidence: intervention.confidence,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    console.warn("insertBehaviorIntervention failed", error);
    return null;
  }
  return data?.id ?? null;
}

export async function loadRecentInterventions(
  userId: string,
  limit = 10,
): Promise<
  Array<{
    id: string;
    triggerKey: string;
    type: InterventionType;
    action: string;
    reason: string;
    status: string;
    createdAt: string;
  }>
> {
  if (!userId) return [];
  const db = await adminDbLoose();
  if (!db) return [];
  const { data, error } = await db
    .from("behavior_interventions")
    .select("id, trigger_key, type, action, reason, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  type InterventionRow = {
    id: string;
    trigger_key: string;
    type: string;
    action: string;
    reason: string | null;
    status: string;
    created_at: string;
  };
  return (data as InterventionRow[]).map((row) => ({
    id: String(row.id),
    triggerKey: String(row.trigger_key),
    type: row.type as InterventionType,
    action: String(row.action),
    reason: String(row.reason ?? ""),
    status: String(row.status),
    createdAt: String(row.created_at),
  }));
}

export async function recordBehaviorOutcome(opts: {
  userId: string;
  interventionId?: string | null;
  success: boolean;
  metrics?: Record<string, unknown>;
}): Promise<boolean> {
  if (!opts.userId) return false;
  const db = await adminDbLoose();
  if (!db) return false;
  const { error } = await db.from("behavior_outcomes").insert({
    user_id: opts.userId,
    intervention_id: opts.interventionId ?? null,
    success: opts.success,
    metrics: opts.metrics ?? {},
  });
  if (error) {
    console.warn("recordBehaviorOutcome failed", error);
    return false;
  }
  return true;
}

export async function upsertBehaviorExperiments(
  userId: string,
  experiments: BehaviorExperiment[],
): Promise<boolean> {
  if (!userId || !experiments.length) return false;
  const db = await adminDbLoose();
  if (!db) return false;
  for (const e of experiments) {
    const row = {
      user_id: userId,
      client_id: e.id,
      target: e.target,
      start_date: e.start,
      end_date: e.end,
      baseline: e.baseline,
      result: e.result,
      confidence: e.confidence,
      status: e.status,
      updated_at: new Date().toISOString(),
    };
    const { data: existing } = await db
      .from("behavior_experiments")
      .select("id")
      .eq("user_id", userId)
      .eq("client_id", e.id)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await db.from("behavior_experiments").update(row).eq("id", existing.id);
      if (error) {
        console.warn("upsertBehaviorExperiments update failed", error);
        return false;
      }
    } else {
      const { error } = await db.from("behavior_experiments").insert(row);
      if (error) {
        console.warn("upsertBehaviorExperiments insert failed", error);
        return false;
      }
    }
  }
  return true;
}

export async function loadBehaviorExperiments(userId: string): Promise<BehaviorExperiment[]> {
  if (!userId) return [];
  const db = await adminDbLoose();
  if (!db) return [];
  const { data, error } = await db
    .from("behavior_experiments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data) return [];
  type ExpRow = {
    id: string;
    client_id: string | null;
    target: string;
    start_date: string;
    end_date: string;
    baseline: number | null;
    result: number | null;
    confidence: number | null;
    status: string;
  };
  return (data as ExpRow[]).map((row) => ({
    id: String(row.client_id ?? row.id),
    target: String(row.target),
    start: String(row.start_date),
    end: String(row.end_date),
    baseline: Number(row.baseline ?? 0),
    result: row.result == null ? null : Number(row.result),
    confidence: Number(row.confidence ?? 0.5),
    status: row.status as BehaviorExperiment["status"],
  }));
}

export async function loadInterventionResponses(
  userId: string,
): Promise<import("@/lib/engine/learning/types").InterventionResponse[]> {
  if (!userId) return [];
  const db = await adminDbLoose();
  if (!db) return [];
  const { data: interventions } = await db
    .from("behavior_interventions")
    .select("id, type")
    .eq("user_id", userId)
    .limit(100);
  if (!interventions?.length) return [];
  const { data: outcomes } = await db
    .from("behavior_outcomes")
    .select("intervention_id, success, metrics, observed_at")
    .eq("user_id", userId)
    .limit(200);
  if (!outcomes?.length) return [];

  const typedInterventions = interventions as Array<{ id: string; type: string }>;
  const typedOutcomes = outcomes as Array<{
    intervention_id: string | null;
    success: boolean;
    metrics: Record<string, unknown> | null;
    observed_at: string | null;
  }>;
  const typeById = new Map(
    typedInterventions.map((i) => [String(i.id), i.type as InterventionType]),
  );
  const { applyInterventionOutcome } = await import("@/lib/engine/learning/responses");
  let list: import("@/lib/engine/learning/types").InterventionResponse[] = [];
  for (const o of typedOutcomes) {
    const t = o.intervention_id ? typeById.get(String(o.intervention_id)) : null;
    if (!t) continue;
    const raw =
      o.metrics && typeof o.metrics["result"] === "string" ? String(o.metrics["result"]) : null;
    const result =
      raw === "neutral" || raw === "inconclusive"
        ? "neutral"
        : raw === "fail" || o.success === false
          ? "fail"
          : "success";
    list = applyInterventionOutcome(list, t, result, o.observed_at ?? new Date().toISOString());
  }
  return list;
}

export async function loadInterventionSuccessRates(
  userId: string,
): Promise<Partial<Record<InterventionType, number>>> {
  const { scalarsFromResponses } = await import("@/lib/engine/learning/responses");
  return scalarsFromResponses(await loadInterventionResponses(userId));
}
