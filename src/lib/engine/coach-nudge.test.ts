import { describe, expect, it } from "vitest";
import { evaluateCoachNudge, recoveryWorsened } from "@/lib/engine/coach-nudge";

describe("evaluateCoachNudge", () => {
  it("fires when volume is up ≥15% and recovery worsened", () => {
    const r = evaluateCoachNudge({
      volumeDeltaPct: 15,
      recoveryNow: "red",
      recoveryPrev: "green",
      now: new Date("2026-09-19T12:00:00.000Z"),
    });
    expect(r.show).toBe(true);
    expect(recoveryWorsened("yellow", "green")).toBe(true);
  });

  it("does not fire below 15% volume or if recovery did not worsen", () => {
    expect(
      evaluateCoachNudge({
        volumeDeltaPct: 14,
        recoveryNow: "red",
        recoveryPrev: "green",
      }).show,
    ).toBe(false);
    expect(
      evaluateCoachNudge({
        volumeDeltaPct: 20,
        recoveryNow: "green",
        recoveryPrev: "yellow",
      }).show,
    ).toBe(false);
  });

  it("caps at one overlay per day", () => {
    const now = new Date("2026-09-19T18:00:00.000Z");
    expect(
      evaluateCoachNudge({
        volumeDeltaPct: 20,
        recoveryNow: "red",
        recoveryPrev: "green",
        shownAt: "2026-09-19T08:00:00.000Z",
        now,
      }).show,
    ).toBe(false);
    expect(
      evaluateCoachNudge({
        volumeDeltaPct: 20,
        recoveryNow: "red",
        recoveryPrev: "green",
        dismissedAt: "2026-09-19T08:00:00.000Z",
        now,
      }).show,
    ).toBe(false);
    expect(
      evaluateCoachNudge({
        volumeDeltaPct: 20,
        recoveryNow: "red",
        recoveryPrev: "green",
        dismissedAt: "2026-09-18T08:00:00.000Z",
        now,
      }).show,
    ).toBe(true);
  });
});
