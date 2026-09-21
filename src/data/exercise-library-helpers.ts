/**
 * Shared library exercise helper — used by lote 1/2/3 seeds.
 */
import type { AnimationSpec } from "@/lib/soldiers-media-types";
import {
  toCanonicalExercise,
  type CanonicalExercise,
  type LegacyMovementPattern,
} from "@/lib/training/canonical-exercise";

export type LibraryExercise = CanonicalExercise;

const SPEC: Pick<AnimationSpec, "tempo" | "durationSec" | "loop" | "camera"> = {
  tempo: "controlled",
  durationSec: 4,
  loop: true,
  camera: "three-quarter",
};

export const PLANNER_ELIGIBLE = true;
export const LIBRARY_ONLY = false;

export function ex(
  partial: Omit<
    LibraryExercise,
    | "active"
    | "animationSpec"
    | "primaryMuscles"
    | "canonicalName"
    | "displayNamePt"
    | "version"
    | "alternativeIds"
    | "mediaId"
    | "mediaStatus"
    | "movementPattern"
  > & {
    movementPattern: LegacyMovementPattern;
    start: string;
    end: string;
    tempo?: AnimationSpec["tempo"];
    camera?: AnimationSpec["camera"];
  },
): LibraryExercise {
  return toCanonicalExercise({
    ...partial,
    primaryMuscles: [partial.group],
    active: true,
    animationSpec: {
      start: partial.start,
      end: partial.end,
      tempo: partial.tempo ?? SPEC.tempo,
      durationSec: SPEC.durationSec,
      loop: SPEC.loop,
      camera: partial.camera ?? SPEC.camera,
    },
  });
}
