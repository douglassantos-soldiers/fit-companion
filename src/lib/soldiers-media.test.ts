import { describe, expect, it } from "vitest";
import { EXERCISE_LIBRARY, PLANNER_EXERCISE_IDS, libraryById } from "@/data/exercise-library";
import { EXERCISES, alternativesFor } from "@/data/exercises";
import {
  coverageReport,
  PILOT_EXERCISE_IDS,
  SOLDIERS_MEDIA_MANIFEST,
} from "@/data/soldiers-media-manifest";
import { resolveExerciseMedia, resolveMealMedia, resolveProductMedia } from "@/lib/soldiers-media";
import { MEAL_PRESETS } from "@/data/meal-presets";
import { PRODUCTS } from "@/data/products";

describe("exercise library lote 1", () => {
  it("authors ~100 unique exercises", () => {
    const ids = EXERCISE_LIBRARY.map((e) => e.id);
    expect(ids.length).toBeGreaterThanOrEqual(100);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps planner pool aligned with EXERCISES", () => {
    const planner = [...PLANNER_EXERCISE_IDS].sort();
    const current = EXERCISES.map((e) => e.id).sort();
    expect(planner).toEqual(current);
    expect(planner.length).toBeGreaterThanOrEqual(100);
    expect(planner.length).toBeLessThan(EXERCISE_LIBRARY.length);
  });

  it("exposes former library-only ids as swaps", () => {
    const alts = alternativesFor("supino-reto", "academia");
    expect(alts.some((e) => e.id === "supino-declinado")).toBe(true);
  });

  it("every library row has instructions and animationSpec", () => {
    for (const row of EXERCISE_LIBRARY) {
      expect(row.instructions.length).toBeGreaterThanOrEqual(3);
      expect(row.animationSpec.start.length).toBeGreaterThan(4);
      expect(row.animationSpec.end.length).toBeGreaterThan(4);
      expect(libraryById(row.id)?.id).toBe(row.id);
    }
  });
});

describe("soldiers media resolver", () => {
  it("publishes the exercise pilot as soldiers posters", () => {
    for (const id of PILOT_EXERCISE_IDS) {
      const media = resolveExerciseMedia(id);
      expect(media.source).toBe("soldiers");
      expect(media.posterUrl).toContain(`/soldiers-media/v1/exercise/${id}/poster.webp`);
    }
  });

  it("covers meal presets and products", () => {
    expect(MEAL_PRESETS.every((m) => resolveMealMedia(m.id).source === "soldiers")).toBe(true);
    expect(PRODUCTS.every((p) => resolveProductMedia(p.id).source === "soldiers")).toBe(true);
  });

  it("does not keep Unsplash on published Soldiers entities", () => {
    for (const id of PILOT_EXERCISE_IDS) {
      const ex = EXERCISES.find((e) => e.id === id);
      expect(ex?.mediaUrl ?? "").not.toMatch(/unsplash/i);
    }
    for (const meal of MEAL_PRESETS) {
      expect(meal.imageUrl ?? "").not.toMatch(/unsplash/i);
      expect(resolveMealMedia(meal.id, meal.imageUrl).source).toBe("soldiers");
    }
  });

  it("reports coverage by kind including motion without video", () => {
    const report = coverageReport();
    expect(report.exercise?.total).toBe(EXERCISE_LIBRARY.length);
    expect(report.exercise?.published).toBe(PILOT_EXERCISE_IDS.length);
    expect(report.exercise?.motionPublished).toBe(PILOT_EXERCISE_IDS.length);
    expect(report.exercise?.motionWithoutVideo).toBe(0);
    expect(report.meal?.published).toBe(MEAL_PRESETS.length);
    expect(report.brand?.motionWithoutVideo).toBe(0);
    expect(report.howto?.motionWithoutVideo).toBe(0);
    expect(SOLDIERS_MEDIA_MANIFEST.every((a) => a.license === "soldiers-owned")).toBe(true);
  });
});
