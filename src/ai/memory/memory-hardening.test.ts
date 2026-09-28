/**
 * FASE 22.3 — Production Memory Persistence hardening tests.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MEMORY_ERROR,
  MemoryError,
  checkMemoryHealth,
  checkMemoryPersistence,
  clearMemoryStoreRegistration,
  createMemory,
  ensureMemoryStore,
  getActiveMemoryStore,
  getMemoryReadiness,
  getMemoryStore,
  invalidateMemory,
  resetMemoryInfrastructure,
  retrieveMemory,
  setMemoryStore,
  updateMemory,
  InMemoryMemoryStore,
  SupabaseMemoryStore,
} from "@/ai/memory";

const USER_A = "user-mem-harden-aaaa";
const USER_B = "user-mem-harden-bbbb";

const PREV_ENV = { ...process.env };

beforeEach(() => {
  process.env["VITEST"] = "true";
  delete process.env["AI_MEMORY_ENV"];
  delete process.env["AI_MEMORY_STORE"];
  resetMemoryInfrastructure();
});

afterEach(() => {
  // Restore env before reset so registerMemoryInfrastructure can attach InMemory
  process.env["VITEST"] = PREV_ENV["VITEST"] ?? "true";
  if (PREV_ENV["AI_MEMORY_ENV"] !== undefined) {
    process.env["AI_MEMORY_ENV"] = PREV_ENV["AI_MEMORY_ENV"];
  } else {
    delete process.env["AI_MEMORY_ENV"];
  }
  if (PREV_ENV["AI_MEMORY_STORE"] !== undefined) {
    process.env["AI_MEMORY_STORE"] = PREV_ENV["AI_MEMORY_STORE"];
  } else {
    delete process.env["AI_MEMORY_STORE"];
  }
  resetMemoryInfrastructure();
});

describe("FASE 22.3 production Memory hardening", () => {
  it("write / read / update / invalidate", async () => {
    const created = await createMemory({
      trustedUserId: USER_A,
      family: "user",
      type: "preferences",
      key: "tempo",
      data: { value: "morning" },
      source: "user",
      confidence: 0.9,
    });
    expect(created.ok).toBe(true);
    expect(created.record.version).toBe(1);

    const listed = await retrieveMemory({
      trustedUserId: USER_A,
      family: "user",
      type: "preferences",
      key: "tempo",
    });
    expect(listed.records).toHaveLength(1);

    const updated = await updateMemory({
      trustedUserId: USER_A,
      memoryId: created.record.memory_id,
      patch: { data: { value: "evening" } },
    });
    expect(updated.record.version).toBe(2);
    expect(updated.record.data["value"]).toBe("evening");

    const inv = await invalidateMemory({
      trustedUserId: USER_A,
      memoryId: created.record.memory_id,
      reason: "test",
    });
    expect(inv.record.status).toBe("invalidated");
    expect(inv.record.version).toBe(3);

    const after = await retrieveMemory({
      trustedUserId: USER_A,
      family: "user",
      type: "preferences",
      key: "tempo",
    });
    expect(after.records).toHaveLength(0);
  });

  it("production never falls back to InMemory when supabase fails", async () => {
    clearMemoryStoreRegistration();
    process.env["AI_MEMORY_ENV"] = "production";
    delete process.env["VITEST"];
    process.env["AI_MEMORY_STORE"] = "supabase";

    await expect(ensureMemoryStore({ force: true })).rejects.toBeInstanceOf(MemoryError);
    expect(getActiveMemoryStore()).toBeNull();

    expect(() => getMemoryStore()).toThrow(/MEMORY_UNAVAILABLE/);
    expect(getActiveMemoryStore()?.id).not.toBe("memory_v1");
  });

  it("AI_MEMORY_STORE=memory forbidden in production", async () => {
    process.env["AI_MEMORY_ENV"] = "production";
    delete process.env["VITEST"];
    process.env["AI_MEMORY_STORE"] = "memory";
    clearMemoryStoreRegistration();
    await expect(ensureMemoryStore({ force: true })).rejects.toThrow(/memory is forbidden/);
  });

  it("cross-user isolation", async () => {
    await createMemory({
      trustedUserId: USER_A,
      family: "user",
      type: "facts",
      key: "note-user-a",
      data: { note: "private" },
      source: "system",
      confidence: 0.8,
    });
    const bView = await retrieveMemory({ trustedUserId: USER_B, family: "user" });
    expect(bView.records).toHaveLength(0);
  });

  it("authorization / anonymous denied", async () => {
    await expect(
      createMemory({
        trustedUserId: null,
        family: "user",
        type: "facts",
        data: { note: "x" },
        source: "system",
        confidence: 0.8,
      }),
    ).rejects.toMatchObject({ code: MEMORY_ERROR.ANONYMOUS_DENIED });
  });

  it("duplicate key idempotency / conflict", async () => {
    const input = {
      trustedUserId: USER_A,
      family: "user" as const,
      type: "goals",
      key: "primary",
      data: { goal: "hypertrophy" },
      source: "user" as const,
      confidence: 0.85,
    };
    const a = await createMemory(input);
    const b = await createMemory(input);
    expect(b.record.memory_id).toBe(a.record.memory_id);

    await expect(
      createMemory({ ...input, data: { goal: "strength" } }),
    ).rejects.toMatchObject({ code: MEMORY_ERROR.CONFLICTING_MEMORY });

    const c = await createMemory({ ...input, data: { goal: "strength" }, supersede: true });
    expect(c.record.memory_id).not.toBe(a.record.memory_id);
    expect(c.record.version).toBe(1);
  });

  it("concurrency parallel creates", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        createMemory({
          trustedUserId: USER_A,
          family: "user",
          type: "facts",
          key: `parallel-${i}`,
          data: { i },
          source: "system",
          confidence: 0.7,
        }),
      ),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    const ids = new Set(results.map((r) => r.record.memory_id));
    expect(ids.size).toBe(8);
  });

  it("TTL / expiration marking", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    await createMemory({
      trustedUserId: USER_A,
      family: "user",
      type: "facts",
      key: "expired-key",
      data: { note: "gone" },
      source: "system",
      confidence: 0.8,
      expiresAt: past,
    });
    const active = await retrieveMemory({
      trustedUserId: USER_A,
      family: "user",
      type: "facts",
      key: "expired-key",
    });
    expect(active.records).toHaveLength(0);

    const withExpired = await retrieveMemory({
      trustedUserId: USER_A,
      family: "user",
      type: "facts",
      key: "expired-key",
      includeExpired: true,
    });
    expect(withExpired.records.some((r) => r.status === "expired")).toBe(true);
  });

  it("sensitive key rejection", async () => {
    await expect(
      createMemory({
        trustedUserId: USER_A,
        family: "user",
        type: "facts",
        data: { password: "secret" },
        source: "system",
        confidence: 0.9,
      }),
    ).rejects.toMatchObject({ code: MEMORY_ERROR.SENSITIVE_KEY });
  });

  it("restart / persistence against Map-backed store", async () => {
    const persistent = new InMemoryMemoryStore();
    setMemoryStore(persistent);

    const created = await createMemory({
      trustedUserId: USER_A,
      family: "user",
      type: "coach_notes",
      key: "note-restart",
      data: { text: "survives restart" },
      source: "coach",
      confidence: 0.5,
    });

    // Simulate process restart: clear registration, re-attach same adapter
    clearMemoryStoreRegistration();
    expect(getActiveMemoryStore()).toBeNull();
    setMemoryStore(persistent);

    const again = await retrieveMemory({
      trustedUserId: USER_A,
      family: "user",
      type: "coach_notes",
      key: "note-restart",
    });
    expect(again.records.some((r) => r.memory_id === created.record.memory_id)).toBe(true);
  });

  it("checkMemoryPersistence round-trip (InMemory)", async () => {
    const report = await checkMemoryPersistence({
      userId: USER_A,
      simulateRestart: true,
    });
    expect(report.write_ok).toBe(true);
    expect(report.read_ok).toBe(true);
    expect(report.restart_ok).toBe(true);
    expect(report.ok).toBe(true);
  });

  it("checkMemoryHealth + getMemoryReadiness in test env", async () => {
    const health = await checkMemoryHealth();
    expect(health.environment).toBe("test");
    expect(health.checks.find((c) => c.id === "validate_write")?.ok).toBe(true);
    expect(health.checks.find((c) => c.id === "database")?.ok).toBe(true);

    const ready = await getMemoryReadiness();
    expect(ready.MEMORY_READY).toBe(true);
    expect(ready.health.store_id).toBe("memory_v1");
  });

  it("SupabaseMemoryStore ping fails closed without db", async () => {
    const bad = new SupabaseMemoryStore(async () => null);
    const ok = await bad.ping();
    expect(ok).toBe(false);
    await expect(
      bad.insert({
        memory_id: "m1",
        user_id: USER_A,
        family: "user",
        type: "facts",
        data: { x: 1 },
        source: "system",
        confidence: 0.5,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
      }),
    ).rejects.toMatchObject({ code: MEMORY_ERROR.UNAVAILABLE });
  });

  it("rejects llm / agent_raw sources", async () => {
    await expect(
      createMemory({
        trustedUserId: USER_A,
        family: "user",
        type: "facts",
        data: { note: "from model" },
        source: "llm",
        confidence: 0.9,
      }),
    ).rejects.toMatchObject({ code: MEMORY_ERROR.FORBIDDEN_SOURCE });
  });
});
