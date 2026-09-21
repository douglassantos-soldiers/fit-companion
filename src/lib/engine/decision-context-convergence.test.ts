/**
 * Convergence contract: Today, Coach and server share one DecisionContextSnapshot.
 */
import { describe, expect, it } from "vitest";
import {
  assembleDecisionContext,
  decisionContextForUi,
} from "@/lib/engine/assemble-decision-context";
import { selectTrainingMode } from "@/lib/engine/decision-context-snapshot";
import { buildTypedCoachContextFromState } from "@/lib/coach/context.server";
import { buildQaScenario } from "@/lib/qa/scenarios";

const FIXED = "2026-03-11";

describe("decision-context-convergence", () => {
  it("Today decision === Coach decision === server decision no mesmo snapshot", { timeout: 15_000 }, () => {
    const state = buildQaScenario("short_time", { date: FIXED });
    const server = assembleDecisionContext(state, {
      date: FIXED,
      source: "server",
      userId: "qa-user",
      snapshotVersion: 1,
    })!;
    const uiState = {
      ...state,
      decisionContextByDate: { [FIXED]: server },
    };
    const today = decisionContextForUi(uiState, FIXED)!;
    const coach = buildTypedCoachContextFromState(uiState, {
      date: FIXED,
      decisionSnapshot: server,
    });

    expect(selectTrainingMode(today)).toBe(selectTrainingMode(server));
    expect(coach.training.todayMode).toBe(selectTrainingMode(server));
    expect(today.decisions.sessionDuration).toBe(server.decisions.sessionDuration);
    expect(coach.todayDecisions[0]?.source).toBe("server_snapshot");
  });
});
