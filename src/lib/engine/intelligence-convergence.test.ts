/**
 * Intelligence Convergence — same snapshot, same decision.
 */
import { describe, expect, it } from "vitest";
import {
  assembleDecisionContext,
  decisionContextForUi,
} from "@/lib/engine/assemble-decision-context";
import { buildLivingPlanWithDecisions } from "@/lib/engine/living-plan";
import {
  nextSnapshotVersion,
  resolveDecisionContextForUi,
  selectPrimaryAction,
  selectTrainingMode,
  shouldRefreshDecisionContextForToday,
  todaySessionShouldBeExpress,
  type DecisionContextSnapshot,
} from "@/lib/engine/decision-context-snapshot";
import { buildTypedCoachContextFromState } from "@/lib/coach/context.server";
import { buildQaScenario } from "@/lib/qa/scenarios";
import { getUserTodayKey } from "@/lib/timezone";
import { emptyState, type AppState } from "@/lib/types";

const FIXED = "2026-03-11";

function assemble(state: AppState, over: Parameters<typeof assembleDecisionContext>[1] = {}) {
  return assembleDecisionContext(state, { date: FIXED, source: "offline_legacy", ...over });
}

describe("Intelligence Convergence", () => {
  it("mesmo usuário + mesmo contexto → mesma decisão e fingerprint", () => {
    const state = buildQaScenario("healthy_full", { date: FIXED });
    const a = assemble(state);
    const b = assemble(state);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.inputFingerprint).toBe(b!.inputFingerprint);
    expect(selectTrainingMode(a!)).toBe(selectTrainingMode(b!));
    expect(a!.decisions.trainingVolume).toBe(b!.decisions.trainingVolume);
    expect(selectPrimaryAction(a!)).toBe(selectPrimaryAction(b!));
  });

  it("buildLivingPlanWithDecisions é compatibility do assembler", () => {
    const state = buildQaScenario("healthy_full", { date: FIXED });
    const snap = assemble(state)!;
    const built = buildLivingPlanWithDecisions(state, FIXED)!;
    expect(built.plan.workout.mode).toBe(snap.livingPlan.workout.mode);
    expect(built.decisions.trainingVolume).toBe(snap.decisions.trainingVolume);
    expect(built.decisions.calorieDelta).toBe(snap.decisions.calorieDelta);
  });

  it("mudança de sleep altera o fingerprint e pode mudar o modo", () => {
    const healthy = buildQaScenario("healthy_full", { date: FIXED });
    const low = buildQaScenario("low_sleep", { date: FIXED });
    const a = assemble(healthy)!;
    const b = assemble(low)!;
    expect(a.inputFingerprint).not.toBe(b.inputFingerprint);
    expect(b.context.sleep.hours).toBe(5);
  });

  it("mudança de energy altera o fingerprint", () => {
    const base = buildQaScenario("healthy_full", { date: FIXED });
    const tired: AppState = {
      ...base,
      dayCheckIns: {
        [FIXED]: { ...base.dayCheckIns[FIXED]!, energy: "baixa" },
      },
    };
    expect(assemble(base)!.inputFingerprint).not.toBe(assemble(tired)!.inputFingerprint);
  });

  it("availableMin curto muda a decisão de duração / modo", () => {
    const healthy = assemble(buildQaScenario("healthy_full", { date: FIXED }))!;
    const short = assemble(buildQaScenario("short_time", { date: FIXED }))!;
    expect(healthy.inputFingerprint).not.toBe(short.inputFingerprint);
    expect(short.context.availableTimeMin).toBe(30);
    expect(short.decisions.sessionDuration).toBeLessThanOrEqual(healthy.decisions.sessionDuration);
  });

  it("equipment limitado entra no fingerprint", () => {
    const gym = assemble(buildQaScenario("healthy_full", { date: FIXED }))!;
    const home = assemble(buildQaScenario("no_equipment", { date: FIXED }))!;
    expect(gym.inputFingerprint).not.toBe(home.inputFingerprint);
    expect(home.context.equipment.limitedToday).toBe(true);
  });

  it("recovery ruim entra no contexto de decisão", () => {
    const good = assemble(buildQaScenario("good_recovery", { date: FIXED }))!;
    const rest = assemble(buildQaScenario("rest_day", { date: FIXED }))!;
    expect(good.inputFingerprint).not.toBe(rest.inputFingerprint);
    expect(["rest", "deload", "express"]).toContain(selectTrainingMode(rest));
  });

  it("nutrition incompleta vs forte muda o fingerprint de decisão", () => {
    const low = assemble(buildQaScenario("low_nutrition", { date: FIXED }))!;
    const strong = assemble(buildQaScenario("strong_nutrition", { date: FIXED }))!;
    expect(low.inputFingerprint).not.toBe(strong.inputFingerprint);
  });

  it("behavior trigger altera o fingerprint", () => {
    const healthy = assemble(buildQaScenario("healthy_full", { date: FIXED }))!;
    const weekend = assemble(buildQaScenario("weekend_pattern", { date: FIXED }))!;
    expect(healthy.inputFingerprint).not.toBe(weekend.inputFingerprint);
  });

  it("timezone muda a chave de data na virada do dia", () => {
    const instant = new Date("2026-03-12T02:00:00.000Z");
    const br = getUserTodayKey("America/Sao_Paulo", instant);
    const utc = getUserTodayKey("UTC", instant);
    expect(br).toBe("2026-03-11");
    expect(utc).toBe("2026-03-12");
    const state = buildQaScenario("healthy_full", { date: br });
    const snapBr = assembleDecisionContext(state, { date: br, timezone: "America/Sao_Paulo" })!;
    const snapUtc = assembleDecisionContext(state, { date: utc, timezone: "UTC" })!;
    expect(snapBr.date).not.toBe(snapUtc.date);
  });

  it("Customer360 stale/version entra no fingerprint e bumpa snapshot_version", () => {
    const state = buildQaScenario("healthy_full", { date: FIXED });
    const v1 = assemble(state, { customer360Version: 1, stale360: true })!;
    const v2 = assemble(state, { customer360Version: 99, stale360: false })!;
    expect(v1.stale360).toBe(true);
    expect(v2.customer360Version).toBe(99);
    expect(v1.inputFingerprint).not.toBe(v2.inputFingerprint);
    expect(
      nextSnapshotVersion(
        { inputFingerprint: v1.inputFingerprint, snapshotVersion: 1 },
        v1.inputFingerprint,
      ),
    ).toBe(1);
    expect(
      nextSnapshotVersion(
        { inputFingerprint: v1.inputFingerprint, snapshotVersion: 1 },
        v2.inputFingerprint,
      ),
    ).toBe(2);
  });

  it("fingerprint igual não incrementa snapshot_version", () => {
    expect(nextSnapshotVersion({ inputFingerprint: "abc", snapshotVersion: 4 }, "abc")).toBe(4);
    expect(nextSnapshotVersion(null, "abc")).toBe(1);
  });
});

describe("Today === Coach === server quando o snapshot é o mesmo", () => {
  it("seletores Today / Coach / Training leem o mesmo trainingMode e primaryAction", () => {
    const state = buildQaScenario("low_sleep", { date: FIXED });
    const server = assembleDecisionContext(state, {
      date: FIXED,
      source: "server",
      snapshotVersion: 3,
      userId: "qa-user",
    })!;
    const cached: AppState = {
      ...state,
      decisionContextByDate: { [FIXED]: server },
    };

    const todaySnap = decisionContextForUi(cached, FIXED)!;
    const coach = buildTypedCoachContextFromState(cached, {
      date: FIXED,
      decisionSnapshot: server,
    });
    const trainingExpress = todaySessionShouldBeExpress({
      snapshot: todaySnap,
      isTodaySession: true,
    });

    expect(selectTrainingMode(todaySnap)).toBe(server.decisions.trainingMode);
    expect(coach.training.todayMode).toBe(server.decisions.trainingMode);
    expect(todaySnap.decisions.calorieDelta).toBe(server.decisions.calorieDelta);
    expect(selectPrimaryAction(todaySnap)).toBe(server.decisions.primaryAction);
    expect(trainingExpress).toBe(selectTrainingMode(server) === "express");
    expect(todaySnap.source).toBe("server");
  });

  it("não pede refresh em loop depois do primeiro hydrate offline", () => {
    expect(
      shouldRefreshDecisionContextForToday({
        snapshot: { source: "server" } as DecisionContextSnapshot,
        hasLivingPlan: true,
        alreadyRequested: false,
      }),
    ).toBe(false);
    expect(
      shouldRefreshDecisionContextForToday({
        snapshot: { source: "offline_legacy" } as DecisionContextSnapshot,
        hasLivingPlan: true,
        alreadyRequested: true,
      }),
    ).toBe(false);
    expect(
      shouldRefreshDecisionContextForToday({
        snapshot: null,
        hasLivingPlan: false,
        alreadyRequested: false,
      }),
    ).toBe(true);
  });

  it("cache server não é substituído por assembler local", () => {
    const healthy = assembleDecisionContext(buildQaScenario("healthy_full", { date: FIXED }), {
      date: FIXED,
      source: "server",
      snapshotVersion: 2,
    })!;
    const lowState = buildQaScenario("low_sleep", { date: FIXED });
    const cached: AppState = {
      ...lowState,
      decisionContextByDate: { [FIXED]: healthy },
    };
    const resolved = resolveDecisionContextForUi(cached, FIXED, (s, d) =>
      assembleDecisionContext(s, { date: d, source: "offline_legacy" }),
    );
    expect(resolved?.source).toBe("server");
    expect(selectTrainingMode(resolved!)).toBe(selectTrainingMode(healthy));
  });
});

describe("empty profile", () => {
  it("assemble retorna null sem perfil", () => {
    expect(assembleDecisionContext({ ...emptyState, profile: null }, { date: FIXED })).toBeNull();
  });
});
