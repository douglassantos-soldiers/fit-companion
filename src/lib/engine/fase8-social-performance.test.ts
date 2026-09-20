import { describe, expect, it } from "vitest";
import {
  CHALLENGES,
  challengeById,
  computePersonalTarget,
  isPersonalizedChallenge,
  isRelativeChallenge,
} from "@/data/challenges";
import {
  sessionFingerprint,
  validateActivityLog,
  validateChallengeProgress,
  validateSessionEvent,
} from "@/lib/engine/anti-fraud";
import {
  buildPerformanceProfile,
  PERFORMANCE_PROFILE_DISCLAIMER,
} from "@/lib/engine/performance-profile";
import { buildProofOfPerformance, relativeRankOrder } from "@/lib/engine/proof-of-performance";
import { challengeProgress, challengeRawValue } from "@/lib/social";
import { normalizeEventType } from "@/lib/events/normalize";
import { emptyState, type Profile, type SessionLog } from "@/lib/types";

const profile: Profile = {
  name: "Test",
  goal: "massa",
  level: "intermediario",
  daysPerWeek: 4,
  age: 30,
  heightCm: 178,
  weightKg: 80,
  equipment: "academia",
  restrictions: [],
  createdAt: new Date().toISOString(),
};

function session(partial: Partial<SessionLog> & { id: string; date: string }): SessionLog {
  return {
    dayId: "a",
    title: "Treino",
    durationMin: 45,
    exercises: [],
    volumeKg: 5000,
    ...partial,
  };
}

describe("FASE 8 catalog", () => {
  it("covers required categories", () => {
    const cats = new Set(CHALLENGES.map((c) => c.category));
    for (const c of [
      "consistency",
      "transformation",
      "strength",
      "running",
      "steps",
      "football",
      "muscle_gain",
      "conditioning",
    ]) {
      expect(cats.has(c as never)).toBe(true);
    }
  });

  it("keeps legacy challenge ids", () => {
    expect(challengeById("consistencia-21")).toBeTruthy();
    expect(challengeById("hub-massa-60")?.category).toBe("muscle_gain");
  });
});

describe("personalized targets", () => {
  const c = challengeById("consistencia-30-personal")!;

  it("is personalized mode", () => {
    expect(isPersonalizedChallenge(c)).toBe(true);
    expect(isRelativeChallenge(c)).toBe(false);
  });

  it("gives different targets for different baselines", () => {
    const a = computePersonalTarget(c, 12);
    const b = computePersonalTarget(c, 6);
    expect(a).toBeGreaterThan(b);
    expect(a).toBeGreaterThanOrEqual(c.personalTargetMin!);
    expect(a).toBeLessThanOrEqual(c.personalTargetMax!);
  });

  it("completes when current reaches personal target", () => {
    const baseline = 10;
    const target = computePersonalTarget(c, baseline);
    const sessions = Array.from({ length: target }, (_, i) =>
      session({
        id: `s${i}`,
        date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
        volumeKg: 1000,
      }),
    );
    const progress = challengeProgress(c, sessions, {
      baseline,
      personalTarget: target,
    });
    expect(progress.personalTarget).toBe(target);
    expect(progress.complete).toBe(true);
    expect(progress.pct).toBeGreaterThanOrEqual(100);
  });
});

describe("relative performance", () => {
  it("ranks by relative evolution", () => {
    const order = relativeRankOrder([
      { id: "a", current: 12, baseline: 10 },
      { id: "b", current: 20, baseline: 10 },
      { id: "c", current: 11, baseline: 10 },
    ]);
    expect(order).toEqual(["b", "a", "c"]);
  });

  it("relative challenge uses pct vs baseline", () => {
    const c = challengeById("evolucao-consistencia-14")!;
    const sessions = Array.from({ length: 9 }, (_, i) =>
      session({
        id: `r${i}`,
        date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
      }),
    );
    const progress = challengeProgress(c, sessions, 6);
    expect(progress.pct).toBeGreaterThan(0);
    expect(progress.displayUnit).toBe("%");
  });
});

describe("performance profile", () => {
  it("exposes 7 product indicators + disclaimer", () => {
    const state = { ...emptyState, profile };
    const pp = buildPerformanceProfile(state, profile);
    expect(pp.indicators).toHaveLength(7);
    expect(pp.indicators.map((i) => i.key)).toEqual([
      "strength",
      "conditioning",
      "nutrition",
      "recovery",
      "consistency",
      "mobility",
      "performance_level",
    ]);
    expect(pp.disclaimer).toBe(PERFORMANCE_PROFILE_DISCLAIMER);
    expect(pp.indicators.find((i) => i.key === "performance_level")?.levelLabel).toBe(
      "Intermediário",
    );
  });
});

describe("proof of performance", () => {
  it("is always self_reported today", () => {
    const proof = buildProofOfPerformance({ ...emptyState, profile }, 21);
    expect(proof.status).toBe("self_reported");
    expect(proof.source).toBe("app_session");
    expect(proof.verifiedAt).toBeNull();
  });
});

describe("anti-fraud", () => {
  it("flags duplicate session fingerprints", () => {
    const fp = sessionFingerprint({
      date: "2026-09-18",
      dayId: "a",
      volumeKg: 5000,
      durationMin: 45,
    });
    const r = validateSessionEvent({
      deviceId: "d1",
      date: "2026-09-18",
      dayId: "a",
      volumeKg: 5000,
      durationMin: 45,
      recentFingerprints: [fp],
    });
    expect(r.flags.some((f) => f.code === "duplicate_event")).toBe(true);
    expect(r.ok).toBe(false);
  });

  it("rejects impossible step counts", () => {
    const r = validateActivityLog({ kind: "steps", value: 250_000, date: "2026-09-18" });
    expect(r.ok).toBe(false);
    expect(r.flags.some((f) => f.code === "impossible_value")).toBe(true);
  });

  it("flags suspicious challenge spikes without hard-failing medium", () => {
    const r = validateChallengeProgress({
      value: 100,
      baseline: 10,
      metric: "sessoes",
    });
    expect(r.flags.some((f) => f.code === "suspicious_spike")).toBe(true);
  });
});

describe("activity metric proxies", () => {
  it("counts cardio sessions for running challenges", () => {
    const c = challengeById("corrida-12-sessoes")!;
    const sessions = [
      session({
        id: "1",
        date: new Date().toISOString().slice(0, 10),
        exercises: [{ exerciseId: "corrida", sets: [] }],
      }),
      session({
        id: "2",
        date: new Date().toISOString().slice(0, 10),
        exercises: [{ exerciseId: "supino", sets: [] }],
      }),
    ];
    expect(challengeRawValue(c, sessions)).toBe(1);
  });

  it("sums self-reported steps", () => {
    const c = challengeById("passos-30d")!;
    const value = challengeRawValue(c, [], [
      {
        id: "a",
        date: new Date().toISOString().slice(0, 10),
        kind: "steps",
        value: 8000,
        source: "app_manual",
        status: "self_reported",
      },
      {
        id: "b",
        date: new Date().toISOString().slice(0, 10),
        kind: "steps",
        value: 2000,
        source: "app_manual",
        status: "self_reported",
      },
    ]);
    expect(value).toBe(10000);
  });
});

describe("event tracking", () => {
  it("normalizes challenge join/complete aliases", () => {
    expect(normalizeEventType("challenge_join")).toBe("challenge_joined");
    expect(normalizeEventType("challenge_started")).toBe("challenge_joined");
    expect(normalizeEventType("challenge_complete")).toBe("challenge_completed");
  });
});
