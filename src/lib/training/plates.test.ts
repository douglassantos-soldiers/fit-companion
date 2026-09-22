import { describe, expect, it } from "vitest";
import { plateBreakdown, DEFAULT_BAR_KG, HOME_BAR_KG } from "@/lib/training/plates";
import { propagateSetToFollowing, nextWorkingSetFromLast } from "@/lib/training/session-logs";
import type { SetLog } from "@/lib/types";

describe("plateBreakdown", () => {
  it("returns null at or below bar", () => {
    expect(plateBreakdown(20)).toBeNull();
    expect(plateBreakdown(15, { homeBar: true })).toBeNull();
    expect(plateBreakdown(0)).toBeNull();
  });

  it("decomposes 60 kg on 20 kg bar", () => {
    const b = plateBreakdown(60)!;
    expect(b.barKg).toBe(DEFAULT_BAR_KG);
    expect(b.remainderKg).toBe(0);
    expect(b.label).toBe("20 + 2×20");
  });

  it("decomposes 100 kg", () => {
    const b = plateBreakdown(100)!;
    expect(b.barKg).toBe(20);
    expect(b.remainderKg).toBe(0);
    // 40 per side → 25+10+5
    expect(b.plates.some((p) => p.plateKg === 25 && p.perSide === 1)).toBe(true);
  });

  it("uses home bar 15 kg", () => {
    const b = plateBreakdown(35, { homeBar: true })!;
    expect(b.barKg).toBe(HOME_BAR_KG);
    expect(b.remainderKg).toBe(0);
  });
});

describe("propagateSetToFollowing", () => {
  const base = (partial: Partial<SetLog> & Pick<SetLog, "reps" | "weightKg">): SetLog => ({
    done: false,
    type: "working",
    ...partial,
  });

  it("copies weight and reps to following unfinished working sets", () => {
    const sets = [
      base({ reps: 8, weightKg: 62.5, done: true }),
      base({ reps: 10, weightKg: 60 }),
      base({ reps: 10, weightKg: 60 }),
    ];
    const next = propagateSetToFollowing(sets, 0);
    expect(next[1]!.weightKg).toBe(62.5);
    expect(next[1]!.reps).toBe(8);
    expect(next[2]!.weightKg).toBe(62.5);
  });

  it("skips warmups and done sets", () => {
    const sets = [
      base({ reps: 8, weightKg: 50, done: true }),
      base({ reps: 5, weightKg: 20, type: "warmup" }),
      base({ reps: 10, weightKg: 45, done: true }),
      base({ reps: 10, weightKg: 45 }),
    ];
    const next = propagateSetToFollowing(sets, 0);
    expect(next[1]!.weightKg).toBe(20);
    expect(next[2]!.weightKg).toBe(45);
    expect(next[3]!.weightKg).toBe(50);
  });

  it("nextWorkingSetFromLast copies last", () => {
    const sets = [base({ reps: 8, weightKg: 70 })];
    const next = nextWorkingSetFromLast(sets, { reps: 10, weightKg: 0 });
    expect(next.reps).toBe(8);
    expect(next.weightKg).toBe(70);
    expect(next.setNumber).toBe(2);
  });
});
