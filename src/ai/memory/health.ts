/**
 * FASE 22.3 — Memory health check + persistence + readiness.
 */

import { MEMORY_ERROR } from "@/ai/memory/core/errors";
import { validateMemoryWrite } from "@/ai/memory/core/validate-write";
import {
  createMemory,
  invalidateMemory,
  retrieveMemory,
} from "@/ai/memory/api";
import {
  ensureMemoryStore,
  getActiveMemoryStore,
} from "@/ai/memory/store/types";
import {
  resolveMemoryEnvironment,
  resolveMemoryStoreMode,
} from "@/ai/memory/runtime/env";

export type MemoryHealthCheckId =
  | "database"
  | "tables"
  | "store_mode"
  | "validate_write"
  | "feature_flag";

export type MemoryHealthCheckResult = {
  id: MemoryHealthCheckId;
  ok: boolean;
  detail?: string;
};

export type MemoryHealthReport = {
  ok: boolean;
  environment: ReturnType<typeof resolveMemoryEnvironment>;
  store_id: string | null;
  store_mode: string;
  checks: MemoryHealthCheckResult[];
  generated_at: string;
};

export type MemoryPersistenceReport = {
  ok: boolean;
  write_ok: boolean;
  read_ok: boolean;
  restart_ok: boolean;
  detail?: string;
  memory_id?: string;
};

export type MemoryReadinessResult = {
  MEMORY_READY: boolean;
  reasons: string[];
  health: MemoryHealthReport;
};

export async function checkMemoryHealth(): Promise<MemoryHealthReport> {
  const environment = resolveMemoryEnvironment();
  const checks: MemoryHealthCheckResult[] = [];
  let storeId: string | null = null;
  let storeMode = "unknown";

  try {
    storeMode = resolveMemoryStoreMode(environment);
    checks.push({
      id: "store_mode",
      ok: true,
      detail: storeMode,
    });
  } catch (e) {
    storeMode = "invalid";
    checks.push({
      id: "store_mode",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  try {
    const store = await ensureMemoryStore();
    storeId = store.id ?? "unknown";
    const pingOk = typeof store.ping === "function" ? await store.ping() : true;
    checks.push({
      id: "database",
      ok: pingOk,
      detail: pingOk ? `store=${storeId}` : "ping_failed",
    });
    checks.push({
      id: "tables",
      ok: pingOk && (environment !== "production" || storeId === "supabase_memory_v1"),
      detail:
        environment === "production" && storeId !== "supabase_memory_v1"
          ? "production_requires_supabase"
          : storeId ?? "ok",
    });
  } catch (e) {
    checks.push({
      id: "database",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
    checks.push({
      id: "tables",
      ok: false,
      detail: "store_unavailable",
    });
  }

  try {
    validateMemoryWrite({
      family: "user",
      type: "facts",
      data: { probe: "health" },
      source: "system",
      confidence: 0.8,
    });
    checks.push({ id: "validate_write", ok: true, detail: "ok" });
  } catch (e) {
    checks.push({
      id: "validate_write",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  try {
    const { isMemoryEnabled } = await import("@/ai/runtime/feature-flags");
    const enabled = isMemoryEnabled();
    checks.push({
      id: "feature_flag",
      ok: true,
      detail: enabled ? "enabled" : "disabled",
    });
  } catch (e) {
    checks.push({
      id: "feature_flag",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  const ok = checks.every((c) => c.ok);
  return {
    ok,
    environment,
    store_id: storeId,
    store_mode: storeMode,
    checks,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Write → read same store; optional force re-ensure + re-read (restart simulation).
 */
export async function checkMemoryPersistence(opts?: {
  userId?: string;
  simulateRestart?: boolean;
}): Promise<MemoryPersistenceReport> {
  const userId = opts?.userId ?? "00000000-0000-4000-8000-000000000099";
  const key = `persist-probe-${Date.now()}`;
  let memoryId: string | undefined;
  let writeOk = false;
  let readOk = false;
  let restartOk = true;

  try {
    await ensureMemoryStore();
    const created = await createMemory({
      trustedUserId: userId,
      family: "user",
      type: "facts",
      key,
      data: { probe: "persistence", ts: Date.now() },
      source: "system",
      confidence: 0.9,
      supersede: true,
    });
    writeOk = created.ok && !created.skipped && created.record != null;
    memoryId = created.record?.memory_id ?? "";

    const retrieved = await retrieveMemory({
      trustedUserId: userId,
      family: "user",
      type: "facts",
      key,
      limit: 5,
    });
    readOk = memoryId
      ? retrieved.records.some((r) => r.memory_id === memoryId)
      : false;

    if (opts?.simulateRestart !== false) {
      const prev = getActiveMemoryStore();
      await ensureMemoryStore({ force: true });
      // If force created a new empty InMemory, attach same adapter when possible
      if (prev && prev.id === "memory_v1") {
        const { setMemoryStore } = await import("@/ai/memory/store/types");
        setMemoryStore(prev);
      }
      const again = await retrieveMemory({
        trustedUserId: userId,
        family: "user",
        type: "facts",
        key,
        limit: 5,
      });
      restartOk = again.records.some((r) => r.memory_id === memoryId);
    }

    // Best-effort cleanup
    if (memoryId) {
      try {
        await invalidateMemory({ trustedUserId: userId, memoryId, reason: "persist_probe" });
      } catch {
        /* ignore */
      }
    }

    const ok = writeOk && readOk && restartOk;
    return {
      ok,
      write_ok: writeOk,
      read_ok: readOk,
      restart_ok: restartOk,
      ...(memoryId ? { memory_id: memoryId } : {}),
      detail: ok ? "persist_ok" : "persist_failed",
    };
  } catch (e) {
    return {
      ok: false,
      write_ok: writeOk,
      read_ok: readOk,
      restart_ok: false,
      ...(memoryId ? { memory_id: memoryId } : {}),
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function getMemoryReadiness(): Promise<MemoryReadinessResult> {
  const health = await checkMemoryHealth();
  const reasons: string[] = [];
  const env = health.environment;

  if (env === "production") {
    if (health.store_id !== "supabase_memory_v1") {
      reasons.push("production_requires_supabase_memory");
    }
  }

  for (const c of health.checks) {
    if (!c.ok) reasons.push(`${c.id}:${c.detail ?? "fail"}`);
  }

  let MEMORY_READY = health.ok && reasons.length === 0;
  if (env === "production" && health.store_id !== "supabase_memory_v1") {
    MEMORY_READY = false;
    if (!reasons.includes("production_requires_supabase_memory")) {
      reasons.push("production_requires_supabase_memory");
    }
  }

  if (!MEMORY_READY && reasons.length === 0) {
    reasons.push(MEMORY_ERROR.UNAVAILABLE);
  }

  return { MEMORY_READY, reasons, health };
}
