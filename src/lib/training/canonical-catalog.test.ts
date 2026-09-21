import { describe, expect, it } from "vitest";
import { EXERCISE_LIBRARY, libraryById, PLANNER_EXERCISE_IDS } from "@/data/exercise-library";
import { EXERCISES, exerciseById } from "@/data/exercises";
import { catalogById } from "@/lib/training/exercise-catalog";
import {
  CANONICAL_MOVEMENT_PATTERNS,
  mediaEntityId,
  normalizeMovementPattern,
  toCanonicalExercise,
} from "@/lib/training/canonical-exercise";
import { mergeExercises, resolveExerciseCatalog } from "@/lib/training/resolve-catalog";
import { coverageReport } from "@/data/soldiers-media-manifest";

const PATTERN_SET = new Set<string>(CANONICAL_MOVEMENT_PATTERNS);
const GROUPS = new Set([
  "peito",
  "costas",
  "pernas",
  "ombros",
  "biceps",
  "triceps",
  "core",
  "cardio",
]);
const EQUIPMENT = new Set(["casa", "academia", "ambos"]);

describe("canonical catalog integrity", () => {
  it("keeps unique ids in the Soldiers seed", () => {
    const ids = EXERCISE_LIBRARY.map((e) => e.id);
    expect(ids.length).toBeGreaterThanOrEqual(100);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points alternativeIds at existing ids (or empty)", () => {
    const ids = new Set(EXERCISE_LIBRARY.map((e) => e.id));
    for (const row of EXERCISE_LIBRARY) {
      expect(Array.isArray(row.alternativeIds)).toBe(true);
      for (const alt of row.alternativeIds) {
        expect(ids.has(alt)).toBe(true);
      }
    }
  });

  it("stores canonical group / movementPattern / equipment after aliases", () => {
    for (const row of EXERCISE_LIBRARY) {
      expect(GROUPS.has(row.group)).toBe(true);
      expect(EQUIPMENT.has(row.equipment)).toBe(true);
      expect(PATTERN_SET.has(row.movementPattern)).toBe(true);
    }
    expect(normalizeMovementPattern("fly")).toBe("raise");
    expect(normalizeMovementPattern("carry_iso")).toBe("isometric");
    expect(normalizeMovementPattern("other")).toBe("mobility");
  });

  it("keeps plannerEligible rows active in the EXERCISES pool", () => {
    const planner = EXERCISE_LIBRARY.filter((e) => e.plannerEligible);
    expect(planner.every((e) => e.active)).toBe(true);
    expect(EXERCISES.map((e) => e.id).sort()).toEqual([...PLANNER_EXERCISE_IDS].sort());
  });

  it("defaults mediaId to the canonical id", () => {
    for (const row of EXERCISE_LIBRARY) {
      expect(row.mediaId).toBe(row.id);
      expect(mediaEntityId(row)).toBe(row.id);
    }
    const report = coverageReport();
    expect(report["exercise"]?.total).toBe(EXERCISE_LIBRARY.length);
  });

  it("lets overlay win name/flags while seed fills the rest", () => {
    const first = EXERCISE_LIBRARY[0]!;
    const merged = mergeExercises(EXERCISE_LIBRARY, [
      { id: first.id, name: "Supino CMS", active: false },
    ]);
    const hit = merged.find((e) => e.id === first.id);
    expect(hit?.name).toBe("Supino CMS");
    expect(hit?.displayNamePt).toBe("Supino CMS");
    expect(hit?.active).toBe(false);
    expect(hit?.group).toBe(first.group);
    expect(hit?.instructions).toEqual(first.instructions);
    expect(hit?.mediaId).toBe(first.id);
  });

  it("returns the same id/group from planner and library adapters", () => {
    const lib = libraryById("supino-reto");
    const planner = exerciseById("supino-reto");
    const catalog = catalogById("supino-reto");
    expect(lib?.id).toBe("supino-reto");
    expect(planner?.id).toBe(lib?.id);
    expect(planner?.group).toBe(lib?.group);
    expect(catalog?.id).toBe(lib?.id);
    expect(catalog?.group).toBe(lib?.group);
  });

  it("maps fly → raise without breaking supino press", () => {
    expect(catalogById("supino-reto")?.movementPattern).toBe("press");
    expect(libraryById("supino-reto")?.movementPattern).toBe("press");
    expect(libraryById("crucifixo")?.movementPattern).toBe("raise");
    expect(catalogById("crucifixo")?.movementPattern).toBe("raise");
    const resolved = resolveExerciseCatalog(EXERCISE_LIBRARY, [
      { id: "crucifixo", movementPattern: "fly" },
    ]);
    expect(resolved.find((e) => e.id === "crucifixo")?.movementPattern).toBe("raise");
  });

  it("fills canonical defaults on a partial seed row", () => {
    const row = toCanonicalExercise({
      id: "demo-iso",
      name: "Prancha demo",
      movementPattern: "carry_iso",
    });
    expect(row.canonicalName).toBe("demo-iso");
    expect(row.displayNamePt).toBe("Prancha demo");
    expect(row.version).toBe(1);
    expect(row.mediaId).toBe("demo-iso");
    expect(row.movementPattern).toBe("isometric");
    expect(row.alternativeIds).toEqual([]);
  });
});
