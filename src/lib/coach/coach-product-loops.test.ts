import { describe, expect, it } from "vitest";
import { resolveTabKey } from "@/lib/ui/app-nav";
import {
  morningNarrationFromLiving,
  shouldShowProposalFollowUp,
  type CoachProposalFollowUp,
} from "@/lib/coach/proposal-followup";
import {
  normalizeCoachSearchSeed,
  postWorkoutCoachSeed,
  volumeRecoveryNudgeSeed,
  weeklyReviewCoachSeed,
} from "@/lib/coach/seed";

describe("resolveTabKey coach", () => {
  it("maps /coach to Hoje tab", () => {
    expect(resolveTabKey("/coach")).toBe("/");
    expect(resolveTabKey("/")).toBe("/");
    expect(resolveTabKey("/treino")).toBe("/treino");
  });
});

describe("coach seed helpers", () => {
  it("normalizes search seed", () => {
    expect(normalizeCoachSearchSeed("  ola  ")).toBe("ola");
    expect(normalizeCoachSearchSeed("")).toBeNull();
    expect(normalizeCoachSearchSeed(12)).toBeNull();
  });

  it("builds volume / post-workout / weekly seeds", () => {
    expect(volumeRecoveryNudgeSeed(18)).toMatch(/18%/);
    expect(postWorkoutCoachSeed({ title: "Push", rpe: "dificil" })).toMatch(/Push/);
    expect(weeklyReviewCoachSeed({ coachLine: "Sono", wins: ["PR"], risks: ["RPE"] })).toMatch(
      /revisão semanal/i,
    );
  });
});

describe("proposal follow-up", () => {
  it("shows only on D+1 until answered", () => {
    const followUp: CoachProposalFollowUp = {
      proposalType: "EXPRESS_WORKOUT",
      label: "Aceitar treino express",
      acceptedAt: "2026-09-28T12:00:00.000Z",
      acceptedDate: "2026-09-28",
      answeredAt: null,
    };
    expect(shouldShowProposalFollowUp(followUp, new Date("2026-09-28T18:00:00"))).toBe(false);
    expect(shouldShowProposalFollowUp(followUp, new Date("2026-09-29T10:00:00"))).toBe(true);
    expect(
      shouldShowProposalFollowUp(
        { ...followUp, answeredAt: "2026-09-29T11:00:00.000Z" },
        new Date("2026-09-29T12:00:00"),
      ),
    ).toBe(false);
  });

  it("narrates morning check-in from living mode", () => {
    expect(morningNarrationFromLiving({ mode: "express", estimatedMin: 25 })).toMatch(/express/i);
    expect(morningNarrationFromLiving({ mode: "rest" })).toMatch(/descanso/i);
  });
});
