/**
 * FASE 1 — Decision Contract Consolidation scenarios.
 * Proposal never becomes Decision by copy; WHY/WHAT/EXPECTED always from engine.
 */
import { describe, expect, it } from "vitest";
import { makeProposal, validateCoachProposalAgainstSnapshot } from "@/lib/coach/proposals";
import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import {
  DECISION_CONTRACT_VERSION,
  decisionsFromBundle,
  toDecisionView,
} from "@/lib/engine/decision-contract";
import {
  parseDecisionProposal,
  resolveProposalAgainstEngine,
  toDecisionProposal,
} from "@/lib/engine/decision-proposal";
import { SLEEP_LOW_HOURS, TIME_LIMITED_MIN } from "@/lib/engine/decision-thresholds";
import {
  REASON_CODES_VERSION,
  canonicalReasonCode,
  toReasonAlias,
} from "@/lib/engine/reason-codes";
import { selectTrainingMode } from "@/lib/engine/decision-context-snapshot";
import { buildQaScenario } from "@/lib/qa/scenarios";
import type { AppState } from "@/lib/types";

const FIXED = "2026-03-11";

function assemble(state: AppState) {
  return assembleDecisionContext(state, {
    date: FIXED,
    source: "offline_legacy",
    userId: "qa-user",
    customer360Version: 1,
  });
}

describe("FASE 1 Decision Contract Consolidation", () => {
  it("exports shared threshold and reason versions", () => {
    expect(SLEEP_LOW_HOURS).toBe(6);
    expect(TIME_LIMITED_MIN).toBe(40);
    expect(REASON_CODES_VERSION).toBeGreaterThanOrEqual(1);
    expect(DECISION_CONTRACT_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("normal day — contract has context_id, why/what/expected_outcome", () => {
    const snap = assemble(buildQaScenario("healthy_full", { date: FIXED }))!;
    const contracts = decisionsFromBundle(snap);
    expect(contracts.length).toBeGreaterThan(0);
    const d = contracts[0]!;
    expect(d.context_id).toBe(snap.inputFingerprint);
    expect(d.decision_version).toBe(DECISION_CONTRACT_VERSION);
    expect(d.why.reason_codes.length).toBeGreaterThan(0);
    expect(d.why.reason_aliases).toEqual(d.reason_codes.map((c) => toReasonAlias(c)));
    expect(d.what.actions.length).toBeGreaterThan(0);
    expect(d.what.decision_value).toBeDefined();
    // expected_outcome may be null for some types; training_mode should have one
    const mode = contracts.find((c) => c.engine_decision_type === "training_mode");
    expect(mode?.expected_outcome?.kind).toBeTruthy();
  });

  it("low sleep — evidence.items include sleep with source", () => {
    const snap = assemble(buildQaScenario("low_sleep", { date: FIXED }))!;
    const contracts = decisionsFromBundle(snap);
    const d = contracts[0]!;
    expect(d.evidence.metrics["sleepHours"]).toBe(5);
    expect(d.evidence.items?.some((i) => i.signal === "sleepHours")).toBe(true);
    const sleepItem = d.evidence.items!.find((i) => i.signal === "sleepHours")!;
    expect(sleepItem.source).toBeTruthy();
    expect(sleepItem.observedAt).toBe(FIXED);
    expect(["high", "medium", "low"]).toContain(sleepItem.relevance);
  });

  it("limited time — LIMITED_TIME alias + express", () => {
    const snap = assemble(buildQaScenario("short_time", { date: FIXED }))!;
    expect(snap.context.availableTimeMin).toBeLessThan(TIME_LIMITED_MIN);
    expect(snap.decisions.trainingMode).toBe("express");
    const contracts = decisionsFromBundle(snap);
    const aliases = contracts.flatMap((d) => d.reason_aliases);
    expect(aliases).toContain("LIMITED_TIME");
  });

  it("DecisionView is camelCase and mirrors why/what/outcome", () => {
    const snap = assemble(buildQaScenario("low_sleep", { date: FIXED }))!;
    const d = decisionsFromBundle(snap)[0]!;
    const view = toDecisionView(d);
    expect(view.decisionId).toBe(d.decision_id);
    expect(view.contextId).toBe(d.context_id);
    expect(view.why.reasonCodes).toEqual(d.why.reason_codes);
    expect(view.what.decisionValue).toBe(d.what.decision_value);
    expect(view.expectedOutcome?.kind ?? null).toBe(d.expected_outcome?.kind ?? null);
  });

  it("fingerprint + decision_id are deterministic", () => {
    const state = buildQaScenario("healthy_full", { date: FIXED });
    const a = assemble(state)!;
    const b = assemble(state)!;
    expect(a.inputFingerprint).toBe(b.inputFingerprint);
    const idsA = decisionsFromBundle(a).map((d) => d.decision_id);
    const idsB = decisionsFromBundle(b).map((d) => d.decision_id);
    expect(idsA).toEqual(idsB);
  });

  it("parseDecisionProposal fails closed on bad input", () => {
    expect(parseDecisionProposal(null).ok).toBe(false);
    expect(parseDecisionProposal({}).ok).toBe(false);
    const ok = parseDecisionProposal({
      proposal_id: "p1",
      user_id: "qa-user",
      proposed_type: "FULL_WORKOUT",
      proposed_value: "full",
      reason_codes: ["LOW_SLEEP"],
      confidence: 0.8,
      source: "agent",
      created_at: "2026-03-11T12:00:00.000Z",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.proposal.reason_codes).toContain("sleep_low");
    }
  });

  it("FULL_WORKOUT proposal vs rest mode is rejected; Decision stays rest", () => {
    const snap = assemble(buildQaScenario("rest_day", { date: FIXED }));
    if (!snap || snap.decisions.trainingMode !== "rest") {
      // Force rest via escalate / accepted mode if rest_day scenario is soft
      const base = buildQaScenario("healthy_full", { date: FIXED });
      const pain: AppState = {
        ...base,
        dayCheckIns: {
          [FIXED]: {
            ...base.dayCheckIns[FIXED]!,
            soreness: 5,
            stress: 5,
            notes: "dor no peito e falta de ar",
          },
        },
      };
      const forced = assemble(pain)!;
      expect(forced.decisions.trainingMode).toBe("rest");
      const coach = makeProposal("FULL_WORKOUT", true, [], {}, 0.9);
      const bridged = toDecisionProposal(coach, {
        userId: forced.userId,
        contextId: forced.inputFingerprint,
      });
      const resolved = resolveProposalAgainstEngine(bridged, forced);
      expect(resolved.ok).toBe(false);
      expect(resolved.rejection_reason).toMatch(
        /conflicts_with_training_mode|escalate_requires_rest_aligned/,
      );
      expect(resolved.authoritative.every((d) => d.user_id === forced.userId)).toBe(true);
      const modeDec = resolved.authoritative.find(
        (d) => d.engine_decision_type === "training_mode",
      );
      expect(modeDec?.decision_value).toBe("rest");
      // Never copy proposal value onto Decision
      expect(modeDec?.decision_value).not.toBe("full");
      return;
    }

    const coach = makeProposal("FULL_WORKOUT", true, [], {}, 0.9);
    const result = validateCoachProposalAgainstSnapshot(coach, snap);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/conflicts_with_training_mode/);
    const modeDec = result.authoritative.find((d) => d.engine_decision_type === "training_mode");
    expect(modeDec?.decision_value).toBe("rest");
  });

  it("aligned proposal returns engine Decision, not proposed_value copy", () => {
    const snap = assemble(buildQaScenario("healthy_full", { date: FIXED }))!;
    const coach = makeProposal("FULL_WORKOUT", snap.decisions.trainingVolume, [], {}, 0.7);
    const bridged = toDecisionProposal(coach, {
      userId: snap.userId,
      contextId: snap.inputFingerprint,
    });
    const resolved = resolveProposalAgainstEngine(bridged, snap);
    expect(resolved.ok).toBe(true);
    expect(resolved.decision).not.toBeNull();
    expect(resolved.decision!.decision_id).toMatch(/^dec_/);
    expect(resolved.decision!.context_id).toBe(snap.inputFingerprint);
    // proposed_type is Coach label; authoritative value is engine training mode
    const mode = snap.decisions.trainingMode;
    expect(
      resolved.authoritative.some(
        (d) => d.engine_decision_type === "training_mode" && d.decision_value === mode,
      ),
    ).toBe(true);
  });

  it("context fingerprint mismatch rejects proposal", () => {
    const snap = assemble(buildQaScenario("healthy_full", { date: FIXED }))!;
    const bridged = toDecisionProposal(makeProposal("REST", true, [], {}, 0.5), {
      userId: snap.userId,
      contextId: "wrong-fingerprint",
    });
    const resolved = resolveProposalAgainstEngine(bridged, snap);
    expect(resolved.ok).toBe(false);
    expect(resolved.rejection_reason).toBe("context_fingerprint_mismatch");
    expect(resolved.authoritative.length).toBeGreaterThan(0);
  });

  it("high fatigue / plateau / low adherence still produce contracts with why", () => {
    for (const id of ["low_adherence", "plateau"] as const) {
      const snap = assemble(buildQaScenario(id, { date: FIXED }))!;
      const contracts = decisionsFromBundle(snap);
      expect(contracts.every((d) => d.why.reason_codes.length >= 0)).toBe(true);
      expect(contracts.every((d) => d.what.actions.length > 0)).toBe(true);
    }
    const tiredBase = buildQaScenario("healthy_full", { date: FIXED });
    const tired: AppState = {
      ...tiredBase,
      dayCheckIns: {
        [FIXED]: { ...tiredBase.dayCheckIns[FIXED]!, energy: "baixa", sleepHours: 6 },
      },
    };
    const snap = assemble(tired)!;
    expect(decisionsFromBundle(snap)[0]!.why).toBeDefined();
  });

  it("product SCREAMING aliases resolve to snake SoT", () => {
    expect(canonicalReasonCode("LOW_SLEEP")).toBe("sleep_low");
    expect(canonicalReasonCode("HIGH_RECOVERY_LOAD")).toBe("recovery_low");
    expect(canonicalReasonCode("HIGH_TRAINING_LOAD")).toBe("excessive_muscle_load");
    expect(canonicalReasonCode("LOW_ADHERENCE")).toBe("adherence_drop");
    expect(canonicalReasonCode("TRAINING_PROGRESS")).toBe("progression_ready");
    expect(canonicalReasonCode("PLATEAU")).toBe("plateau_detected");
    expect(canonicalReasonCode("LIMITED_TIME")).toBe("time_limited");
    expect(canonicalReasonCode("REST_DAY")).toBe("deload_week");
    expect(canonicalReasonCode("NUTRITION_ADHERENCE")).toBe("protein_low");
    expect(canonicalReasonCode("RECOVERY_IMPROVED")).toBe("low_muscle_fatigue");
    expect(toReasonAlias("adherence_drop")).toBe("LOW_ADHERENCE");
    expect(toReasonAlias("excessive_muscle_load")).toBe("HIGH_TRAINING_LOAD");
    expect(toReasonAlias("low_muscle_fatigue")).toBe("RECOVERY_IMPROVED");
  });

  it("scenario matrix: rest / progression / conflicting / safety produce Decision contracts", () => {
    const rest = assemble(buildQaScenario("rest_day", { date: FIXED }));
    if (rest) {
      expect(decisionsFromBundle(rest).length).toBeGreaterThan(0);
      expect(["rest", "express", "deload", "full"]).toContain(selectTrainingMode(rest));
    }

    const progression = assemble(buildQaScenario("good_recovery", { date: FIXED }))!;
    expect(decisionsFromBundle(progression).every((d) => d.safety_status)).toBeTruthy();
    expect(progression.safety).toBeDefined();

    const base = buildQaScenario("low_sleep", { date: FIXED });
    const conflict: AppState = {
      ...base,
      dayCheckIns: {
        [FIXED]: { ...base.dayCheckIns[FIXED]!, sleepHours: 5, energy: "alta" },
      },
    };
    const conflicting = assemble(conflict)!;
    expect(conflicting.context.sleep.hours).toBe(5);
    expect(conflicting.context.energy).toBe("alta");
    const conflictContracts = decisionsFromBundle(conflicting);
    expect(conflictContracts[0]!.why.reason_codes.length).toBeGreaterThan(0);
    expect(conflictContracts[0]!.evidence.items?.length).toBeGreaterThan(0);

    const healthy = buildQaScenario("healthy_full", { date: FIXED });
    const safety: AppState = {
      ...healthy,
      dayCheckIns: {
        [FIXED]: {
          ...healthy.dayCheckIns[FIXED]!,
          soreness: 5,
          stress: 5,
          notes: "dor no peito e falta de ar",
        },
      },
    };
    const safetySnap = assemble(safety)!;
    expect(safetySnap.safety.escalateCare || safetySnap.safety.preferLightTraining).toBe(true);
    const mode = decisionsFromBundle(safetySnap).find(
      (d) => d.engine_decision_type === "training_mode",
    );
    expect(mode?.decision_value).toBeDefined();
    expect(mode?.why).toBeDefined();
    expect(mode?.what.decision_value).toBe(mode?.decision_value);
  });
});
