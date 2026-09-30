/**
 * Sync push criticality + persistent failed state.
 * Critical tables must not leave the client believing a silent full save succeeded.
 */

export const CRITICAL_PUSH_TABLES = [
  "profiles",
  "users",
  "app_state",
  "sessions",
  "weights",
  "meal_entries",
  "meal_items",
  "day_checkins",
  "body_measurements",
  "progress_photos",
  "daily_metrics",
] as const;

export type PushTaskTable = string;

export function isCriticalPushTable(table: PushTaskTable): boolean {
  return (CRITICAL_PUSH_TABLES as readonly string[]).includes(table);
}

export type ClassifiedPushTasks<T> = {
  critical: T[];
  bestEffort: T[];
};

export function classifyPushTasks<T extends { table: string }>(
  tasks: T[],
): ClassifiedPushTasks<T> {
  const critical: T[] = [];
  const bestEffort: T[] = [];
  for (const t of tasks) {
    if (isCriticalPushTable(t.table)) critical.push(t);
    else bestEffort.push(t);
  }
  return { critical, bestEffort };
}

export type PushTaskResult = {
  table: string;
  error: { message?: string; code?: string } | null;
};

/**
 * Run critical writes sequentially (stop on first failure).
 * Best-effort runs only if every critical write succeeded.
 * Tasks must be lazy factories so work does not start until invoked.
 */
export async function runClassifiedPushTasks(
  tasks: Array<{ table: string; run: () => PromiseLike<unknown> }>,
): Promise<{
  results: PushTaskResult[];
  criticalFailed: boolean;
  abortedCritical: string[];
  skippedBestEffort: string[];
}> {
  const { critical, bestEffort } = classifyPushTasks(tasks);
  const results: PushTaskResult[] = [];
  const abortedCritical: string[] = [];
  const skippedBestEffort: string[] = [];
  let criticalFailed = false;

  for (const t of critical) {
    if (criticalFailed) {
      abortedCritical.push(t.table);
      results.push({
        table: t.table,
        error: { code: "aborted_after_critical_failure", message: "skipped" },
      });
      continue;
    }
    try {
      const r = (await t.run()) as { error?: { message?: string; code?: string } | null };
      const error = r?.error ?? null;
      results.push({ table: t.table, error });
      if (error) criticalFailed = true;
    } catch (e) {
      criticalFailed = true;
      results.push({
        table: t.table,
        error: e as { message?: string; code?: string },
      });
    }
  }

  if (criticalFailed) {
    for (const t of bestEffort) {
      skippedBestEffort.push(t.table);
      results.push({
        table: t.table,
        error: { code: "skipped_after_critical_failure", message: "skipped" },
      });
    }
    return { results, criticalFailed, abortedCritical, skippedBestEffort };
  }

  const best = await Promise.all(
    bestEffort.map(async (t) => {
      try {
        const r = (await t.run()) as { error?: { message?: string; code?: string } | null };
        return { table: t.table, error: r?.error ?? null };
      } catch (e) {
        return { table: t.table, error: e as { message?: string; code?: string } };
      }
    }),
  );
  results.push(...best);
  for (const r of best) {
    if (r.error) criticalFailed = true;
  }
  return { results, criticalFailed, abortedCritical, skippedBestEffort };
}

const PERSISTENT_FAIL_KEY = "soldiers-sync-persistent-fail-v1";

export type PersistentSyncFailure = {
  at: string;
  errors: Array<{ table: string; code: string }>;
  deviceId: string;
};

export function recordPersistentSyncFailure(
  failure: PersistentSyncFailure,
  storage: Pick<Storage, "setItem"> | null = typeof window !== "undefined" ? window.localStorage : null,
): void {
  if (!storage) return;
  try {
    storage.setItem(PERSISTENT_FAIL_KEY, JSON.stringify(failure));
  } catch {
    /* quota */
  }
}

export function clearPersistentSyncFailure(
  storage: Pick<Storage, "removeItem"> | null = typeof window !== "undefined"
    ? window.localStorage
    : null,
): void {
  if (!storage) return;
  try {
    storage.removeItem(PERSISTENT_FAIL_KEY);
  } catch {
    /* ignore */
  }
}

export function readPersistentSyncFailure(
  storage: Pick<Storage, "getItem"> | null = typeof window !== "undefined" ? window.localStorage : null,
): PersistentSyncFailure | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PERSISTENT_FAIL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistentSyncFailure;
    if (!parsed?.at || !Array.isArray(parsed.errors)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export { PERSISTENT_FAIL_KEY };
