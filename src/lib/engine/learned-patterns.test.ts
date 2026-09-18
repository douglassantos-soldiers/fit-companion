/**
 * FASE 5 Learned patterns + guardrails tests.
 */
import { describe, expect, it } from "vitest";
import {
  buildPatternsBlobV2,
  extractLearnedPatterns,
  parsePatternsBlob,
  PATTERN_MIN_OBS,
  type LearnedPattern,
} from "@/lib/engine/learned-patterns";
import {
  evidenceLooksClinical,
  isAllowedPatternKind,
  learningBiasAllowed,
} from "@/lib/engine/learning-guardrails";
import { emptyState, todayKey, type AppState, type Profile, type SessionLog } from "@/lib/types";

const baseProfile: Profile = {
  name: "Soldado",
  goal: "massa",
  level: "intermediario",
  daysPerWeek: 4,
  age: 28,
  heightCm: 178,
  weightKg: 80,
  equipment: "academia",
  restrictions: [],
  createdAt: new Date().toISOString(),
};

function shortSessions(n: number): SessionLog[] {
  const date = todayKey();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() - i);
    // Spread across weekdays so weakest day exists
    return {
      id: `s${i}`,
      dayId: "a",
      title: "Express",
      date: d.toISOString().slice(0, 10),
      durationMin: 30,
      exercises: [],
      volumeKg: 800,
      rpe: "ok" as const,
    };
  });
}

describe("Learned patterns", () => {
  it("does not promote prefers_short with a single sample", () => {
    const state: AppState = {
      ...emptyState,
      profile: baseProfile,
      sessions: shortSessions(1),
    };
    const patterns = extractLearnedPatterns(state);
    const short = patterns.find((p) => p.kind === "prefers_short_sessions");
    expect(short == null || short.status === "candidate").toBe(true);
    if (short) {
      expect(short.evidenceCount).toBeLessThan(PATTERN_MIN_OBS.prefers_short_sessions);
    }
  });

  it("activates prefers_short_sessions after enough short sessions", () => {
    const state: AppState = {
      ...emptyState,
      profile: baseProfile,
      sessions: shortSessions(8),
    };
    const patterns = extractLearnedPatterns(state);
    const short = patterns.find((p) => p.kind === "prefers_short_sessions");
    expect(short).toBeTruthy();
    expect(short!.evidenceCount).toBeGreaterThanOrEqual(PATTERN_MIN_OBS.prefers_short_sessions);
    expect(short!.status).toBe("active");
  });

  it("migrates legacy flat UserPatterns blob on read", () => {
    const legacy = {
      weekdaySessionCounts: { 1: 3, 4: 0 },
      weakestWeekday: 4,
      mealGapWeekend: true,
      longWorkoutAvoidance: false,
      updatedAt: new Date().toISOString(),
    };
    const blob = parsePatternsBlob(legacy);
    expect(blob?.version).toBe(2);
    expect(blob?.legacy.weakestWeekday).toBe(4);
    expect(blob?.patterns).toEqual([]);
  });

  it("buildPatternsBlobV2 includes version 2 + legacy + patterns", () => {
    const state: AppState = {
      ...emptyState,
      profile: baseProfile,
      sessions: shortSessions(8),
    };
    const blob = buildPatternsBlobV2(state);
    expect(blob.version).toBe(2);
    expect(blob.legacy.updatedAt).toBeTruthy();
    expect(blob.patterns.some((p) => p.kind === "prefers_short_sessions")).toBe(true);
  });

  it("blocks clinical evidence notes", () => {
    expect(evidenceLooksClinical("dor aguda no joelho")).toBe(true);
    expect(evidenceLooksClinical("treino curto na quinta")).toBe(false);
    expect(isAllowedPatternKind("prefers_short_sessions")).toBe(true);
    expect(isAllowedPatternKind("ignore_pain")).toBe(false);
  });

  it("learningBiasAllowed blocks volume↑ when recovery low", () => {
    expect(
      learningBiasAllowed({
        recoveryLevel: "low",
        blockStims: false,
        preferLightTraining: false,
        suggestedVolumeIncrease: true,
      }),
    ).toBe(false);
    expect(
      learningBiasAllowed({
        recoveryLevel: "recovered",
        blockStims: false,
        preferLightTraining: false,
        suggestedVolumeIncrease: true,
      }),
    ).toBe(true);
  });

  it("weekday_skip stays candidate until min observations", () => {
    const prior: LearnedPattern[] = [
      {
        kind: "weekday_skip",
        status: "candidate",
        confidence: 0.4,
        evidenceCount: 2,
        minObservations: PATTERN_MIN_OBS.weekday_skip,
        lastObservedAt: todayKey(),
        evidence: [
          { date: todayKey(), note: "pouco na quinta" },
          { date: todayKey(), note: "pouco na quinta" },
        ],
        successfulOutcomes: 0,
        failedOutcomes: 0,
      },
    ];
    // Not enough sessions to promote
    const state: AppState = {
      ...emptyState,
      profile: baseProfile,
      sessions: shortSessions(3),
    };
    const next = extractLearnedPatterns(state, prior);
    const skip = next.find((p) => p.kind === "weekday_skip");
    if (skip) {
      expect(skip.status).not.toBe("active");
    }
  });
});
