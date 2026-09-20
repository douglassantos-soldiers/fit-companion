/**
 * Fase 15 — wearable ingest, ranking labels, anti-fraud policy (warn, never ban).
 */
import { describe, expect, it } from "vitest";
import { applyFraudPolicy } from "@/lib/engine/anti-fraud-policy";
import { validateActivityLog, validateChallengeProgress } from "@/lib/engine/anti-fraud";
import { buildProofOfPerformance } from "@/lib/engine/proof-of-performance";
import { isAccountBlocked } from "@/lib/account-status";
import {
  challengeProofFromLogs,
  filterLeaderboardByProof,
} from "@/lib/wearables/challenge-proof";
import {
  mergeActivityLogs,
  normalizeHealthDump,
  normalizeStravaActivities,
  proofStatusForProvider,
  samplesToActivityLogs,
} from "@/lib/wearables/normalize";
import { emptyState, type ActivityLogEntry } from "@/lib/types";
import { stravaOAuthConfigured, garminOAuthConfigured } from "@/lib/wearables/wearable.functions";

const STRAVA_FIXTURE = [
  {
    id: 42,
    type: "Walk",
    start_date: "2026-09-19T12:00:00Z",
    distance: 5000,
    steps: 7200,
  },
];

describe("ingest", () => {
  it("maps Strava fixture to verified logs and dedupes on merge", () => {
    const samples = normalizeStravaActivities(STRAVA_FIXTURE);
    const logs = samplesToActivityLogs(samples, "oauth");
    expect(logs.some((l) => l.kind === "steps" && l.value === 7200)).toBe(true);
    expect(logs.every((l) => l.status === "verified" && l.source === "strava")).toBe(true);
    const again = samplesToActivityLogs(samples, "oauth");
    const merged = mergeActivityLogs(logs, again);
    expect(merged).toHaveLength(logs.length);
  });

  it("never verifies Apple Health / Health Connect on web", () => {
    expect(proofStatusForProvider("apple_health", "oauth")).toBe("pending");
    expect(proofStatusForProvider("health_connect", "import")).toBe("pending");
    const samples = normalizeHealthDump("apple_health", [
      { id: "h1", date: "2026-09-19", kind: "steps", value: 4000 },
    ]);
    const logs = samplesToActivityLogs(samples, "oauth");
    expect(logs[0]?.status).toBe("pending");
    expect(logs[0]?.source).toBe("apple_health");
  });
});

describe("challenge proof", () => {
  it("stays self_reported for manual steps and becomes verified with Strava", () => {
    const manual: ActivityLogEntry = {
      id: "m",
      date: "2026-09-19",
      kind: "steps",
      value: 3000,
      source: "app_manual",
      status: "self_reported",
    };
    expect(challengeProofFromLogs("steps", [manual], 30, new Date("2026-09-19T18:00:00")).status).toBe(
      "self_reported",
    );
    const strava = samplesToActivityLogs(normalizeStravaActivities(STRAVA_FIXTURE), "oauth");
    const proof = challengeProofFromLogs("steps", [...strava, manual], 30, new Date("2026-09-19T18:00:00"));
    expect(proof.status).toBe("verified");
    expect(proof.source).toBe("strava");
  });

  it("filters leaderboard to verified-only and re-ranks", () => {
    const rows = [
      { deviceId: "a", displayName: "A", value: 10, rank: 1, isYou: false, proofStatus: "self_reported" as const },
      { deviceId: "b", displayName: "B", value: 8, rank: 2, isYou: false, proofStatus: "verified" as const },
    ];
    const mixed = filterLeaderboardByProof(rows, false);
    expect(mixed).toHaveLength(2);
    const only = filterLeaderboardByProof(rows, true);
    expect(only).toHaveLength(1);
    expect(only[0]?.deviceId).toBe("b");
    expect(only[0]?.rank).toBe(1);
  });
});

describe("anti-fraud policy", () => {
  it("blocks impossible values and warns on spikes without banning", () => {
    const blocked = applyFraudPolicy(validateActivityLog({ kind: "steps", value: 250_000, date: "2026-09-19" }));
    expect(blocked.action).toBe("block_input");
    const spike = applyFraudPolicy(
      validateChallengeProgress({ value: 100, baseline: 10, metric: "sessoes" }),
    );
    expect(spike.action).toBe("warn");
    expect(spike.userMessage).toMatch(/não é banimento/i);
    expect(isAccountBlocked({ status: "active", statusUntil: null })).toBe(false);
  });
});

describe("proof of performance", () => {
  it("stays self_reported without wearables and verifies when a log is verified", () => {
    expect(buildProofOfPerformance(emptyState).status).toBe("self_reported");
    const withStrava = {
      ...emptyState,
      activityLogs: samplesToActivityLogs(normalizeStravaActivities(STRAVA_FIXTURE), "oauth"),
    };
    const proof = buildProofOfPerformance(withStrava);
    expect(proof.status).toBe("verified");
    expect(proof.source).toBe("strava");
    expect(proof.verifiedAt).not.toBeNull();
  });
});

describe("oauth gate", () => {
  it("reports Strava/Garmin as unconfigured without env", () => {
    expect(stravaOAuthConfigured()).toBe(false);
    expect(garminOAuthConfigured()).toBe(false);
  });
});
