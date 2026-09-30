import { describe, expect, it } from "vitest";
import {
  classifyPushTasks,
  isCriticalPushTable,
  recordPersistentSyncFailure,
  readPersistentSyncFailure,
  clearPersistentSyncFailure,
  runClassifiedPushTasks,
  PERSISTENT_FAIL_KEY,
} from "./critical";
import { shouldAckPushAndFlushOutbox } from "@/lib/sync";

describe("critical push tables", () => {
  it("marks core domain tables as critical", () => {
    expect(isCriticalPushTable("sessions")).toBe(true);
    expect(isCriticalPushTable("meal_entries")).toBe(true);
    expect(isCriticalPushTable("supplement_logs")).toBe(false);
  });

  it("classifies tasks", () => {
    const { critical, bestEffort } = classifyPushTasks([
      { table: "sessions" },
      { table: "supplement_logs" },
      { table: "profiles" },
    ]);
    expect(critical.map((t) => t.table)).toEqual(["sessions", "profiles"]);
    expect(bestEffort.map((t) => t.table)).toEqual(["supplement_logs"]);
  });
});

describe("runClassifiedPushTasks partial failure", () => {
  it("stops further critical writes and skips best-effort after first critical failure", async () => {
    const started: string[] = [];
    const { results, criticalFailed, abortedCritical, skippedBestEffort } =
      await runClassifiedPushTasks([
        {
          table: "profiles",
          run: () => {
            started.push("profiles");
            return Promise.resolve({ error: { code: "23505" } });
          },
        },
        {
          table: "sessions",
          run: () => {
            started.push("sessions");
            return Promise.resolve({ error: null });
          },
        },
        {
          table: "supplement_logs",
          run: () => {
            started.push("supplement_logs");
            return Promise.resolve({ error: null });
          },
        },
      ]);

    expect(criticalFailed).toBe(true);
    expect(started).toEqual(["profiles"]);
    expect(abortedCritical).toContain("sessions");
    expect(skippedBestEffort).toContain("supplement_logs");
    expect(results.some((r) => r.table === "sessions" && r.error?.code === "aborted_after_critical_failure")).toBe(
      true,
    );
  });

  it("runs best-effort only after all critical succeed", async () => {
    const started: string[] = [];
    const { criticalFailed } = await runClassifiedPushTasks([
      {
        table: "sessions",
        run: () => {
          started.push("sessions");
          return Promise.resolve({ error: null });
        },
      },
      {
        table: "supplement_logs",
        run: () => {
          started.push("supplement_logs");
          return Promise.resolve({ error: null });
        },
      },
    ]);
    expect(criticalFailed).toBe(false);
    expect(started).toEqual(["sessions", "supplement_logs"]);
  });
});

describe("persistent sync failure", () => {
  it("records and clears failure state", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    };
    recordPersistentSyncFailure(
      {
        at: "2026-09-30T00:00:00.000Z",
        deviceId: "d1",
        errors: [{ table: "sessions", code: "write_failed" }],
      },
      storage,
    );
    expect(readPersistentSyncFailure(storage)?.errors[0]?.table).toBe("sessions");
    expect(mem.has(PERSISTENT_FAIL_KEY)).toBe(true);
    clearPersistentSyncFailure(storage);
    expect(readPersistentSyncFailure(storage)).toBeNull();
  });

  it("ACK policy rejects persistentFailed", () => {
    expect(
      shouldAckPushAndFlushOutbox({
        ok: false,
        persistentFailed: true,
        userId: "u1",
        errors: [{ table: "sessions", code: "x" }],
      }),
    ).toBe(false);
  });
});
