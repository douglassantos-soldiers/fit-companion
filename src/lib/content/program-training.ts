/**
 * Parse Content OS training_json into an authoritative day prescription.
 * Editorial bags like `{ theme: "técnica" }` return null.
 */
import type { ProgramTrainingDay, ProgramTrainingExercise } from "@/lib/content/types";

function asPositiveInt(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
}

function asReps(v: unknown): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return String(Math.round(v));
  return "8-10";
}

function asUnit(v: unknown): ProgramTrainingExercise["unit"] | undefined {
  if (v === "kg" || v === "corpo" || v === "min") return v;
  return undefined;
}

export function parseProgramTrainingExercise(raw: unknown): ProgramTrainingExercise | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const exerciseId = typeof o.exerciseId === "string" ? o.exerciseId.trim() : "";
  if (!exerciseId) return null;
  const sets = asPositiveInt(o.sets, 3);
  const reps = asReps(o.reps);
  const restSec =
    o.restSec != null && Number.isFinite(Number(o.restSec))
      ? Math.max(0, Math.round(Number(o.restSec)))
      : undefined;
  const loadHint =
    o.loadHint != null && Number.isFinite(Number(o.loadHint))
      ? Math.max(0, Number(o.loadHint))
      : undefined;
  const unit = asUnit(o.unit);
  return {
    exerciseId,
    sets,
    reps,
    ...(restSec != null ? { restSec } : {}),
    ...(loadHint != null ? { loadHint } : {}),
    ...(unit ? { unit } : {}),
  };
}

export function parseProgramTraining(raw: unknown): ProgramTrainingDay | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const list = Array.isArray(o.exercises) ? o.exercises : null;
  if (!list?.length) return null;
  const exercises = list
    .map(parseProgramTrainingExercise)
    .filter((e): e is ProgramTrainingExercise => Boolean(e));
  if (!exercises.length) return null;
  const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : undefined;
  const focus = typeof o.focus === "string" && o.focus.trim() ? o.focus.trim() : undefined;
  const estimatedMin =
    o.estimatedMin != null && Number.isFinite(Number(o.estimatedMin))
      ? Math.max(1, Math.round(Number(o.estimatedMin)))
      : undefined;
  return {
    exercises,
    ...(title ? { title } : {}),
    ...(focus ? { focus } : {}),
    ...(estimatedMin != null ? { estimatedMin } : {}),
  };
}

export function isAuthoritativeTraining(raw: unknown): boolean {
  return parseProgramTraining(raw) != null;
}
