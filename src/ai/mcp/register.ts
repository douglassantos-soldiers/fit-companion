/**
 * Register all MCP Tool Layer tools (idempotent via clear+register in tests).
 */
import { registerCommerceTools } from "@/ai/mcp/commerce";
import { registerDecisionTools } from "@/ai/mcp/decision";
import { registerNutritionTools } from "@/ai/mcp/nutrition";
import { registerRecoveryTools } from "@/ai/mcp/recovery";
import { registerSocialTools } from "@/ai/mcp/social";
import { registerTrainingTools } from "@/ai/mcp/training";
import { registerUserTools } from "@/ai/mcp/user";
import { registerWearableTools } from "@/ai/mcp/wearable";
import { registerWriteTools } from "@/ai/mcp/write";
import { clearToolRegistry, hasTool } from "@/ai/mcp/core/registry";

let bootstrapped = false;

export function registerAllMcpTools(opts?: { force?: boolean }): void {
  if (bootstrapped && !opts?.force && hasTool("get_user_profile")) return;
  if (opts?.force) {
    clearToolRegistry();
    bootstrapped = false;
  }
  registerUserTools();
  registerTrainingTools();
  registerNutritionTools();
  registerRecoveryTools();
  registerWearableTools();
  registerCommerceTools();
  registerDecisionTools();
  registerSocialTools();
  registerWriteTools();
  bootstrapped = true;
}
