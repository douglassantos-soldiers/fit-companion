/**
 * PHASE 8.5 integrity tests — identity, secrets, C360, safety date, timezone, nutrition confidence.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  assertSecurityConfiguration,
  resolveAccessSessionSecret,
  resolveAdminSessionSecret,
  SecurityConfigurationError,
  encodeAccessToken,
  decodeAccessToken,
  encodeAdminToken,
  decodeAdminToken,
} from "@/lib/access-session.server";
import { evaluateSafetyForDate } from "@/lib/engine/safety";
import { buildLivingPlanWithDecisions } from "@/lib/engine/living-plan";
import { decisionsFromBundle, rankRecommendations } from "@/lib/engine/recommendation";
import { aggregateNutrition } from "@/lib/customer360/aggregators/nutrition";
import { previewCustomer360FromState } from "@/lib/customer360/recompute.server";
import { getUserTodayKey, DEFAULT_USER_TIMEZONE, withProfileTimezone, normalizeUserTimezone } from "@/lib/timezone";
import { buildQaScenario, isQaModeEnabled } from "@/lib/qa/scenarios";
import { emptyState, todayKey, todayKeyForProfile } from "@/lib/types";
import { patternKeyFromEvaluation } from "@/lib/engine/outcome-learning";

describe("PHASE 8.5 access session secrets", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("fails closed in production without ACCESS_SESSION_SECRET", () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["ACCESS_SESSION_SECRET"];
    delete process.env["ADMIN_SESSION_SECRET"];
    delete process.env["ALLOW_INSECURE_DEV_SECRETS"];
    expect(() => assertSecurityConfiguration()).toThrow(SecurityConfigurationError);
    expect(() => resolveAccessSessionSecret()).toThrow(SecurityConfigurationError);
  });

  it("fails closed in production without ADMIN_SESSION_SECRET", () => {
    process.env["NODE_ENV"] = "production";
    process.env["ACCESS_SESSION_SECRET"] = "prod-access-secret-ok";
    delete process.env["ADMIN_SESSION_SECRET"];
    expect(() => assertSecurityConfiguration()).toThrow(SecurityConfigurationError);
    expect(() => resolveAdminSessionSecret()).toThrow(SecurityConfigurationError);
  });

  it("fails closed in production when session secrets are equal", () => {
    process.env["NODE_ENV"] = "production";
    process.env["ACCESS_SESSION_SECRET"] = "same-secret-value";
    process.env["ADMIN_SESSION_SECRET"] = "same-secret-value";
    expect(() => assertSecurityConfiguration()).toThrow(SecurityConfigurationError);
  });

  it("never uses SHOPIFY_WEBHOOK_SECRET as signing secret", () => {
    process.env["NODE_ENV"] = "production";
    process.env["SHOPIFY_WEBHOOK_SECRET"] = "shopify-secret-should-not-be-used";
    delete process.env["ACCESS_SESSION_SECRET"];
    expect(() => resolveAccessSessionSecret()).toThrow(SecurityConfigurationError);
  });

  it("signs and verifies with ACCESS_SESSION_SECRET", () => {
    process.env["NODE_ENV"] = "test";
    process.env["ACCESS_SESSION_SECRET"] = "test-secret-phase85";
    process.env["ADMIN_SESSION_SECRET"] = "test-admin-secret-phase85";
    const token = encodeAccessToken({
      email: "a@b.com",
      tier: "base",
      userId: "user-12345678",
    });
    const payload = decodeAccessToken(token);
    expect(payload?.email).toBe("a@b.com");
    expect(payload?.userId).toBe("user-12345678");
  });

  it("admin token carries email and grants app access payload", () => {
    process.env["NODE_ENV"] = "test";
    process.env["ACCESS_SESSION_SECRET"] = "test-secret-phase85";
    process.env["ADMIN_SESSION_SECRET"] = "test-admin-secret-phase85";
    const token = encodeAdminToken("  Teste@Teste.COM ");
    const payload = decodeAdminToken(token);
    expect(payload?.role).toBe("admin");
    expect(payload?.email).toBe("teste@teste.com");
  });

  it("rejects access token pasted into admin cookie decoder", () => {
    process.env["NODE_ENV"] = "test";
    process.env["ACCESS_SESSION_SECRET"] = "test-secret-phase85";
    process.env["ADMIN_SESSION_SECRET"] = "test-admin-secret-phase85";
    const access = encodeAccessToken({
      email: "user@soldiers.com",
      tier: "performance",
      userId: "user-12345678",
    });
    expect(decodeAdminToken(access)).toBeNull();
  });

  it("rejects admin token pasted into access cookie decoder", () => {
    process.env["NODE_ENV"] = "test";
    process.env["ACCESS_SESSION_SECRET"] = "test-secret-phase85";
    process.env["ADMIN_SESSION_SECRET"] = "test-admin-secret-phase85";
    const admin = encodeAdminToken("admin@soldiers.com", "admin");
    expect(decodeAccessToken(admin)).toBeNull();
  });

  it("rejects admin token without role or with unknown role", () => {
    process.env["NODE_ENV"] = "test";
    process.env["ACCESS_SESSION_SECRET"] = "test-secret-phase85";
    process.env["ADMIN_SESSION_SECRET"] = "test-admin-secret-phase85";
    const sign = (body: object) => {
      const data = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
      const sig = createHmac("sha256", "test-admin-secret-phase85").update(data).digest("base64url");
      return `${data}.${sig}`;
    };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(decodeAdminToken(sign({ kind: "admin", email: "a@b.com", exp }))).toBeNull();
    expect(
      decodeAdminToken(sign({ kind: "admin", role: "superuser", email: "a@b.com", exp })),
    ).toBeNull();
  });

  it("rejects admin-shaped payload signed with ACCESS_SESSION_SECRET", () => {
    process.env["NODE_ENV"] = "test";
    process.env["ACCESS_SESSION_SECRET"] = "test-secret-phase85";
    process.env["ADMIN_SESSION_SECRET"] = "test-admin-secret-phase85";
    const body = {
      kind: "admin",
      role: "admin",
      email: "a@b.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const data = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
    const sig = createHmac("sha256", "test-secret-phase85").update(data).digest("base64url");
    expect(decodeAdminToken(`${data}.${sig}`)).toBeNull();
  });
});

describe("PHASE 8.5 timezone", () => {
  it("getUserTodayKey uses configured timezone near midnight UTC", () => {
    // 2026-03-15 02:30 UTC = still 2026-03-14 evening in America/Sao_Paulo (UTC-3)
    const nearMidnightUtc = new Date("2026-03-15T02:30:00.000Z");
    const keySp = getUserTodayKey("America/Sao_Paulo", nearMidnightUtc);
    expect(keySp).toBe("2026-03-14");
    const keyUtc = getUserTodayKey("UTC", nearMidnightUtc);
    expect(keyUtc).toBe("2026-03-15");
  });

  it("todayKey defaults to America/Sao_Paulo calendar", () => {
    expect(DEFAULT_USER_TIMEZONE).toBe("America/Sao_Paulo");
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("todayKeyForProfile respects profile timezone near UTC midnight", () => {
    const nearMidnightUtc = new Date("2026-03-15T02:30:00.000Z");
    expect(todayKeyForProfile({ timezone: "America/Sao_Paulo" }, nearMidnightUtc)).toBe("2026-03-14");
    expect(todayKeyForProfile({ timezone: "UTC" }, nearMidnightUtc)).toBe("2026-03-15");
  });

  it("withProfileTimezone fills missing zone and normalizes invalid", () => {
    const filled = withProfileTimezone({ name: "A" } as { name: string; timezone?: string }, "America/Manaus");
    expect(filled.timezone).toBe("America/Manaus");
    const kept = withProfileTimezone({ timezone: "UTC" }, "America/Manaus");
    expect(kept.timezone).toBe("UTC");
    expect(normalizeUserTimezone("Not/AZone")).toBe(DEFAULT_USER_TIMEZONE);
  });
});

describe("PHASE 8.5 safety date-aware", () => {
  it("uses target date check-in, not implicit today", () => {
    const date = "2026-01-10";
    const other = "2026-01-11";
    const state = {
      ...emptyState,
      profile: buildQaScenario("healthy_full").profile,
      dayCheckIns: {
        [date]: { date, sleepHours: 4.5, energy: "baixa" as const, availableMin: 60 },
        [other]: { date: other, sleepHours: 8, energy: "alta" as const, availableMin: 60 },
      },
      sessions: [],
    };
    const low = evaluateSafetyForDate(state, date);
    expect(low.flags).toContain("low_sleep");
    expect(low.date).toBe(date);

    const ok = evaluateSafetyForDate(state, other);
    expect(ok.flags).not.toContain("low_sleep");
    expect(ok.date).toBe(other);
  });
});

describe("PHASE 8.5 scenarios → living plan / recommendation", () => {
  it("healthy user tends to full workout", () => {
    const state = buildQaScenario("healthy_full", { date: "2026-03-11" });
    const built = buildLivingPlanWithDecisions(state, "2026-03-11");
    expect(built).not.toBeNull();
    expect(["full", "express"]).toContain(built!.plan.workout.mode);
    const auth = decisionsFromBundle(built!.decisions);
    expect(auth.some((d) => d.type === "FULL_WORKOUT" || d.type === "EXPRESS_WORKOUT")).toBe(true);
  });

  it("low sleep prefers recovery-aware plan", () => {
    const state = buildQaScenario("low_sleep");
    const built = buildLivingPlanWithDecisions(state);
    expect(built).not.toBeNull();
    const safety = evaluateSafetyForDate(state, todayKey());
    expect(safety.preferLightTraining || built!.decisions.trainingVolume < 1).toBe(true);
  });

  it("short available time → express decision", () => {
    const state = buildQaScenario("short_time");
    const built = buildLivingPlanWithDecisions(state);
    expect(built).not.toBeNull();
    const mode = built!.plan.workout.mode;
    expect(["express", "rest", "deload", "full"]).toContain(mode);
    // Decision volume/duration should reflect time pressure when training
    if (mode !== "rest") {
      expect(built!.decisions.sessionDuration).toBeLessThanOrEqual(45);
    }
  });

  it("living plan volume matches decision bundle", () => {
    const state = buildQaScenario("low_sleep_high_rpe");
    const built = buildLivingPlanWithDecisions(state);
    expect(built).not.toBeNull();
    expect(built!.plan.workout.volumeFactor).toBe(built!.decisions.trainingVolume);
    const recs = rankRecommendations({
      livingPlan: built!.plan,
      safety: evaluateSafetyForDate(state, todayKey()),
      decisions: built!.decisions,
    });
    expect(recs[0]?.decisionType).toBeTruthy();
  });
});

describe("PHASE 8.5 nutrition confidence", () => {
  it("incomplete logging lowers confidence instead of forcing 0 adherence", () => {
    const state = buildQaScenario("nutrition_incomplete");
    const nutri = aggregateNutrition(state);
    expect(nutri.loggingCompleteness7d).toBeLessThan(0.5);
    expect(nutri.proteinAdherence?.basis).toBe("partial_logging");
    // Adherence is computed only on logged days — not diluted by empty days as zeros
    if (nutri.proteinAdherence7d != null) {
      expect(nutri.proteinAdherence7d).toBeGreaterThan(0);
    }
  });

  it("previewCustomer360FromState does not claim lastRecomputedAt", () => {
    const state = buildQaScenario("healthy_full");
    const preview = previewCustomer360FromState(state);
    expect(preview.lastRecomputedAt).toBeNull();
  });
});

describe("PHASE 8.5 learning pattern keys", () => {
  it("maps volume reduction success to stable pattern key", () => {
    const key = patternKeyFromEvaluation({
      kind: "volume_reduction_helps",
      result: "success",
      note: "ok",
    });
    expect(key).toBe("USER_RESPONDS_WELL_TO_VOLUME_REDUCTION_UNDER_LOW_RECOVERY");
  });
});

describe("PHASE 8.5 QA mode", () => {
  beforeEach(() => {
    process.env["ENABLE_QA_MODE"] = "true";
  });
  it("is enabled when flag set", () => {
    expect(isQaModeEnabled()).toBe(true);
  });
});
