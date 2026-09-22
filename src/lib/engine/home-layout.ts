/**
 * Home block order from BehaviorProfile scores (Fase 16).
 * Persona still show/hides; this only reorders the sortable queue.
 */
import type { BehaviorProfile } from "@/lib/engine/behavior";
import type { AppState } from "@/lib/types";

export const PINNED_HOME_BLOCKS = ["inactive", "livingHero"] as const;
export type PinnedHomeBlockId = (typeof PINNED_HOME_BLOCKS)[number];

export type HomeBlockId =
  | "wow"
  | "weekPrs"
  | "periodReview"
  | "streakRisk"
  | "nutritionProof"
  | "registerMeal"
  | "supplement"
  | "insights"
  | "habitTip"
  | "socialTeaser";

const DEFAULT_ORDER: HomeBlockId[] = [
  "wow",
  "weekPrs",
  "periodReview",
  "streakRisk",
  "nutritionProof",
  "registerMeal",
  "supplement",
  "insights",
  "habitTip",
  "socialTeaser",
];

const LOW = 0.45;
const HIGH = 0.7;

export function orderHomeBlocks(
  _state: AppState,
  behavior: BehaviorProfile,
  opts?: { hasClub?: boolean; followingCount?: number; level?: string | null; isSunday?: boolean },
): HomeBlockId[] {
  const scores = new Map<HomeBlockId, number>(DEFAULT_ORDER.map((id, i) => [id, DEFAULT_ORDER.length - i]));

  const bump = (id: HomeBlockId, amount: number) => {
    scores.set(id, (scores.get(id) ?? 0) + amount);
  };

  if (opts?.isSunday) {
    bump("periodReview", 80);
    bump("weekPrs", 40);
    bump("wow", 35);
  }

  if (behavior.mealAdherence < LOW) {
    bump("nutritionProof", 50);
    bump("registerMeal", 45);
  }
  if (behavior.trainingAdherence < LOW || behavior.consistency < LOW) {
    bump("streakRisk", 50);
  }
  if (behavior.sleepBehavior < LOW) {
    bump("insights", 40);
  }
  if (opts?.hasClub || (opts?.followingCount ?? 0) > 0) {
    bump("socialTeaser", 35);
  }
  const advanced =
    opts?.level === "avancado" &&
    behavior.trainingAdherence >= HIGH &&
    behavior.consistency >= HIGH;
  if (advanced) {
    bump("wow", 40);
    bump("weekPrs", 35);
    bump("periodReview", 30);
  }

  return [...DEFAULT_ORDER].sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));
}
