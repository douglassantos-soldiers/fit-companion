import { describe, expect, it } from "vitest";
import { EXERCISE_LIBRARY, PLANNER_EXERCISE_IDS } from "@/data/exercise-library";
import { EXERCISE_LIBRARY_LOTE2 } from "@/data/exercise-library-lote2";
import { EXERCISE_LIBRARY_LOTE2B } from "@/data/exercise-library-lote2b";
import { EXERCISE_LIBRARY_LOTE2C } from "@/data/exercise-library-lote2c";
import { EXERCISE_LIBRARY_LOTE3 } from "@/data/exercise-library-lote3";
import { GYM_GEAR_VALUES } from "@/lib/training/canonical-exercise";
import { defaultInventory, GYM_GEAR_OPTIONS } from "@/lib/training/inventory";

const LOTE2_IDS = EXERCISE_LIBRARY_LOTE2.map((e) => e.id);
const LOTE2B_IDS = EXERCISE_LIBRARY_LOTE2B.map((e) => e.id);
const LOTE2C_IDS = EXERCISE_LIBRARY_LOTE2C.map((e) => e.id);
const LOTE3_IDS = EXERCISE_LIBRARY_LOTE3.map((e) => e.id);
const DEFERRED_LOTE4 = ["Muscle up", "Arranco", "Arremesso", "Puxada atrás da nuca"];

describe("catalog scale exercises", () => {
  it("keeps lote 2 ids unique and planner eligible", () => {
    expect(LOTE2_IDS).toHaveLength(24);
    expect(new Set(LOTE2_IDS).size).toBe(24);
    expect(EXERCISE_LIBRARY_LOTE2.every((e) => e.plannerEligible)).toBe(true);
    expect(EXERCISE_LIBRARY_LOTE2.every((e) => e.instructions.length >= 3)).toBe(true);
  });

  it("keeps lote 2b planner eligible with instructions", () => {
    expect(LOTE2B_IDS).toHaveLength(35);
    expect(new Set(LOTE2B_IDS).size).toBe(35);
    expect(EXERCISE_LIBRARY_LOTE2B.every((e) => e.plannerEligible)).toBe(true);
    expect(EXERCISE_LIBRARY_LOTE2B.every((e) => e.instructions.length >= 3)).toBe(true);
  });

  it("keeps lote 2c library-only with instructions", () => {
    expect(LOTE2C_IDS).toHaveLength(80);
    expect(new Set(LOTE2C_IDS).size).toBe(80);
    expect(EXERCISE_LIBRARY_LOTE2C.every((e) => e.plannerEligible === false)).toBe(true);
    expect(EXERCISE_LIBRARY_LOTE2C.every((e) => e.instructions.length >= 3)).toBe(true);
    for (const id of LOTE2C_IDS) {
      expect(PLANNER_EXERCISE_IDS).not.toContain(id);
    }
  });

  it("marks lote 2/3 taxonomy gaps covered and leaves lote 4 deferred", () => {
    const libraryNames = new Set(EXERCISE_LIBRARY.map((e) => e.displayNamePt));
    for (const row of [...EXERCISE_LIBRARY_LOTE2, ...EXERCISE_LIBRARY_LOTE3]) {
      expect(libraryNames.has(row.displayNamePt)).toBe(true);
    }
    for (const name of DEFERRED_LOTE4) {
      expect(libraryNames.has(name)).toBe(false);
    }
  });

  it("covers carry and rotation patterns", () => {
    const patterns = new Set(EXERCISE_LIBRARY.map((e) => e.movementPattern));
    expect(patterns.has("carry")).toBe(true);
    expect(patterns.has("rotation")).toBe(true);
    expect(patterns.has("anti_rotation")).toBe(true);
  });

  it("keeps lote 3 out of the planner pool and scales library to ~250", () => {
    expect(LOTE3_IDS).toHaveLength(11);
    expect(EXERCISE_LIBRARY_LOTE3.every((e) => e.plannerEligible === false)).toBe(true);
    for (const id of LOTE3_IDS) {
      expect(PLANNER_EXERCISE_IDS).not.toContain(id);
    }
    expect(EXERCISE_LIBRARY).toHaveLength(250);
    expect(PLANNER_EXERCISE_IDS).toHaveLength(159);
  });

  it("exposes new GymGear options in inventory defaults", () => {
    expect(GYM_GEAR_OPTIONS).toEqual(expect.arrayContaining(["cabos", "kettlebell", "cardio"]));
    expect(GYM_GEAR_VALUES).toEqual(expect.arrayContaining(["cabos", "kettlebell", "cardio"]));
    expect(defaultInventory("academia")).toEqual(expect.arrayContaining(["cabos", "cardio"]));
    expect(defaultInventory("casa")).toEqual(expect.arrayContaining(["kettlebell"]));
  });
});
