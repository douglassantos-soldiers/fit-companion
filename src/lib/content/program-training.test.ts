import { describe, expect, it } from "vitest";
import { parseProgramTraining, isAuthoritativeTraining } from "@/lib/content/program-training";
import { CONTENT_OS_PROGRAM_SESSIONS } from "@/data/content-os-seed";

describe("parseProgramTraining", () => {
  it("returns null for editorial theme bags", () => {
    expect(parseProgramTraining({ theme: "técnica" })).toBeNull();
    expect(isAuthoritativeTraining({ theme: "técnica" })).toBe(false);
  });

  it("parses authoritative exercises", () => {
    const day = parseProgramTraining({
      title: "Empurrar",
      focus: "peito",
      estimatedMin: 45,
      exercises: [
        { exerciseId: "supino-reto", sets: 3, reps: "8-10", restSec: 90, loadHint: 50, unit: "kg" },
      ],
    });
    expect(day).not.toBeNull();
    expect(day!.title).toBe("Empurrar");
    expect(day!.exercises).toHaveLength(1);
    expect(day!.exercises[0]!.exerciseId).toBe("supino-reto");
    expect(day!.exercises[0]!.loadHint).toBe(50);
  });

  it("seed program-base-4w has 12 authoritative days", () => {
    const sessions = CONTENT_OS_PROGRAM_SESSIONS.filter((s) => s.programId === "program-base-4w");
    expect(sessions).toHaveLength(12);
    for (const s of sessions) {
      expect(isAuthoritativeTraining(s.training)).toBe(true);
    }
  });
});
