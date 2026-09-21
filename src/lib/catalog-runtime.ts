/**
 * Client/runtime catalog hydrate: merge public overlays onto code seeds.
 */
import { EXERCISE_LIBRARY, setResolvedLibrary } from "@/data/exercise-library";
import { CHALLENGES_SEED, replaceChallenges } from "@/data/challenges";
import { replacePlannerExercises, setAlternativeIds } from "@/data/exercises";
import {
  activeChallenges,
  alternativeMapFromResolved,
  mergeChallenges,
  resolveExerciseCatalog,
  toPlannerExercises,
  type ChallengeOverlay,
  type ExerciseOverlay,
} from "@/lib/training/resolve-catalog";
import {
  mergeTrainingRules,
  setTrainingRules,
  type TrainingRules,
} from "@/lib/training/training-rules";
import { setPublishedContent, type PublicContentItem } from "@/lib/content-match";
import {
  defaultContentOsOverlay,
  mergeContentItems,
  setContentOsCatalog,
} from "@/lib/content/catalog";
import type {
  ContentCollection,
  ContentProgram,
  Expert,
  ProgramSession,
} from "@/lib/content/types";
import { applyTacoCatalog } from "@/lib/nutrition/food-catalog";
import type { FoodItem, FoodServing } from "@/lib/nutrition/types";

export type PublicCatalog = {
  exercises: ExerciseOverlay[];
  challenges: ChallengeOverlay[];
  participantCounts: Record<string, number>;
  trainingRules: Record<string, unknown> | null;
  content: PublicContentItem[];
  tacoLicenseVerified?: boolean;
  tacoFoods?: FoodItem[];
  tacoServings?: FoodServing[];
  experts?: Expert[];
  programs?: ContentProgram[];
  collections?: ContentCollection[];
  programSessions?: ProgramSession[];
};

export const EMPTY_PUBLIC_CATALOG: PublicCatalog = {
  exercises: [],
  challenges: [],
  participantCounts: {},
  trainingRules: null,
  content: [],
  tacoLicenseVerified: false,
  tacoFoods: [],
  tacoServings: [],
  experts: [],
  programs: [],
  collections: [],
  programSessions: [],
};

export function applyPublicCatalog(catalog: PublicCatalog | null | undefined): void {
  const c = catalog ?? EMPTY_PUBLIC_CATALOG;
  const exercises = (c.exercises ?? []) as ExerciseOverlay[];
  const challenges = (c.challenges ?? []) as ChallengeOverlay[];
  const resolvedEx = resolveExerciseCatalog(EXERCISE_LIBRARY, exercises);
  setResolvedLibrary(resolvedEx);
  replacePlannerExercises(toPlannerExercises(resolvedEx));
  setAlternativeIds(alternativeMapFromResolved(resolvedEx));

  const resolvedCh = mergeChallenges(CHALLENGES_SEED, challenges, c.participantCounts ?? {});
  replaceChallenges(activeChallenges(resolvedCh));

  const rules: TrainingRules | null =
    c.trainingRules && typeof c.trainingRules === "object"
      ? mergeTrainingRules(c.trainingRules)
      : null;
  setTrainingRules(rules);

  const seed = defaultContentOsOverlay();
  const content = mergeContentItems(seed.content, (c.content ?? []) as PublicContentItem[]);
  setPublishedContent(content);
  setContentOsCatalog({
    experts: (c.experts?.length ? c.experts : seed.experts) as Expert[],
    programs: (c.programs?.length ? c.programs : seed.programs) as ContentProgram[],
    collections: (c.collections?.length ? c.collections : seed.collections) as ContentCollection[],
    sessions: (c.programSessions?.length ? c.programSessions : seed.sessions) as ProgramSession[],
  });

  applyTacoCatalog({
    tacoLicenseVerified: c.tacoLicenseVerified === true,
    tacoFoods: c.tacoFoods ?? [],
    tacoServings: c.tacoServings ?? [],
  });
}
