/**
 * Behavior triggers — never fire on a single occurrence.
 */
import type {
  BehaviorPattern,
  BehaviorTrigger,
  BehaviorTriggerKey,
} from "@/lib/engine/behavior/types";
import { activeBehaviorPatterns } from "@/lib/engine/behavior/patterns";

const MIN_SUPPORT = 2;
const MIN_CONF = 0.55;

type TriggerRule = {
  key: BehaviorTriggerKey;
  description: string;
  patternKeys: BehaviorPattern["key"][];
};

const RULES: TriggerRule[] = [
  {
    key: "LOW_FRIDAY_ADHERENCE",
    description: "Baixa aderência de treino nas sextas",
    patternKeys: ["low_friday_training", "weak_weekday"],
  },
  {
    key: "LOW_SLEEP_STREAK",
    description: "Sequência de sono baixo",
    patternKeys: ["sleep_debt"],
  },
  {
    key: "MEAL_LOGGING_DROP",
    description: "Queda no registro de refeições",
    patternKeys: ["meal_logging_drop"],
  },
  {
    key: "TRAINING_SKIPPING_PATTERN",
    description: "Padrão de pular treinos em dia fraco",
    patternKeys: ["weak_weekday", "weekday_skip"],
  },
  {
    key: "WEEKEND_MEAL_GAP",
    description: "Gap de refeições no fim de semana",
    patternKeys: ["weekend_meal_gap"],
  },
  {
    key: "TIME_CONSTRAINT_PATTERN",
    description: "Restrição de tempo / treinos curtos",
    patternKeys: ["long_workout_avoidance", "prefers_short_sessions"],
  },
];

export function detectBehaviorTriggers(patterns: BehaviorPattern[]): BehaviorTrigger[] {
  const active = activeBehaviorPatterns(patterns);
  const out: BehaviorTrigger[] = [];

  for (const rule of RULES) {
    const matched = active.filter((p) => rule.patternKeys.includes(p.key));
    if (!matched.length) continue;
    const supportCount = matched.reduce((s, p) => s + p.supportCount, 0);
    const confidence =
      matched.reduce((s, p) => s + p.confidence, 0) / matched.length;
    const evidence = matched.flatMap((p) => p.evidence).slice(0, 8);
    const activeOk = supportCount >= MIN_SUPPORT && confidence >= MIN_CONF;
    out.push({
      key: rule.key,
      description: rule.description,
      patternKeys: rule.patternKeys,
      supportCount,
      confidence: Math.round(confidence * 100) / 100,
      active: activeOk,
      evidence,
    });
  }

  return out;
}

export function activeTriggers(triggers: BehaviorTrigger[]): BehaviorTrigger[] {
  return triggers.filter((t) => t.active);
}
