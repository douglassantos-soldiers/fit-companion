/**
 * Decision Outcome Attribution — rules, no fan-out, no ML.
 */
import { describe, expect, it } from "vitest";
import {
  attributeEvent,
  canUpdateExpectedAction,
  expectedActionForDecision,
  explainAttributionFromParts,
  mergeActionRow,
  outcomeDedupeKey,
  shouldLearnFromAttribution,
  type AttributionHit,
  type DecisionRef,
} from "@/lib/engine/attribution";

const DAY: DecisionRef[] = [
  {
    id: "d-mode",
    decisionType: "WORKOUT_MODE",
    decisionValue: "express",
    reasonCodes: ["time_limited", "sleep_low"],
  },
  { id: "d-vol", decisionType: "TRAINING_VOLUME", decisionValue: 0.7 },
  { id: "d-load", decisionType: "TRAINING_LOAD", decisionValue: 30 },
  { id: "d-nut", decisionType: "NUTRITION_TARGET", decisionValue: -150 },
  { id: "d-meal", decisionType: "MEAL_PRIORITY", decisionValue: "protein" },
  { id: "d-sleep", decisionType: "SLEEP_PRIORITY", decisionValue: true },
  { id: "d-rest", decisionType: "REST", decisionValue: "rest" },
  { id: "d-beh", decisionType: "BEHAVIOR_INTERVENTION", decisionValue: "express_workout" },
];

function ids(hits: AttributionHit[]): string[] {
  return hits.map((h) => h.decisionId).sort();
}

describe("expected actions", () => {
  it("express → start_express_workout; rest → take_rest_day", () => {
    expect(
      expectedActionForDecision({ decisionType: "WORKOUT_MODE", decisionValue: "express" }),
    ).toBe("start_express_workout");
    expect(expectedActionForDecision({ decisionType: "REST", decisionValue: "rest" })).toBe(
      "take_rest_day",
    );
    expect(
      expectedActionForDecision({ decisionType: "training_mode", decisionValue: "full" }),
    ).toBe("start_full_workout");
  });
});

describe("attribution rules — no fan-out", () => {
  it("session_completed atribui WORKOUT_MODE + TRAINING_VOLUME, não nutrição/sono", () => {
    const hits = attributeEvent({
      actionKind: "session_completed",
      window: "d0",
      decisions: DAY,
      extras: {
        workoutCompleted: true,
        rpe: "ok",
        express: true,
        sessionDurationMin: 30,
      },
    });
    expect(ids(hits)).toContain("d-mode");
    expect(ids(hits)).toContain("d-vol");
    expect(ids(hits)).not.toContain("d-nut");
    expect(ids(hits)).not.toContain("d-sleep");
    expect(hits.find((h) => h.decisionId === "d-mode")?.attributionType).toBe("direct");
    expect(hits.find((h) => h.decisionId === "d-mode")?.learningSignal).toBe(
      "express_training_high_adherence",
    );
  });

  it("meal_logged atribui MEAL_PRIORITY; não WORKOUT_MODE", () => {
    const hits = attributeEvent({
      actionKind: "meal_logged",
      window: "d0",
      decisions: DAY,
      extras: { mealSlot: "almoco" },
    });
    expect(ids(hits)).toEqual(["d-meal"]);
    expect(hits[0]?.attributionType).toBe("direct");
  });

  it("D+1 check-in sono → SLEEP_PRIORITY direct; REST indirect; volume só se reduzido", () => {
    const withVol = attributeEvent({
      actionKind: "checkin_next_day",
      window: "d1",
      decisions: DAY,
      extras: { volumeReduced: true, workoutCompleted: true },
    });
    expect(ids(withVol)).toContain("d-sleep");
    expect(ids(withVol)).toContain("d-rest");
    expect(ids(withVol)).toContain("d-vol");
    expect(ids(withVol)).not.toContain("d-nut");
    expect(withVol.find((h) => h.decisionId === "d-sleep")?.attributionType).toBe("direct");
    expect(withVol.find((h) => h.decisionId === "d-sleep")?.outcomeWindow).toBe("d1");
    expect(withVol.find((h) => h.decisionId === "d-rest")?.attributionType).toBe("indirect");

    const noVol = attributeEvent({
      actionKind: "checkin_next_day",
      window: "d1",
      decisions: DAY,
      extras: { volumeReduced: false },
    });
    expect(ids(noVol)).not.toContain("d-vol");
  });

  it("D+3 REST é weak e não passa no gate de learning", () => {
    const hits = attributeEvent({
      actionKind: "delayed_recovery",
      window: "d3",
      decisions: DAY,
    });
    expect(ids(hits)).toEqual(["d-rest"]);
    const rest = hits[0]!;
    expect(rest.attributionType).toBe("weak");
    expect(shouldLearnFromAttribution(rest)).toBe(false);
  });
});

describe("action expected lock + idempotency", () => {
  it("pending atualiza expected; completed não", () => {
    expect(canUpdateExpectedAction("pending")).toBe(true);
    expect(canUpdateExpectedAction("completed")).toBe(false);
    const pending = mergeActionRow(
      { expectedAction: "start_full_workout", status: "pending", actualAction: null },
      { expectedAction: "start_express_workout", status: "pending" },
    );
    expect(pending.expectedAction).toBe("start_express_workout");
    const done = mergeActionRow(
      {
        expectedAction: "start_express_workout",
        status: "completed",
        actualAction: "session_completed",
      },
      { expectedAction: "start_full_workout", status: "started" },
    );
    expect(done.expectedAction).toBe("start_express_workout");
    expect(done.status).toBe("completed");
  });

  it("segundo session_completed no mesmo decision+type+window não duplica (fake store)", () => {
    const hits = attributeEvent({
      actionKind: "session_completed",
      window: "d0",
      decisions: DAY,
      extras: { workoutCompleted: true, express: true, sessionDurationMin: 28 },
    });
    const store = new Set<string>();
    for (const h of hits) store.add(outcomeDedupeKey(h));
    const size = store.size;
    for (const h of hits) store.add(outcomeDedupeKey(h));
    expect(store.size).toBe(size);
    expect(size).toBeGreaterThan(0);
  });
});

describe("explainDecisionAttribution (critério de conclusão)", () => {
  it("responde why / expected / actual / outcome / when / related / learning", () => {
    const explained = explainAttributionFromParts({
      reasonCodes: ["time_limited", "sleep_low"],
      expectedAction: "start_express_workout",
      actualAction: "session_completed",
      actionStatus: "completed",
      outcomeType: "session_completed",
      observedAt: "2026-03-12T18:00:00.000Z",
      outcomeWindow: "d0",
      attributionType: "direct",
      attributionConfidence: 0.9,
      learningSignal: "express_training_high_adherence",
      outcomeQuality: "success",
    });
    expect(explained.why).toContain("time_limited");
    expect(explained.expectedAction).toBe("start_express_workout");
    expect(explained.actualAction).toBe("session_completed");
    expect(explained.actionStatus).toBe("completed");
    expect(explained.outcomeType).toBe("session_completed");
    expect(explained.observedAt).toBe("2026-03-12T18:00:00.000Z");
    expect(explained.relatedDirectly).toBe(true);
    expect(explained.learningSignal).toBe("express_training_high_adherence");
    expect(explained.fedLearning).toBe(true);
  });
});
