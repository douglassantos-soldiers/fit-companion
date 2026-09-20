import type { SessionRpe, SetLog } from "@/lib/types";

export function isWorkingSet(set: SetLog) {
  return (set.type ?? "working") !== "warmup" && !set.skipped;
}

export function countableSets(sets: SetLog[]) {
  return sets.filter(isWorkingSet);
}

/** Last logged numeric effort on working sets → session RPE bucket. */
export function sessionRpeFromSets(sets: SetLog[]): SessionRpe | undefined {
  const working = countableSets(sets).filter((s) => s.done || s.completed);
  if (!working.length) return undefined;

  const last = [...working].reverse().find((s) => s.rpe != null || s.rir != null) ?? working[working.length - 1];
  if (!last) return undefined;

  let numeric: number | undefined;
  if (typeof last.rpe === "number") numeric = last.rpe;
  else if (typeof last.rir === "number") numeric = 10 - last.rir;

  if (numeric == null) {
    const avg =
      working.reduce((sum, s) => {
        if (typeof s.rpe === "number") return sum + s.rpe;
        if (typeof s.rir === "number") return sum + (10 - s.rir);
        return sum;
      }, 0) / working.filter((s) => s.rpe != null || s.rir != null).length;
    if (!Number.isFinite(avg)) return undefined;
    numeric = avg;
  }

  if (numeric <= 6.5) return "facil";
  if (numeric >= 8.5) return "dificil";
  return "ok";
}

export function parseRepTarget(reps: string) {
  const nums = reps.match(/\d+/g)?.map(Number) ?? [];
  return nums[0] ?? 10;
}
