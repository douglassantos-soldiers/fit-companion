/**
 * Server assembly + persistence for DecisionContextSnapshot.
 * Trusted userId only — never from the client body.
 */
import type { Customer360 } from "@/lib/customer360/types";
import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import {
  DECISION_ENGINE_VERSION,
  nextSnapshotVersion,
  type DecisionContextSnapshot,
} from "@/lib/engine/decision-context-snapshot";
import { logEngineDecision, logEngineError } from "@/lib/engine/observability";
import type { AppState } from "@/lib/types";
import { DEFAULT_USER_TIMEZONE, getUserTodayKey, normalizeUserTimezone } from "@/lib/timezone";

export type DecisionContextBuildResult = {
  snapshot: DecisionContextSnapshot | null;
  state: AppState;
  customer360: Customer360 | null;
  stale360: boolean;
};

type StoredSnapshotRow = {
  snapshot_version: number;
  input_fingerprint: string;
  payload: DecisionContextSnapshot;
  customer360_version: number | null;
  stale360: boolean;
};

export async function loadStoredDecisionContext(
  userId: string,
  date: string,
): Promise<StoredSnapshotRow | null> {
  if (!userId || !date) return null;
  try {
    const { adminDbLoose } = await import("@/lib/db-admin");
    const db = await adminDbLoose();
    if (!db) return null;
    const { data, error } = await db
      .from("decision_context_snapshots")
      .select("snapshot_version, input_fingerprint, payload, customer360_version, stale360")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();
    if (error || !data) return null;
    const payload = data.payload as DecisionContextSnapshot | null;
    if (!payload || typeof payload !== "object") return null;
    return {
      snapshot_version: Number(data.snapshot_version ?? 1),
      input_fingerprint: String(data.input_fingerprint ?? ""),
      payload: { ...payload, source: "server" },
      customer360_version:
        data.customer360_version != null ? Number(data.customer360_version) : null,
      stale360: data.stale360 === true,
    };
  } catch (e) {
    logEngineError({
      userId,
      engine: DECISION_ENGINE_VERSION,
      operation: "load_decision_context",
      errorCode: "load_failed",
      message: String(e),
    });
    return null;
  }
}

export async function persistDecisionContextSnapshot(
  snapshot: DecisionContextSnapshot,
): Promise<{ ok: boolean; snapshotVersion: number }> {
  const t0 = Date.now();
  try {
    const { adminDbLoose } = await import("@/lib/db-admin");
    const db = await adminDbLoose();
    if (!db || !snapshot.userId) return { ok: false, snapshotVersion: snapshot.snapshotVersion };

    const existing = await loadStoredDecisionContext(snapshot.userId, snapshot.date);
    const snapshotVersion = nextSnapshotVersion(
      existing
        ? {
            inputFingerprint: existing.input_fingerprint,
            snapshotVersion: existing.snapshot_version,
          }
        : null,
      snapshot.inputFingerprint,
    );

    if (existing && snapshotVersion === existing.snapshot_version) {
      logEngineDecision({
        userId: snapshot.userId,
        date: snapshot.date,
        engine: snapshot.engineVersion,
        decisionType: "snapshot",
        success: true,
        durationMs: Date.now() - t0,
        reason: "fingerprint_unchanged",
      });
      return { ok: true, snapshotVersion };
    }

    const stored: DecisionContextSnapshot = {
      ...snapshot,
      snapshotVersion,
      source: "server",
    };

    const { error } = await db.from("decision_context_snapshots").upsert(
      {
        user_id: snapshot.userId,
        date: snapshot.date,
        timezone: snapshot.timezone,
        engine: snapshot.engineVersion,
        snapshot_version: snapshotVersion,
        customer360_version: snapshot.customer360Version,
        stale360: snapshot.stale360,
        input_fingerprint: snapshot.inputFingerprint,
        payload: stored,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" },
    );

    if (error) {
      logEngineError({
        userId: snapshot.userId,
        engine: snapshot.engineVersion,
        operation: "persist_decision_context",
        errorCode: "upsert_failed",
        message: error.message,
      });
      return { ok: false, snapshotVersion };
    }

    logEngineDecision({
      userId: snapshot.userId,
      date: snapshot.date,
      engine: snapshot.engineVersion,
      decisionType: "snapshot",
      success: true,
      durationMs: Date.now() - t0,
      reason: `version_${snapshotVersion}`,
    });
    return { ok: true, snapshotVersion };
  } catch (e) {
    logEngineError({
      userId: snapshot.userId,
      engine: snapshot.engineVersion,
      operation: "persist_decision_context",
      errorCode: "persist_failed",
      message: String(e),
    });
    return { ok: false, snapshotVersion: snapshot.snapshotVersion };
  }
}

async function logAuthoritativeDecisions(snapshot: DecisionContextSnapshot): Promise<void> {
  try {
    const { logRecommendationDecisions } = await import("@/lib/decision-log.server");
    const { decisionsFromBundle } = await import("@/lib/engine/decision-contract");
    const contracts = decisionsFromBundle(snapshot);
    await logRecommendationDecisions({
      userId: snapshot.userId,
      date: snapshot.date,
      decisions: snapshot.decisions.decisions,
      snapshot: snapshot.context,
      engine: snapshot.engineVersion,
      snapshotVersion: snapshot.snapshotVersion,
      inputFingerprint: snapshot.inputFingerprint,
      decisionContracts: contracts,
    });
  } catch (e) {
    logEngineError({
      userId: snapshot.userId,
      engine: snapshot.engineVersion,
      operation: "log_decisions",
      errorCode: "log_failed",
      message: String(e),
    });
  }
}

/**
 * Hydrate domain, stale-recompute C360, assemble, persist, dual-write decision log.
 * Early-return: when stored fingerprint matches assembled inputs, reuse payload and only
 * run attribution stamp/sweep (no re-upsert / no re-log of decisions).
 */
export async function getOrBuildDecisionContext(
  userId: string,
  date?: string,
): Promise<DecisionContextBuildResult | null> {
  if (!userId) return null;

  const { hydrateAppStateFromDb } = await import("@/lib/customer360/hydrate.server");
  const { loadCustomerProfile, isCustomer360Stale, recomputeCustomer360 } =
    await import("@/lib/customer360/recompute.server");

  let state = await hydrateAppStateFromDb(userId);
  state = { ...state, userId };

  const timezone = normalizeUserTimezone(state.profile?.timezone ?? DEFAULT_USER_TIMEZONE);
  const targetDate = date ?? getUserTodayKey(timezone);

  let customer360 = await loadCustomerProfile(userId);
  const stale360 = isCustomer360Stale(customer360);
  if (stale360) {
    customer360 = await recomputeCustomer360(userId);
  }

  if (customer360?.commerce?.productIds?.length && !state.purchaseProductIds?.length) {
    state = { ...state, purchaseProductIds: customer360.commerce.productIds };
  }

  const customer360Version = customer360?.dataVersion ?? null;

  let learningPrior: import("@/lib/engine/learning").LearningPrior = {};
  try {
    const { loadPatternsBlob } = await import("@/lib/engine/learning-patterns.server");
    const { loadInterventionResponses, loadBehaviorExperiments } =
      await import("@/lib/engine/behavior/persist.server");
    const { mergeInterventionResponses } = await import("@/lib/engine/learning/responses");
    const blob = await loadPatternsBlob(userId);
    const fromDb = await loadInterventionResponses(userId);
    const experiments = await loadBehaviorExperiments(userId);
    const responses = mergeInterventionResponses(blob?.interventionResponses, fromDb);
    learningPrior = {
      ...(blob?.patterns?.length ? { patterns: blob.patterns } : {}),
      ...(responses.length ? { interventionResponses: responses } : {}),
      ...(experiments.length ? { experiments } : {}),
    };
  } catch (e) {
    logEngineError({
      userId,
      engine: DECISION_ENGINE_VERSION,
      operation: "load_learning_prior",
      errorCode: "load_failed",
      message: String(e),
    });
  }

  const stored = await loadStoredDecisionContext(userId, targetDate);

  const assembled = assembleDecisionContext(state, {
    date: targetDate,
    timezone,
    userId,
    source: "server",
    customer360Version,
    stale360,
    ...(stored ? { snapshotVersion: stored.snapshot_version } : {}),
    ...(Object.keys(learningPrior).length ? { learningPrior } : {}),
  });

  if (!assembled) {
    return { snapshot: null, state, customer360, stale360 };
  }

  const fingerprintUnchanged =
    stored != null && stored.input_fingerprint === assembled.inputFingerprint;

  let snapshot: DecisionContextSnapshot;
  let persistOk = true;

  if (fingerprintUnchanged && stored) {
    snapshot = {
      ...stored.payload,
      snapshotVersion: stored.snapshot_version,
      customer360Version,
      stale360,
      source: "server",
      inputFingerprint: stored.input_fingerprint,
      engineVersion: stored.payload.engineVersion || DECISION_ENGINE_VERSION,
    };
    logEngineDecision({
      userId,
      date: targetDate,
      engine: snapshot.engineVersion,
      decisionType: "snapshot",
      success: true,
      durationMs: 0,
      reason: "fingerprint_early_return",
    });
  } else {
    const persisted = await persistDecisionContextSnapshot(assembled);
    persistOk = persisted.ok;
    snapshot = {
      ...assembled,
      snapshotVersion: persisted.snapshotVersion,
      source: "server",
    };
    if (persistOk) {
      await logAuthoritativeDecisions(snapshot);
      try {
        const { upsertBehaviorExperiments } = await import("@/lib/engine/behavior/persist.server");
        if (snapshot.behavior?.experiments?.length) {
          await upsertBehaviorExperiments(userId, snapshot.behavior.experiments);
        }
      } catch (e) {
        logEngineError({
          userId,
          engine: snapshot.engineVersion,
          operation: "persist_experiments",
          errorCode: "persist_failed",
          message: String(e),
        });
      }
    }
  }

  if (persistOk || fingerprintUnchanged) {
    try {
      const { stampExpectedActions, sweepDelayedOutcomes, recordAttributedEvent } =
        await import("@/lib/engine/attribution.server");
      await stampExpectedActions(userId, snapshot.date);
      await sweepDelayedOutcomes(userId, snapshot.date);
      const mealsToday = (state.meals ?? []).filter((m) => m.date.slice(0, 10) === snapshot.date);
      if (mealsToday.length) {
        await recordAttributedEvent({
          userId,
          date: snapshot.date,
          actionKind: "nutrition_day_observed",
          status: "completed",
          extras: { nutritionAdherenceObservable: true },
        });
      }
    } catch (e) {
      logEngineError({
        userId,
        engine: snapshot.engineVersion,
        operation: "attribution_sweep",
        errorCode: "sweep_failed",
        message: String(e),
      });
    }
  }

  state = {
    ...state,
    livingPlans: { ...(state.livingPlans ?? {}), [snapshot.date]: snapshot.livingPlan },
    decisionContextByDate: {
      ...(state.decisionContextByDate ?? {}),
      [snapshot.date]: snapshot,
    },
  };

  return { snapshot, state, customer360, stale360 };
}
