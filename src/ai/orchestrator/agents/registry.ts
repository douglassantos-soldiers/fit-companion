/**
 * Default Agent registry with tool/skill allowlists (5 specialists + coach).
 */

import type { Agent } from "@/ai/contracts/agent";
import {
  COACH_AGENT_ID,
  SPECIALIST_BEHAVIOR_ID,
  SPECIALIST_NUTRITION_ID,
  SPECIALIST_PERFORMANCE_ID,
  SPECIALIST_RECOVERY_ID,
  SPECIALIST_TRAINING_ID,
} from "@/ai/agents/ids";

const TRAINING_SKILLS = [
  "analyze_training",
  "select_exercise",
  "substitute_exercise",
  "adjust_training_load",
  "progression",
  "regression",
] as const;

const NUTRITION_SKILLS = ["analyze_nutrition", "adjust_macros", "meal_substitution"] as const;

const RECOVERY_SKILLS = ["analyze_sleep", "analyze_recovery", "analyze_fatigue"] as const;

const BEHAVIOR_SKILLS = ["analyze_adherence", "detect_friction", "habit_intervention"] as const;

const PERFORMANCE_SKILLS = [
  "analyze_performance",
  "explain_decision",
  "analyze_outcome",
  "generate_daily_context",
] as const;

const TRAINING_TOOLS = [
  "get_training_history",
  "get_current_plan",
  "get_training_session",
  "get_recent_decisions",
  "get_recovery",
] as const;

const NUTRITION_TOOLS = ["get_nutrition", "get_user_goal"] as const;

const RECOVERY_TOOLS = ["get_sleep", "get_recovery", "get_wearable_data"] as const;

const BEHAVIOR_TOOLS = [
  "get_nutrition",
  "get_training_history",
  "get_recent_outcomes",
  "get_recent_decisions",
] as const;

const PERFORMANCE_TOOLS = [
  "get_recent_decisions",
  "get_recent_outcomes",
  "get_user_profile",
  "get_recovery",
  "get_current_plan",
] as const;

const COACH_TOOLS = [
  "get_user_profile",
  "get_user_goal",
  "get_current_plan",
  "get_recovery",
  "get_recent_decisions",
  "get_recent_outcomes",
] as const;

const agents = new Map<string, Agent>();

function defineAgent(agent: Agent): void {
  agents.set(agent.id, agent);
}

export function clearAgentRegistry(): void {
  agents.clear();
}

export function registerAgent(agent: Agent): void {
  defineAgent(agent);
}

export function getAgent(id: string): Agent | undefined {
  return agents.get(id);
}

export function hasAgent(id: string): boolean {
  return agents.has(id);
}

export function listAgents(): Agent[] {
  return [...agents.values()];
}

export function registerDefaultAgents(opts?: { force?: boolean }): void {
  if (agents.size > 0 && !opts?.force) return;
  if (opts?.force) clearAgentRegistry();

  defineAgent({
    id: COACH_AGENT_ID,
    name: "Coach Agent",
    version: "1.0.0",
    kind: "coach",
    capabilities: ["explain", "propose", "retrieve_context", "call_tools", "run_skills"],
    allowed_skill_ids: [...PERFORMANCE_SKILLS, ...BEHAVIOR_SKILLS],
    allowed_tool_ids: [...COACH_TOOLS],
    description: "Product coach — orchestration entry, not Decision authority",
  });

  defineAgent({
    id: SPECIALIST_PERFORMANCE_ID,
    name: "Performance Specialist",
    version: "1.0.0",
    kind: "specialist_performance",
    capabilities: ["explain", "retrieve_context", "call_tools", "run_skills", "evaluate"],
    allowed_skill_ids: [...PERFORMANCE_SKILLS],
    allowed_tool_ids: [...PERFORMANCE_TOOLS],
    description:
      "Overall state, trends, drivers, risks — does not mutate Living Plan; proposals only via engine",
  });

  defineAgent({
    id: SPECIALIST_TRAINING_ID,
    name: "Training Specialist",
    version: "1.0.0",
    kind: "specialist_training",
    capabilities: ["propose", "call_tools", "run_skills", "retrieve_context"],
    allowed_skill_ids: [...TRAINING_SKILLS, "generate_daily_context", "explain_decision"],
    allowed_tool_ids: [...TRAINING_TOOLS, "get_user_profile"],
  });

  defineAgent({
    id: SPECIALIST_NUTRITION_ID,
    name: "Nutrition Specialist",
    version: "1.0.0",
    kind: "specialist_nutrition",
    capabilities: ["propose", "call_tools", "run_skills"],
    allowed_skill_ids: [...NUTRITION_SKILLS, "analyze_adherence"],
    allowed_tool_ids: [...NUTRITION_TOOLS, "get_user_profile"],
  });

  defineAgent({
    id: SPECIALIST_RECOVERY_ID,
    name: "Recovery Specialist",
    version: "1.0.0",
    kind: "specialist_recovery",
    capabilities: ["propose", "call_tools", "run_skills", "retrieve_context"],
    allowed_skill_ids: [...RECOVERY_SKILLS, "adjust_training_load", "generate_daily_context"],
    allowed_tool_ids: [...RECOVERY_TOOLS, "get_current_plan", "get_user_profile"],
  });

  defineAgent({
    id: SPECIALIST_BEHAVIOR_ID,
    name: "Behavior Specialist",
    version: "1.0.0",
    kind: "specialist_behavior",
    capabilities: ["propose", "call_tools", "run_skills"],
    allowed_skill_ids: [...BEHAVIOR_SKILLS],
    allowed_tool_ids: [...BEHAVIOR_TOOLS],
  });
}

export { TRAINING_SKILLS, NUTRITION_SKILLS, RECOVERY_SKILLS, BEHAVIOR_SKILLS, PERFORMANCE_SKILLS };
