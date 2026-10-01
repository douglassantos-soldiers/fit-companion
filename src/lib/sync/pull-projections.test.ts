import { describe, expect, it } from "vitest";
import {
  APP_STATE_PULL_COLS,
  MEAL_ENTRY_PULL_COLS,
  PROFILE_PULL_COLS,
  SESSION_PULL_COLS,
  pullHistorySinceIso,
} from "@/lib/sync/pull-projections";

describe("pull-projections", () => {
  it("history window is YYYY-MM-DD about 90 days ago", () => {
    const since = pullHistorySinceIso(90);
    expect(since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const days = (Date.now() - new Date(`${since}T00:00:00Z`).getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(85);
    expect(days).toBeLessThan(95);
  });

  it("projections list explicit columns (no star)", () => {
    for (const cols of [PROFILE_PULL_COLS, SESSION_PULL_COLS, MEAL_ENTRY_PULL_COLS, APP_STATE_PULL_COLS]) {
      expect(cols.includes("*")).toBe(false);
      expect(cols.split(",").length).toBeGreaterThan(3);
    }
  });
});
