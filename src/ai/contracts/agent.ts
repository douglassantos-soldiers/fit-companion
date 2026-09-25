/**
 * Agent contract — future Agent Runtime / Specialist Agents.
 * Agents never access the database directly; they use Tools/MCP only.
 * LLM output is never the final authority over critical product state.
 */

export type AgentKind =
  | "coach"
  | "specialist_performance"
  | "specialist_training"
  | "specialist_nutrition"
  | "specialist_recovery"
  | "specialist_behavior"
  | "orchestrator"
  | "generic";

export type AgentCapability =
  "explain" | "propose" | "retrieve_context" | "call_tools" | "run_skills" | "evaluate";

export type Agent = {
  id: string;
  name: string;
  version: string;
  kind: AgentKind;
  capabilities: AgentCapability[];
  /** Tools this agent may invoke (allowlist ids). */
  allowed_tool_ids: string[];
  /** Skills this agent may run (allowlist ids). */
  allowed_skill_ids: string[];
  description?: string;
};
