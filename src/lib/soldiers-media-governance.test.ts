/**
 * Soldiers Media Governance — resolver priority, validation, coverage.
 */
import { afterEach, describe, expect, it } from "vitest";
import { EXERCISE_LIBRARY } from "@/data/exercise-library";
import { PILOT_EXERCISE_IDS } from "@/data/soldiers-media-manifest";
import { emptyCmsState, setCmsCache } from "@/lib/cms";
import { computeMediaCoverage } from "@/lib/soldiers-media-coverage";
import {
  canTransitionStatus,
  checksumsMatch,
  isExternalMediaUrl,
  isSoldiersOwnedUrl,
  normalizePackageStatus,
  validateMediaPackage,
} from "@/lib/soldiers-media-governance";
import { hydrateSoldiersMedia, resolveExerciseMedia } from "@/lib/soldiers-media";
import {
  MEDIA_REGION_GLOBAL,
  MEDIA_STYLE,
  MEDIA_VARIANT_DEFAULT,
  MEDIA_VERSION,
  type SoldiersMediaAsset,
} from "@/lib/soldiers-media-types";

const OWNED = {
  version: MEDIA_VERSION,
  style: MEDIA_STYLE,
  source: "soldiers" as const,
  ownership: "owned" as const,
  license: "soldiers-owned" as const,
  variant: MEDIA_VARIANT_DEFAULT,
  region: MEDIA_REGION_GLOBAL,
};

function unpublishedId() {
  const id = EXERCISE_LIBRARY.find(
    (row) => !(PILOT_EXERCISE_IDS as readonly string[]).includes(row.id),
  )?.id;
  if (!id) throw new Error("expected a non-pilot exercise");
  return id;
}

afterEach(() => {
  setCmsCache(emptyCmsState());
  hydrateSoldiersMedia([]);
});

describe("media governance contract", () => {
  it("maps pending to draft", () => {
    expect(normalizePackageStatus("pending")).toBe("draft");
    expect(normalizePackageStatus("published")).toBe("published");
  });

  it("rejects illegal status transitions", () => {
    expect(canTransitionStatus("draft", "published")).toBe(false);
    expect(canTransitionStatus("generated", "published")).toBe(false);
    expect(canTransitionStatus("qa", "approved")).toBe(true);
    expect(canTransitionStatus("approved", "published")).toBe(true);
  });

  it("fails validate when published has no poster", () => {
    const pack: SoldiersMediaAsset = {
      kind: "exercise",
      entityId: "x",
      ...OWNED,
      needsMotion: true,
      status: "published",
    };
    const issues = validateMediaPackage(pack);
    expect(issues.some((i) => i.code === "poster_missing")).toBe(true);
  });

  it("never treats an external URL as soldiers-owned", () => {
    expect(isSoldiersOwnedUrl("https://images.unsplash.com/photo-x")).toBe(false);
    expect(isExternalMediaUrl("https://images.unsplash.com/photo-x")).toBe(true);
    expect(isSoldiersOwnedUrl("/soldiers-media/v1/exercise/flexao/poster.webp")).toBe(true);
  });

  it("detects checksum drift", () => {
    expect(checksumsMatch({ poster: "aaa" }, { poster: "bbb" })).toBe(false);
    expect(checksumsMatch({ poster: "aaa" }, { poster: "aaa" })).toBe(true);
  });
});

describe("resolve priority", () => {
  it("lets published Soldiers beat authorized CMS", () => {
    const id = PILOT_EXERCISE_IDS[0];
    setCmsCache({
      ...emptyCmsState(),
      exerciseMedia: { [id]: `/soldiers-media/v1/exercise/${id}/cms.webp` },
      exerciseMediaAuthorized: { [id]: true },
    });
    const media = resolveExerciseMedia(id);
    expect(media.source).toBe("soldiers");
  });

  it("ignores unauthorized CMS", () => {
    const id = unpublishedId();
    setCmsCache({
      ...emptyCmsState(),
      exerciseMedia: { [id]: `/soldiers-media/v1/exercise/${id}/poster.webp` },
      exerciseMediaAuthorized: { [id]: false },
    });
    expect(resolveExerciseMedia(id).source).toBe("none");
  });

  it("ignores authorized CMS when the URL is external", () => {
    const id = unpublishedId();
    setCmsCache({
      ...emptyCmsState(),
      exerciseMedia: { [id]: "https://images.unsplash.com/photo-x" },
      exerciseMediaAuthorized: { [id]: true },
    });
    const media = resolveExerciseMedia(id);
    expect(media.source).not.toBe("soldiers");
    expect(media.source).not.toBe("cms");
    expect(media.source).toBe("none");
  });

  it("uses authorized soldiers-owned CMS only when published package is absent", () => {
    const id = unpublishedId();
    const url = `/soldiers-media/v1/exercise/${id}/poster.webp`;
    setCmsCache({
      ...emptyCmsState(),
      exerciseMedia: { [id]: url },
      exerciseMediaAuthorized: { [id]: true },
    });
    const media = resolveExerciseMedia(id);
    expect(media.source).toBe("cms");
    expect(media.posterUrl).toBe(url);
  });

  it("uses legacy only when the migration flag is on", () => {
    const id = unpublishedId();
    const legacy = "https://images.unsplash.com/legacy.gif";
    expect(resolveExerciseMedia(id, legacy, { allowLegacy: false }).source).toBe("none");
    expect(resolveExerciseMedia(id, legacy, { allowLegacy: true }).source).toBe("legacy");
  });
});

describe("coverage scorecard", () => {
  it("counts library vs gaps", () => {
    const complete: SoldiersMediaAsset = {
      kind: "exercise",
      entityId: "a",
      ...OWNED,
      needsMotion: true,
      status: "published",
      posterUrl: "/soldiers-media/v1/exercise/a/poster.webp",
      thumbnailUrl: "/soldiers-media/v1/exercise/a/thumb.webp",
      webmUrl: "/soldiers-media/v1/exercise/a/animation.webm",
    };
    const draft: SoldiersMediaAsset = {
      kind: "exercise",
      entityId: "b",
      ...OWNED,
      needsMotion: true,
      status: "qa",
    };
    const report = computeMediaCoverage({
      exercises: [
        { id: "a", mediaId: "a" },
        { id: "b", mediaId: "b", mediaUrl: "https://images.unsplash.com/x" },
      ],
      packages: [complete, draft],
      cmsUrls: [{ url: "https://gymvisual.com/x", authorized: true }],
    });
    expect(report.totalExercises).toBe(2);
    expect(report.published).toBe(1);
    expect(report.mediaComplete).toBe(1);
    expect(report.qaPending).toBe(1);
    expect(report.posterMissing).toBe(1);
    expect(report.legacy).toBeGreaterThan(0);
    expect(report.externalUrls).toBeGreaterThan(0);
  });
});
