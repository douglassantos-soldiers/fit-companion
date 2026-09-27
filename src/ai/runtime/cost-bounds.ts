/**
 * Cost bound helpers for certification (orchestrator + gateway).
 */
import { DEFAULT_MAX_COST, DEFAULT_MAX_STEPS, DEFAULT_TIMEOUT_MS } from "@/ai/orchestrator/core/types";
import { getAgentAIConfig } from "@/ai/gateway/config";

export type CostBoundsCheck = {
  ok: boolean;
  notes: string[];
  orchestrator: { max_cost: number; max_steps: number; timeout_ms: number };
  gateway: { max_tokens: number; max_cost: number; timeout_ms: number };
};

export function assertCostBounds(agentId = "specialist_training"): CostBoundsCheck {
  const notes: string[] = [];
  const orch = {
    max_cost: DEFAULT_MAX_COST,
    max_steps: DEFAULT_MAX_STEPS,
    timeout_ms: DEFAULT_TIMEOUT_MS,
  };
  const cfg = getAgentAIConfig(agentId);
  const gateway = {
    max_tokens: cfg.max_tokens,
    max_cost: cfg.max_cost,
    timeout_ms: cfg.timeout_ms,
  };

  if (!(orch.max_cost > 0 && orch.max_steps > 0 && orch.timeout_ms > 0)) {
    notes.push("orchestrator_budget_missing");
  }
  if (!(gateway.max_tokens > 0 && gateway.max_cost > 0 && gateway.timeout_ms > 0)) {
    notes.push("gateway_budget_missing");
  }
  // Unbounded would be Infinity / 0 — reject
  if (!Number.isFinite(orch.max_cost) || !Number.isFinite(gateway.max_cost)) {
    notes.push("non_finite_cost");
  }

  return { ok: notes.length === 0, notes, orchestrator: orch, gateway };
}
