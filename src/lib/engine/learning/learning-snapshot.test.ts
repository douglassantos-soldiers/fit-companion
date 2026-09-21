/**
 * Learning Intelligence — snapshot + response + experiment contracts.
 */
import { describe, expect, it } from "vitest";
import { extractLearnedPatterns, PATTERN_MIN_OBS } from "@/lib/engine/learned-patterns";
import { computeLearningSnapshot } from "@/lib/engine/learning/snapshot";
import {
  applyInterventionOutcome,
  confidenceFromCounts,
  emptyInterventionResponse,
} from "@/lib/engine/learning/responses";
import type { InterventionResponse } from "@/lib/engine/learning/types";
import { detectLapses, selectInterventions } from "@/lib/engine/behavior";
import { buildBehaviorProfile } from "@/lib/engine/behavior/profile";
import {
  emptyState,
  todayKey,
  type AppState,
  type MealEntry,
  type Profile,
  type SessionLog,
} from "@/lib/types";

const date = todayKey();

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
  typicalSleepHours: 5,
};

function dateNDaysAgo(n: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - n);
  return todayKey(d);
}

function session(partial: Partial<SessionLog> & { date: string }): SessionLog {
  return {
    id: partial.id ?? `s-${partial.date}`,
    dayId: partial.dayId ?? partial.date,
    date: partial.date,
    title: partial.title ?? "Treino",
    durationMin: partial.durationMin ?? 40,
    rpe: partial.rpe ?? "ok",
    exercises: partial.exercises ?? [],
    volumeKg: partial.volumeKg ?? 1000,
    ...(partial.express ? { express: true } : {}),
  };
}

function meal(day: string, slot: MealEntry["slot"] = "almoco", protein = 30): MealEntry {
  return {
    id: `m-${day}-${slot}`,
    date: day,
    slot,
    label: "Refeição",
    proteinG: protein,
    kcal: 370,
    quality: "verde",
  };
}

function stateWith(extras: Partial<AppState> = {}): AppState {
  return { ...emptyState, profile: baseProfile, ...extras };
}

function skipFridaySessions(): SessionLog[] {
  const sessions: SessionLog[] = [];
  for (let i = 0; i < 28; i += 1) {
    const d = dateNDaysAgo(i);
    const wd = new Date(`${d}T12:00:00`).getDay();
    if (wd === 5) continue;
    if (wd >= 1 && wd <= 4) sessions.push(session({ date: d, durationMin: 45 }));
  }
  return sessions;
}

describe("LearningSnapshot", () => {
  it("pattern threshold — isolated short session stays candidate", () => {
    const patterns = extractLearnedPatterns(
      stateWith({ sessions: [session({ date: dateNDaysAgo(1), durationMin: 30 })] }),
    );
    const short = patterns.find((p) => p.kind === "prefers_short_sessions");
    expect(short == null || short.status === "candidate").toBe(true);
    if (short) {
      expect(short.evidenceCount).toBeLessThan(PATTERN_MIN_OBS.prefers_short_sessions);
    }
    const snap = computeLearningSnapshot(
      stateWith({ sessions: [session({ date: dateNDaysAgo(1), durationMin: 30 })] }),
      date,
    );
    const learned = snap.learnedPatterns.find((p) => p.kind === "prefers_short_sessions");
    expect(learned == null || learned.status !== "active").toBe(true);
  });

  it("support >= 2 — trigger is not active with a single evidence", () => {
    const snap = computeLearningSnapshot(
      stateWith({
        sessions: [session({ date: dateNDaysAgo(1), durationMin: 40 })],
        meals: [meal(dateNDaysAgo(1))],
      }),
      date,
    );
    expect(snap.behavior.triggers.every((t) => !t.active)).toBe(true);
  });

  it("confidence threshold — below 0.55 remains candidate", () => {
    const snap = computeLearningSnapshot(stateWith(), date);
    expect(snap.learnedPatterns.every((p) => p.status !== "active" || p.confidence >= 0.55)).toBe(
      true,
    );
    expect(confidenceFromCounts(0, 0, 0)).toBe(0.5);
    expect(confidenceFromCounts(0, 1, 0)).toBeLessThan(0.55);
  });

  it("intervention selection uses persisted response history", () => {
    const state = stateWith({ sessions: skipFridaySessions() });
    const reminderWins = computeLearningSnapshot(state, date, {
      interventionResponses: [
        {
          type: "reminder",
          successCount: 6,
          failureCount: 0,
          neutralCount: 0,
          confidence: 0.9,
          lastUsedAt: date,
        },
        {
          type: "express_workout",
          successCount: 0,
          failureCount: 5,
          neutralCount: 0,
          confidence: 0.15,
          lastUsedAt: date,
        },
      ],
    });
    const fri = reminderWins.behavior.triggers.find((t) => t.key === "LOW_FRIDAY_ADHERENCE");
    expect(fri?.active).toBe(true);
    expect(reminderWins.behavior.interventions[0]?.type).toBe("reminder");

    const expressWins = computeLearningSnapshot(state, date, {
      interventionResponses: [
        {
          type: "express_workout",
          successCount: 6,
          failureCount: 0,
          neutralCount: 0,
          confidence: 0.9,
          lastUsedAt: date,
        },
        {
          type: "reminder",
          successCount: 0,
          failureCount: 4,
          neutralCount: 0,
          confidence: 0.2,
          lastUsedAt: date,
        },
      ],
    });
    expect(expressWins.behavior.interventions[0]?.type).toBe("express_workout");
  });

  it("positive response increments successCount and confidence", () => {
    const start = emptyInterventionResponse("express_workout");
    const next = applyInterventionOutcome([start], "express_workout", "success", date);
    expect(next[0]!.successCount).toBe(1);
    expect(next[0]!.confidence).toBeGreaterThan(start.confidence);
  });

  it("negative response increments failureCount, lowers confidence, can change selection", () => {
    let list: InterventionResponse[] = [
      {
        type: "express_workout",
        successCount: 2,
        failureCount: 0,
        neutralCount: 0,
        confidence: 0.7,
        lastUsedAt: date,
      },
      {
        type: "reminder",
        successCount: 2,
        failureCount: 0,
        neutralCount: 0,
        confidence: 0.7,
        lastUsedAt: date,
      },
    ];
    list = applyInterventionOutcome(list, "express_workout", "fail", date);
    list = applyInterventionOutcome(list, "express_workout", "fail", date);
    list = applyInterventionOutcome(list, "express_workout", "fail", date);
    const express = list.find((r) => r.type === "express_workout")!;
    const reminder = list.find((r) => r.type === "reminder")!;
    expect(express.failureCount).toBe(3);
    expect(express.confidence).toBeLessThan(reminder.confidence);

    const state = stateWith({ sessions: skipFridaySessions() });
    const snap = computeLearningSnapshot(state, date, { interventionResponses: list });
    expect(snap.behavior.interventions[0]?.type).toBe("reminder");
  });

  it("experiment completion after 7 days of protein breakfast evidence", () => {
    const start = dateNDaysAgo(7);
    const meals: MealEntry[] = [];
    for (let i = 0; i <= 7; i += 1) {
      meals.push(meal(dateNDaysAgo(i), "cafe", 25));
    }
    const snap = computeLearningSnapshot(stateWith({ meals }), date, {
      experiments: [
        {
          id: "exp-protein-breakfast-old",
          target: "Proteína no café por 7 dias",
          start,
          end: date,
          baseline: 0.4,
          result: null,
          confidence: 0.5,
          status: "active",
        },
      ],
    });
    const done = snap.experiments.find((e) => e.id === "exp-protein-breakfast-old");
    expect(done?.status).toBe("completed");
    expect(done?.result).toBeGreaterThanOrEqual(0.4);
    const mealSwap = snap.interventionResponses.find((r) => r.type === "meal_swap");
    expect(mealSwap?.successCount).toBeGreaterThan(0);
  });

  it("relapse recovery suggests a minimal action, not all-or-nothing", () => {
    const sessions = [
      session({ date: dateNDaysAgo(5), durationMin: 40 }),
      session({ date: dateNDaysAgo(4), durationMin: 40 }),
      session({ date: dateNDaysAgo(3), durationMin: 40 }),
    ];
    const state = stateWith({ sessions });
    const lapses = detectLapses(state, buildBehaviorProfile(state), date);
    expect(lapses.length).toBeGreaterThan(0);
    expect(lapses[0]!.reason.toLowerCase()).toContain("mínima");
    expect(lapses[0]!.nextAction.length).toBeGreaterThan(5);
    const snap = computeLearningSnapshot(state, date);
    expect(snap.behavior.lapses.length).toBeGreaterThan(0);
  });
});

describe("selectInterventions ranking", () => {
  it("keeps catalog order when history is tied", () => {
    const state = stateWith({ sessions: skipFridaySessions() });
    const snap = computeLearningSnapshot(state, date);
    const profile = buildBehaviorProfile(state, {});
    const picked = selectInterventions(snap.behavior.triggers, profile, 1);
    expect(picked[0]?.type).toBe("express_workout");
  });
});
