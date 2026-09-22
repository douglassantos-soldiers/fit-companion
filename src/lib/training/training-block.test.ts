import { describe, expect, it } from "vitest";
import {
  activeBlockFromProgram,
  blockPhaseWeekHint,
  blockWeekIndex,
  buildWeeklyPlanFromBlock,
  completeBlockDay,
  resolveBlockDay,
} from "@/lib/training/training-block";
import {
  CONTENT_OS_PROGRAMS,
  CONTENT_OS_PROGRAM_SESSIONS,
} from "@/data/content-os-seed";

describe("training-block", () => {
  const program = CONTENT_OS_PROGRAMS.find((p) => p.id === "program-base-4w")!;
  const block = activeBlockFromProgram(program, CONTENT_OS_PROGRAM_SESSIONS, "2026-09-21")!;

  it("enrolls program-base-4w into 4 weeks × 3 days", () => {
    expect(block).not.toBeNull();
    expect(block.durationWeeks).toBe(4);
    expect(block.weeks).toHaveLength(4);
    expect(block.weeks[0]!.days).toHaveLength(3);
    expect(block.weeks[0]!.days[0]!.exercises[0]!.exerciseId).toBe("supino-reto");
  });

  it("resolveBlockDay maps weekday to N-th prescription", () => {
    // 2026-09-21 is Monday; profile Mon/Wed/Fri → day 1
    const day = resolveBlockDay(block, "2026-09-21", [1, 3, 5]);
    expect(day).not.toBeNull();
    expect(day!.id).toBe("program-base-4w-w1d1");
    expect(day!.title).toBe("Empurrar");
    expect(day!.weekday).toBe(1);
  });

  it("blockWeekIndex advances by calendar weeks", () => {
    expect(blockWeekIndex(block, "2026-09-21")).toBe(0);
    expect(blockWeekIndex(block, "2026-09-28")).toBe(1);
    expect(blockWeekIndex(block, "2026-10-19")).toBe(3);
  });

  it("buildWeeklyPlanFromBlock returns PlannedDays", () => {
    const days = buildWeeklyPlanFromBlock(block, { daysPerWeek: 3, trainingWeekdays: [1, 3, 5] });
    expect(days).toHaveLength(3);
    expect(days.map((d) => d.weekday)).toEqual([1, 3, 5]);
  });

  it("completeBlockDay advances week then finishes with last dayId", () => {
    let cur = block;
    for (const d of block.weeks[0]!.days) {
      const next = completeBlockDay(cur, d.id);
      expect(next.finished).toBe(false);
      cur = next.block;
    }
    expect(cur.currentWeekIndex).toBe(1);

    for (let w = 1; w < 4; w += 1) {
      for (const d of block.weeks[w]!.days) {
        const next = completeBlockDay(cur, d.id);
        if (w === 3 && d === block.weeks[3]!.days[block.weeks[3]!.days.length - 1]) {
          expect(next.finished).toBe(true);
          expect(next.block.completedDayIds).toContain(d.id);
        } else {
          expect(next.finished).toBe(false);
          cur = next.block;
        }
      }
    }
  });

  it("blockPhaseWeekHint deloads last 2 weeks", () => {
    expect(blockPhaseWeekHint(block, "2026-09-21")).toBeNull();
    expect(blockPhaseWeekHint(block, "2026-10-12")).toBe("deload");
    expect(blockPhaseWeekHint(block, "2026-10-19")).toBe("deload");
  });
});
