/**
 * AgentExecutionPlan — Orchestrator output only (not Decision authority).
 * Runtime (future) may execute the plan; Decision Engine alone decides.
 */

import type { KnowledgeDomain } from "./knowledge-document";

export type AgentExecutionPlanStatus = "ready" | "rejected" | "insufficient_context";

export type PlanSequenceStepKind = "agent" | "skill" | "tool" | "knowledge" | "handoff";

export type PlanSequenceStep = {
  step_id: string;
  kind: PlanSequenceStepKind;
  /** Agent id, skill id, tool id, knowledge domain, or engine name */
  ref: string;
  agent_id?: string;
};

export type AgentExecutionPlan = {
  plan_id: string;
  created_at: string;
  user_id: string;
  intent: string;
  status: AgentExecutionPlanStatus;
  agents: string[];
  skills: string[];
  tools: string[];
  knowledgeDomains: KnowledgeDomain[];
  sequence: PlanSequenceStep[];
  maxSteps: number;
  /** Total budget in milliseconds */
  timeout: number;
  /** Abstract cost units */
  estimatedCost: number;
  rejection_reason?: string;
  warnings?: string[];
  loop_fingerprint?: string;
};
