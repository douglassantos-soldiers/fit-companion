import { describe, expect, it } from "vitest";
import { challengeById } from "@/data/challenges";
import { suggestProfileChallenges } from "@/lib/engine/profile-challenges";
import { challengeRawValue, sessionPullVolumeKg } from "@/lib/social";
import type { SessionLog } from "@/lib/types";

describe("suggestProfileChallenges", () => {
  it("shows 8 treinos for iniciante or <8 sessions", () => {
    expect(
      suggestProfileChallenges({ level: "iniciante", sessionCount: 40, hasClub: false, followingCount: 0 }).map(
        (c) => c.id,
      ),
    ).toContain("gen-iniciante-8");
    expect(
      suggestProfileChallenges({ level: "intermediario", sessionCount: 3, hasClub: false, followingCount: 0 }).map(
        (c) => c.id,
      ),
    ).toContain("gen-iniciante-8");
  });

  it("shows +5% puxada for avancado or ≥20 sessions", () => {
    expect(
      suggestProfileChallenges({ level: "avancado", sessionCount: 5, hasClub: false, followingCount: 0 }).map(
        (c) => c.id,
      ),
    ).toContain("gen-puxada-5");
    expect(
      suggestProfileChallenges({ level: "intermediario", sessionCount: 20, hasClub: false, followingCount: 0 }).map(
        (c) => c.id,
      ),
    ).toContain("gen-puxada-5");
  });

  it("shows convide 3 when club or following exists", () => {
    expect(
      suggestProfileChallenges({ level: "intermediario", sessionCount: 10, hasClub: true, followingCount: 0 }).map(
        (c) => c.id,
      ),
    ).toContain("gen-convide-3");
    expect(
      suggestProfileChallenges({ level: "intermediario", sessionCount: 10, hasClub: false, followingCount: 2 }).map(
        (c) => c.id,
      ),
    ).toContain("gen-convide-3");
    expect(
      suggestProfileChallenges({ level: "intermediario", sessionCount: 10, hasClub: false, followingCount: 0 }).map(
        (c) => c.id,
      ),
    ).not.toContain("gen-convide-3");
  });

  it("counts pull volume and invites metrics", () => {
    const pull = challengeById("gen-puxada-5")!;
    const invite = challengeById("gen-convide-3")!;
    const session: SessionLog = {
      id: "s1",
      dayId: "d1",
      title: "Puxada",
      date: new Date().toISOString(),
      durationMin: 40,
      volumeKg: 800,
      exercises: [
        {
          exerciseId: "barra-fixa",
          sets: [
            { reps: 10, weightKg: 20, done: true },
            { reps: 8, weightKg: 20, done: true },
          ],
        },
      ],
    };
    expect(sessionPullVolumeKg(session)).toBe(10 * 20 + 8 * 20);
    expect(challengeRawValue(pull, [session])).toBe(360);
    expect(challengeRawValue(invite, [], undefined, { invitesSent: 2 })).toBe(2);
  });
});
