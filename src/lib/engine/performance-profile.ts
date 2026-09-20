import { performanceDimensions, performanceScore } from "@/lib/engine/dimensions";
import type { AppState, Level, Profile } from "@/lib/types";

export const PERFORMANCE_PROFILE_DISCLAIMER =
  "Indicadores internos do produto — não são medidas clínicas ou científicas.";

export type PerformanceProfileKey =
  | "strength"
  | "conditioning"
  | "nutrition"
  | "recovery"
  | "consistency"
  | "mobility"
  | "performance_level";

export interface PerformanceProfileIndicator {
  key: PerformanceProfileKey;
  label: string;
  /** 0–100 product indicator (except performance_level uses mapped score) */
  score: number;
  /** Human-readable level label for performance_level */
  levelLabel?: string;
}

export interface PerformanceProfile {
  indicators: PerformanceProfileIndicator[];
  aggregateScore: number;
  level: Level;
  disclaimer: string;
}

const LEVEL_SCORE: Record<Level, number> = {
  iniciante: 35,
  intermediario: 60,
  avancado: 85,
};

const LEVEL_LABEL_PT: Record<Level, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Heuristic mobility indicator from check-ins + soft activity signals. */
export function mobilityScore(state: AppState): number {
  const checkIns = Object.values(state.dayCheckIns ?? {})
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 7);
  if (!checkIns.length) return 50;

  const sorenessAvg =
    checkIns.reduce((s, c) => s + (c.soreness ?? 3), 0) / checkIns.length;
  const energyBonus =
    checkIns.filter((c) => c.energy === "alta").length * 4 -
    checkIns.filter((c) => c.energy === "baixa").length * 5;
  // Lower soreness → higher mobility feel
  const base = 100 - (sorenessAvg - 1) * 18;
  return clamp(base + energyBonus);
}

/**
 * Product-facing Performance Profile (7 indicators).
 * Built on top of engine dimensions — does not replace the internal 8-axis model.
 */
export function buildPerformanceProfile(state: AppState, profile: Profile): PerformanceProfile {
  const dims = performanceDimensions(state, profile);
  const byKey = Object.fromEntries(dims.map((d) => [d.key, d.score]));

  const indicators: PerformanceProfileIndicator[] = [
    { key: "strength", label: "Strength", score: clamp(byKey["forca"] ?? 40) },
    { key: "conditioning", label: "Conditioning", score: clamp(byKey["resistencia"] ?? 40) },
    { key: "nutrition", label: "Nutrition", score: clamp(byKey["nutricao"] ?? 40) },
    { key: "recovery", label: "Recovery", score: clamp(byKey["recuperacao"] ?? 40) },
    { key: "consistency", label: "Consistency", score: clamp(byKey["consistencia"] ?? 40) },
    { key: "mobility", label: "Mobility", score: mobilityScore(state) },
    {
      key: "performance_level",
      label: "Performance level",
      score: LEVEL_SCORE[profile.level],
      levelLabel: LEVEL_LABEL_PT[profile.level],
    },
  ];

  return {
    indicators,
    aggregateScore: performanceScore(dims),
    level: profile.level,
    disclaimer: PERFORMANCE_PROFILE_DISCLAIMER,
  };
}
