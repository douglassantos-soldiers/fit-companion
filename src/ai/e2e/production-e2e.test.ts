/**
 * FASE 22.12 — Real Production E2E tests.
 * Without secrets → BLOCKED. InMemory never counts as PASS.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runProductionE2E } from "@/ai/e2e/production-e2e";
import { runProductionE2EFailures } from "@/ai/e2e/production-e2e-failures";
import { verifyProductionE2EReadiness } from "@/ai/certification/verify-production-e2e-readiness.server";

afterEach(() => {
  delete process.env["AI_FORCE_DETERMINISTIC"];
  delete process.env["AI_GLOBAL_ENABLED"];
});

describe("FASE 22.12 real production E2E", () => {
  it("without service_role → BLOCKED + PRODUCTION_E2E_BLOCKED", async () => {
    const report = await runProductionE2E({
      mode: "full",
      persistPath: join(process.cwd(), "docs", "certification", "production-e2e.json"),
    });
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      expect(report.verdict).toBe("BLOCKED");
      expect(report.error_code).toBe("PRODUCTION_E2E_BLOCKED");
    } else {
      expect(["PASS", "BLOCKED", "FAIL"]).toContain(report.verdict);
    }
    expect(existsSync(join(process.cwd(), "docs", "certification", "production-e2e.json"))).toBe(
      true,
    );
  });

  it("InMemory / mock stores never PASS (mock_store_forbidden)", async () => {
    const report = await runProductionE2E({
      mode: "failures",
      persistPath: null,
      testOverrides: {
        skipRemoteGate: true,
        dbVerdict: "PASS",
        forceStoreIds: { rag: "in_memory_v1", memory: "memory_v1" },
      },
    });
    expect(report.verdict).toBe("FAIL");
    expect(report.notes.some((n) => n.includes("mock_store"))).toBe(true);
  });

  it("failure scenarios are expected_fail and observable", async () => {
    const failures = await runProductionE2EFailures();
    expect(failures.length).toBeGreaterThanOrEqual(5);
    const unauthorized = failures.find((f) => f.id === "unauthorized_tool");
    expect(unauthorized?.ok).toBe(true);
    expect(unauthorized?.expected_fail).toBe(true);
    const tool = failures.find((f) => f.id === "tool_failure");
    expect(tool?.ok).toBe(true);
    const rag = failures.find((f) => f.id === "rag_failure");
    expect(rag?.ok).toBe(true);
    const mem = failures.find((f) => f.id === "memory_failure");
    expect(mem?.ok).toBe(true);
    const safety = failures.find((f) => f.id === "safety_rejection");
    expect(safety?.ok).toBe(true);
  });

  it("readiness wrapper persists artifact", async () => {
    const report = await verifyProductionE2EReadiness({
      mode: "failures",
      persistPath: join(process.cwd(), "docs", "certification", "production-e2e.json"),
    });
    expect(["PASS", "BLOCKED", "FAIL"]).toContain(report.verdict);
    expect(report.path_label).toBe("PRODUCTION_E2E");
  });

  it("kill_switch and idempotency included in full report", async () => {
    const report = await runProductionE2E({ mode: "full", persistPath: null });
    expect(report.kill_switch?.ok).toBe(true);
    expect(report.idempotency?.ok).toBe(true);
    expect(report.failures.length).toBeGreaterThan(0);
  });
});
