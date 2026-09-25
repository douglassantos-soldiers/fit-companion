/**
 * Register all Skills Framework skills.
 */
import { registerBehaviorSkills } from "@/ai/skills/behavior";
import { clearSkillRegistry, hasSkill } from "@/ai/skills/core/registry";
import { registerNutritionSkills } from "@/ai/skills/nutrition";
import { registerPerformanceSkills } from "@/ai/skills/performance";
import { registerRecoverySkills } from "@/ai/skills/recovery";
import { registerTrainingSkills } from "@/ai/skills/training";

let bootstrapped = false;

export function registerAllSkills(opts?: { force?: boolean }): void {
  if (bootstrapped && !opts?.force && hasSkill("analyze_training")) return;
  if (opts?.force) {
    clearSkillRegistry();
    bootstrapped = false;
  }
  registerTrainingSkills();
  registerNutritionSkills();
  registerRecoverySkills();
  registerBehaviorSkills();
  registerPerformanceSkills();
  bootstrapped = true;
}
