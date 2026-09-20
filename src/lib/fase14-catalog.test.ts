import { describe, expect, it } from "vitest";
import { isAccountBlocked, normalizeAccountStatus } from "@/lib/account-status";
import {
  activeChallenges,
  mergeChallenges,
  mergeExercises,
  toPlannerExercises,
} from "@/lib/training/resolve-catalog";
import { mergeTrainingRules, DEFAULT_LEVEL_FACTOR } from "@/lib/training/training-rules";
import { pickEditorialItem, type PublicContentItem } from "@/lib/content-match";
import { aggregateOpsFromEvents } from "@/lib/analytics.server";
import { EXERCISE_LIBRARY } from "@/data/exercise-library";
import { CHALLENGES_SEED } from "@/data/challenges";

const seedEx = EXERCISE_LIBRARY.slice(0, 3);

describe("account status", () => {
  it("bans always block", () => {
    expect(isAccountBlocked({ status: "banned", statusUntil: null })).toBe(true);
    expect(normalizeAccountStatus("banned")).toBe("banned");
  });

  it("open-ended suspend blocks", () => {
    expect(isAccountBlocked({ status: "suspended", statusUntil: null })).toBe(true);
  });

  it("expired suspend does not block", () => {
    const now = Date.parse("2026-09-19T12:00:00.000Z");
    expect(
      isAccountBlocked({ status: "suspended", statusUntil: "2026-09-18T12:00:00.000Z" }, now),
    ).toBe(false);
  });

  it("future suspend blocks", () => {
    const now = Date.parse("2026-09-19T12:00:00.000Z");
    expect(
      isAccountBlocked({ status: "suspended", statusUntil: "2026-09-20T12:00:00.000Z" }, now),
    ).toBe(true);
  });

  it("active never blocks", () => {
    expect(isAccountBlocked({ status: "active", statusUntil: null })).toBe(false);
  });
});

describe("exercise catalog merge", () => {
  it("keeps seed when overlay is empty", () => {
    const merged = mergeExercises(seedEx, []);
    expect(merged).toHaveLength(seedEx.length);
    expect(toPlannerExercises(merged).map((e) => e.id)).toEqual(
      seedEx.filter((e) => e.active && e.plannerEligible).map((e) => e.id),
    );
  });

  it("DB overlay wins name and deactivates", () => {
    const first = seedEx[0]!;
    const merged = mergeExercises(seedEx, [
      { id: first.id, name: "Supino CMS", active: false },
    ]);
    const hit = merged.find((e) => e.id === first.id);
    expect(hit?.name).toBe("Supino CMS");
    expect(hit?.active).toBe(false);
    expect(toPlannerExercises(merged).some((e) => e.id === first.id)).toBe(false);
  });

  it("explicit alternatives override swap group", () => {
    const first = seedEx[0]!;
    const second = seedEx[1]!;
    const merged = mergeExercises(seedEx, [
      { id: first.id, alternativeIds: [second.id] },
    ]);
    expect(merged.find((e) => e.id === first.id)?.alternativeIds).toEqual([second.id]);
  });

  it("can add a DB-only exercise", () => {
    const merged = mergeExercises(seedEx, [
      {
        id: "novo-cms",
        name: "Face pull CMS",
        group: "ombros",
        equipment: "academia",
        swapGroup: "ombro-raise",
        active: true,
        plannerEligible: true,
      },
    ]);
    expect(merged.some((e) => e.id === "novo-cms")).toBe(true);
    expect(toPlannerExercises(merged).some((e) => e.id === "novo-cms")).toBe(true);
  });
});

describe("challenge catalog merge", () => {
  it("uses live participant counts", () => {
    const merged = mergeChallenges(CHALLENGES_SEED.slice(0, 1), [], { "consistencia-21": 12 });
    expect(merged[0]?.participants).toBe(12);
  });

  it("inactive overlay drops from athlete list", () => {
    const id = CHALLENGES_SEED[0]!.id;
    const merged = mergeChallenges(CHALLENGES_SEED.slice(0, 2), [{ id, active: false }]);
    expect(activeChallenges(merged).some((c) => c.id === id)).toBe(false);
  });

  it("adds reward on overlay", () => {
    const id = CHALLENGES_SEED[0]!.id;
    const merged = mergeChallenges(CHALLENGES_SEED.slice(0, 1), [{ id, reward: "badge-consistencia" }]);
    expect(merged[0]?.reward).toBe("badge-consistencia");
  });
});

describe("training rules fallback", () => {
  it("empty payload keeps defaults", () => {
    const r = mergeTrainingRules({});
    expect(r.levelFactor.iniciante).toBe(DEFAULT_LEVEL_FACTOR.iniciante);
    expect(r.splits[3]?.length).toBe(3);
  });

  it("partial payload overrides one factor", () => {
    const r = mergeTrainingRules({ levelFactor: { iniciante: 0.5 } });
    expect(r.levelFactor.iniciante).toBe(0.5);
    expect(r.levelFactor.avancado).toBe(DEFAULT_LEVEL_FACTOR.avancado);
  });
});

describe("editorial targeting", () => {
  const items: PublicContentItem[] = [
    {
      id: "1",
      kind: "tip",
      title: "Massa",
      body: "Coma mais.",
      goals: ["massa"],
      levels: [],
      published: true,
      sortOrder: 0,
    },
    {
      id: "2",
      kind: "tip",
      title: "Todos",
      body: "Durma.",
      goals: [],
      levels: [],
      published: true,
      sortOrder: 1,
    },
    {
      id: "3",
      kind: "article",
      title: "Rascunho",
      body: "Nope",
      goals: [],
      levels: [],
      published: false,
      sortOrder: 0,
    },
  ];

  it("matches goal and ignores drafts", () => {
    const hit = pickEditorialItem(items, { goal: "massa", date: new Date("2026-09-19") });
    expect(hit?.id).toBe("1");
  });

  it("falls back to untargeted when goal misses", () => {
    const hit = pickEditorialItem(items, { goal: "saude", date: new Date("2026-09-19") });
    expect(hit?.id).toBe("2");
  });
});

describe("ops dashboard aggregation", () => {
  it("counts actives from app_opened with workout fallback", () => {
    const now = Date.parse("2026-09-19T12:00:00.000Z");
    const fromOpened = aggregateOpsFromEvents(
      [
        { user_id: "a", event_type: "app_opened", occurred_at: "2026-09-18T10:00:00.000Z" },
        { user_id: "b", event_type: "workout_completed", occurred_at: "2026-09-18T10:00:00.000Z" },
      ],
      now,
    );
    expect(fromOpened.active7d).toBe(1);
    expect(fromOpened.workouts7d).toBe(1);

    const fromWorkouts = aggregateOpsFromEvents(
      [{ user_id: "b", event_type: "workout_completed", occurred_at: "2026-09-18T10:00:00.000Z" }],
      now,
    );
    expect(fromWorkouts.active7d).toBe(1);
  });

  it("does not include PII fields in trend rows", () => {
    const now = Date.parse("2026-09-19T12:00:00.000Z");
    const { trend } = aggregateOpsFromEvents([], now);
    expect(trend).toHaveLength(7);
    expect(Object.keys(trend[0] ?? {}).sort()).toEqual(["actives", "date", "workouts"]);
  });
});
