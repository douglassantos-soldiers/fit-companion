/**
 * Deterministic intent classification (no LLM).
 */

import type { KnowledgeDomain } from "@/ai/contracts/knowledge-document";
import {
  COACH_AGENT_ID,
  SPECIALIST_BEHAVIOR_ID,
  SPECIALIST_NUTRITION_ID,
  SPECIALIST_PERFORMANCE_ID,
  SPECIALIST_RECOVERY_ID,
  SPECIALIST_TRAINING_ID,
} from "@/ai/agents/ids";

export type IntentClass = {
  agents: string[];
  knowledgeDomains: KnowledgeDomain[];
  skillHints: string[];
  toolHints: string[];
  needsDecisionHandoff: boolean;
  labels: string[];
};

function hasAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

export function classifyIntent(intent: string): IntentClass {
  const t = intent.trim().toLowerCase();

  const training = hasAny(t, [
    "trein",
    "treino",
    "volume",
    "exerc",
    "workout",
    "muscul",
    "progression",
    "deload",
  ]);
  const nutrition = hasAny(t, ["comida", "refei", "macro", "prote", "nutri", "dieta", "calor"]);
  const recovery = hasAny(t, ["cansad", "fadig", "sono", "sleep", "recover", "recupera", "exaust"]);
  const behavior = hasAny(t, ["hábito", "habito", "aderência", "aderencia", "checkin", "fric"]);
  const performance = hasAny(t, [
    "performance",
    "resultado",
    "tendência",
    "tendencia",
    "risco",
    "overview",
    "driver",
    "c360",
  ]);

  const agents: string[] = [];
  const knowledgeDomains: KnowledgeDomain[] = [];
  const skillHints: string[] = [];
  const toolHints: string[] = [];
  const labels: string[] = [];

  if (performance && !training && !nutrition && !recovery && !behavior) {
    agents.push(SPECIALIST_PERFORMANCE_ID);
    knowledgeDomains.push("performance", "coaching");
    skillHints.push("analyze_performance", "explain_decision", "analyze_outcome");
    toolHints.push("get_recent_decisions", "get_recent_outcomes", "get_user_profile");
    labels.push("performance");
  }

  if (recovery) {
    agents.push(SPECIALIST_RECOVERY_ID);
    knowledgeDomains.push("recovery", "sleep");
    skillHints.push("analyze_recovery", "analyze_fatigue", "analyze_sleep");
    toolHints.push("get_recovery", "get_sleep", "get_wearable_data");
    labels.push("recovery");
  }
  if (training) {
    agents.push(SPECIALIST_TRAINING_ID);
    knowledgeDomains.push("exercise", "performance");
    skillHints.push("analyze_training", "adjust_training_load");
    toolHints.push("get_training_history", "get_current_plan", "get_recovery");
    labels.push("training");
  }
  if (nutrition) {
    agents.push(SPECIALIST_NUTRITION_ID);
    knowledgeDomains.push("nutrition");
    skillHints.push("analyze_nutrition", "adjust_macros");
    toolHints.push("get_nutrition", "get_user_goal");
    labels.push("nutrition");
  }
  if (behavior) {
    agents.push(SPECIALIST_BEHAVIOR_ID);
    knowledgeDomains.push("behavior");
    skillHints.push("analyze_adherence", "detect_friction");
    toolHints.push("get_recent_outcomes", "get_training_history");
    labels.push("behavior");
  }

  if (agents.length === 0) {
    agents.push(COACH_AGENT_ID);
    knowledgeDomains.push("coaching", "performance");
    skillHints.push("explain_decision", "generate_daily_context");
    toolHints.push("get_user_profile", "get_recent_decisions");
    labels.push("simple");
  }

  const needsDecisionHandoff = training || recovery || labels.includes("training");

  return {
    agents: [...new Set(agents)],
    knowledgeDomains: [...new Set(knowledgeDomains)],
    skillHints: [...new Set(skillHints)],
    toolHints: [...new Set(toolHints)],
    needsDecisionHandoff,
    labels,
  };
}
