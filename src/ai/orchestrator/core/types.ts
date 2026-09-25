/**
 * Orchestrator input / defaults.
 */

import type { AgentExecutionPlan } from "@/ai/contracts/agent-execution-plan";

export const DEFAULT_MAX_STEPS = 28;
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_COST = 80;

/** Cost units */
export const COST = {
  agent: 2,
  skill: 3,
  tool: 1,
  knowledge: 1,
  handoff: 0,
} as const;

export type CreateExecutionPlanInput = {
  trustedUserId: string | null;
  intent: string;
  /** When false → insufficient_context fallback */
  contextAvailable?: boolean;
  /** Prior plan fingerprint — same selection = loop reject */
  parentPlanFingerprint?: string;
  overrides?: {
    maxSteps?: number;
    timeout?: number;
    maxCost?: number;
    forceAgents?: string[];
    forceTools?: string[];
    forceSkills?: string[];
  };
};

export type CreateExecutionPlanResult = {
  ok: boolean;
  plan: AgentExecutionPlan;
};
