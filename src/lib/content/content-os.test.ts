import { describe, expect, it } from "vitest";
import { CONTENT_OS_ITEMS } from "@/data/content-os-seed";
import {
  pickEditorialItems as pickEditorialItemsByGoal,
  type PublicContentItem,
} from "@/lib/content-match";
import {
  pickEditorialItems,
  recommendContent,
  resolveProgramSessionContentId,
  type ContentRankInput,
} from "@/lib/content/recommend";
import { CONTENT_KINDS, isContentKind } from "@/lib/content-match";

const catalog: PublicContentItem[] = CONTENT_OS_ITEMS;

function rank(
  partial: Partial<ContentRankInput["decisions"]> & {
    recovery?: string | null;
    triggers?: string[];
    goal?: string | null;
  },
): ContentRankInput {
  const input: ContentRankInput = {
    context: {
      goal: partial.goal ?? "performance",
      recovery: { level: partial.recovery ?? "recovered" },
    },
    decisions: {
      trainingMode: partial.trainingMode ?? "full",
      primaryAction: partial.primaryAction ?? "train",
    },
  };
  if (partial.triggers?.length) {
    input.behavior = { triggers: partial.triggers.map((key) => ({ key, active: true })) };
  }
  return input;
}

describe("content OS kinds", () => {
  it("includes video and education", () => {
    expect(CONTENT_KINDS).toContain("video");
    expect(CONTENT_KINDS).toContain("education");
    expect(isContentKind("education")).toBe(true);
    expect(catalog.some((c) => c.kind === "education")).toBe(true);
  });
});

describe("content recommendation", () => {
  it("prefers recovery when decision is rest / recovery low", () => {
    const hits = recommendContent(rank({ trainingMode: "rest", recovery: "low" }), catalog);
    expect(hits[0]?.kind).toBe("recovery");
    expect(hits[0]?.reason).toBe("recovery");
  });

  it("prefers technique on full workout", () => {
    const hits = recommendContent(rank({ trainingMode: "full" }), catalog);
    expect(hits[0]?.kind).toBe("technique");
    expect(hits[0]?.reason).toBe("technique");
  });

  it("prefers nutrition on meal primary action", () => {
    const hits = recommendContent(
      rank({ primaryAction: "meal", trainingMode: "express", goal: "massa" }),
      catalog,
    );
    expect(hits[0]?.kind).toBe("nutrition");
  });

  it("drops dismissed items from both progress sources", () => {
    const hits = recommendContent(rank({ trainingMode: "rest" }), catalog, [
      { contentId: "soldiers-recovery-rest", dismissed: true },
    ]);
    expect(hits.some((h) => h.contentId === "soldiers-recovery-rest")).toBe(false);
  });

  it("resolves program session contentId", () => {
    expect(resolveProgramSessionContentId("program-base-4w", 1, 1)).toBe(
      "soldiers-technique-bracing",
    );
    expect(catalog.some((c) => c.id === "soldiers-technique-bracing")).toBe(true);
  });

  it("pickEditorialItems still works without snapshot (goal/level)", () => {
    const viaMatch = pickEditorialItemsByGoal(
      catalog,
      { goal: "massa", date: new Date("2026-09-19") },
      2,
    );
    const viaWrapper = pickEditorialItems(
      catalog,
      { goal: "massa", date: new Date("2026-09-19") },
      2,
    );
    expect(viaWrapper.map((i) => i.id)).toEqual(viaMatch.map((i) => i.id));
    expect(viaWrapper.length).toBeGreaterThan(0);
  });
});
