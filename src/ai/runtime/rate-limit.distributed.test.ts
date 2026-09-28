/**
 * FASE 22.10 — Distributed rate-limit tests.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SharedMemoryRateLimitStore,
  FailClosedRateLimitStore,
  resetAiRateLimitStoreForTests,
  setAiRateLimitStoreForTests,
} from "@/ai/runtime/rate-limit-store";
import {
  checkAiRateLimits,
  isAiRateLimitDisabled,
  getAiRateLimitDefaults,
} from "@/ai/runtime/rate-limit";
import { verifyAiRateLimitReadiness } from "@/ai/certification/verify-rate-limit-readiness.server";

afterEach(() => {
  delete process.env["AI_RL_DISABLED"];
  delete process.env["AI_RL_USER_RPM"];
  delete process.env["AI_RL_BACKEND"];
  resetAiRateLimitStoreForTests();
});

describe("FASE 22.10 distributed rate limiting", () => {
  it("single instance trips at limit", async () => {
    process.env["AI_RL_USER_RPM"] = "2";
    const store = new SharedMemoryRateLimitStore();
    const uid = "u_single";
    expect((await checkAiRateLimits({ userId: uid }, store)).ok).toBe(true);
    expect((await checkAiRateLimits({ userId: uid }, store)).ok).toBe(true);
    const third = await checkAiRateLimits({ userId: uid }, store);
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.headers["Retry-After"]).toBeTruthy();
      expect(third.headers["X-RateLimit-Limit"]).toBe("2");
    }
  });

  it("multi-instance simulation shares one store", async () => {
    process.env["AI_RL_USER_RPM"] = "2";
    const shared = new Map();
    const instA = new SharedMemoryRateLimitStore(shared);
    const instB = new SharedMemoryRateLimitStore(shared);
    const uid = "u_multi";
    expect((await checkAiRateLimits({ userId: uid }, instA)).ok).toBe(true);
    expect((await checkAiRateLimits({ userId: uid }, instB)).ok).toBe(true);
    const denied = await checkAiRateLimits({ userId: uid }, instA);
    expect(denied.ok).toBe(false);
  });

  it("burst until limit", async () => {
    process.env["AI_RL_USER_RPM"] = "5";
    const store = new SharedMemoryRateLimitStore();
    const uid = "u_burst";
    let ok = 0;
    let deny = 0;
    for (let i = 0; i < 8; i++) {
      const r = await checkAiRateLimits({ userId: uid }, store);
      if (r.ok) ok++;
      else deny++;
    }
    expect(ok).toBe(5);
    expect(deny).toBe(3);
  });

  it("TTL / expiration resets window", async () => {
    process.env["AI_RL_USER_RPM"] = "1";
    let now = 1_000_000;
    const store = new SharedMemoryRateLimitStore(undefined, () => now);
    const uid = "u_ttl";
    expect((await checkAiRateLimits({ userId: uid }, store)).ok).toBe(true);
    expect((await checkAiRateLimits({ userId: uid }, store)).ok).toBe(false);
    now += 61_000;
    expect((await checkAiRateLimits({ userId: uid }, store)).ok).toBe(true);
  });

  it("concurrency respects limit", async () => {
    process.env["AI_RL_USER_RPM"] = "10";
    const store = new SharedMemoryRateLimitStore();
    const uid = "u_conc";
    const results = await Promise.all(
      Array.from({ length: 20 }, () => checkAiRateLimits({ userId: uid }, store)),
    );
    const allowed = results.filter((r) => r.ok).length;
    const denied = results.filter((r) => !r.ok).length;
    expect(allowed).toBe(10);
    expect(denied).toBe(10);
  });

  it("kill switch AI_RL_DISABLED bypasses", async () => {
    process.env["AI_RL_DISABLED"] = "1";
    process.env["AI_RL_USER_RPM"] = "1";
    const store = new SharedMemoryRateLimitStore();
    expect(isAiRateLimitDisabled()).toBe(true);
    expect((await checkAiRateLimits({ userId: "u_kill" }, store)).ok).toBe(true);
    expect((await checkAiRateLimits({ userId: "u_kill" }, store)).ok).toBe(true);
  });

  it("fail-closed store denies when production-sim", async () => {
    process.env["AI_RL_USER_RPM"] = "100";
    const store = new FailClosedRateLimitStore("simulated");
    const r = await checkAiRateLimits({ userId: "u_fc" }, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail).toMatch(/simulated|store/);
  });

  it("user isolation — different users independent", async () => {
    process.env["AI_RL_USER_RPM"] = "1";
    const store = new SharedMemoryRateLimitStore();
    expect((await checkAiRateLimits({ userId: "alice" }, store)).ok).toBe(true);
    expect((await checkAiRateLimits({ userId: "bob" }, store)).ok).toBe(true);
    expect((await checkAiRateLimits({ userId: "alice" }, store)).ok).toBe(false);
    expect((await checkAiRateLimits({ userId: "bob" }, store)).ok).toBe(false);
  });

  it("defaults expose new scopes", () => {
    const d = getAiRateLimitDefaults();
    expect(d.llm_rpm).toBeGreaterThan(0);
    expect(d.rag_rpm).toBeGreaterThan(0);
    expect(d.api_rpm).toBeGreaterThan(0);
    expect(d.admin_rpm).toBeGreaterThan(0);
    expect(d.ip_rpm).toBeGreaterThan(0);
  });

  it("migration file present + readiness without secrets → BLOCKED", async () => {
    const mig = join(
      process.cwd(),
      "supabase",
      "migrations",
      "20261101120000_fase22_10_ai_rate_limits.sql",
    );
    expect(existsSync(mig)).toBe(true);
    setAiRateLimitStoreForTests(new SharedMemoryRateLimitStore());
    const report = await verifyAiRateLimitReadiness({
      persistPath: join(process.cwd(), "docs", "certification", "rate-limit-readiness.json"),
      environment: "test",
    });
    expect(["PASS", "BLOCKED", "FAIL"]).toContain(report.verdict);
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      expect(report.verdict).toBe("BLOCKED");
      expect(report.error_code).toBe("RATE_LIMIT_VERIFICATION_BLOCKED");
    }
    expect(existsSync(join(process.cwd(), "docs", "certification", "rate-limit-readiness.json"))).toBe(
      true,
    );
  });
});
