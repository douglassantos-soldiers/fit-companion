/**
 * createExecutionPlan — Orchestrator plan-only API.
 * Never calls Decision Engine / runSkill / invokeTool.
 */

import type { AgentExecutionPlan, PlanSequenceStep } from "@/ai/contracts/agent-execution-plan";
import { asTrustedUserId } from "@/ai/contracts/trusted-user-id";
import { registerDefaultAgents, getAgent, hasAgent } from "@/ai/orchestrator/agents/registry";
import {
  filterKnowledgeDomains,
  resolveSkillsForAgents,
  resolveToolsForAgents,
} from "@/ai/orchestrator/catalog/resolve";
import { ORCH_ERROR, OrchError } from "@/ai/orchestrator/core/errors";
import { newPlanId, planFingerprint } from "@/ai/orchestrator/core/fingerprint";
import {
  assertAgentsRegistered,
  assertCostLimit,
  assertMaxSteps,
  assertNoLoop,
  assertTimeoutBudget,
  estimateCost,
} from "@/ai/orchestrator/core/gates";
import {
  DEFAULT_MAX_COST,
  DEFAULT_MAX_STEPS,
  DEFAULT_TIMEOUT_MS,
  type CreateExecutionPlanInput,
  type CreateExecutionPlanResult,
} from "@/ai/orchestrator/core/types";
import { classifyIntent } from "@/ai/orchestrator/intent/classify";

function rejectedPlan(
  base: Omit<AgentExecutionPlan, "status" | "rejection_reason"> & {
    rejection_reason: string;
  },
): CreateExecutionPlanResult {
  return {
    ok: false,
    plan: {
      ...base,
      status: "rejected",
      agents: base.agents,
      skills: base.skills,
      tools: base.tools,
      knowledgeDomains: base.knowledgeDomains,
      sequence: [],
      estimatedCost: 0,
    },
  };
}

function buildSequence(opts: {
  agents: string[];
  skills: string[];
  tools: string[];
  knowledgeDomains: string[];
  needsDecisionHandoff: boolean;
  insufficientContext: boolean;
}): PlanSequenceStep[] {
  const steps: PlanSequenceStep[] = [];
  let n = 0;
  const sid = () => `s${++n}`;

  for (const a of opts.agents) {
    steps.push({ step_id: sid(), kind: "agent", ref: a, agent_id: a });
  }
  // Cap knowledge + tools in sequence (full lists remain on plan fields)
  for (const d of opts.knowledgeDomains.slice(0, 3)) {
    const step: PlanSequenceStep = {
      step_id: sid(),
      kind: "knowledge",
      ref: d,
    };
    if (opts.agents[0]) step.agent_id = opts.agents[0];
    steps.push(step);
  }
  for (const t of opts.tools.slice(0, 4)) {
    const owner = opts.agents.find((a) => getAgent(a)?.allowed_tool_ids.includes(t));
    const step: PlanSequenceStep = {
      step_id: sid(),
      kind: "tool",
      ref: t,
    };
    if (owner) step.agent_id = owner;
    steps.push(step);
  }
  for (const s of opts.skills.slice(0, 6)) {
    const owner = opts.agents.find((a) => getAgent(a)?.allowed_skill_ids.includes(s));
    const step: PlanSequenceStep = {
      step_id: sid(),
      kind: "skill",
      ref: s,
    };
    if (owner) step.agent_id = owner;
    steps.push(step);
  }

  if (opts.insufficientContext) {
    return steps;
  }

  if (opts.needsDecisionHandoff) {
    steps.push({ step_id: sid(), kind: "handoff", ref: "context_engine" });
    steps.push({ step_id: sid(), kind: "handoff", ref: "safety_engine" });
    steps.push({ step_id: sid(), kind: "handoff", ref: "decision_engine" });
  }

  return steps;
}

export function createExecutionPlan(input: CreateExecutionPlanInput): CreateExecutionPlanResult {
  registerDefaultAgents();

  const created_at = new Date().toISOString();
  const plan_id = newPlanId();
  const intent = (input.intent ?? "").trim();
  const maxSteps = input.overrides?.maxSteps ?? DEFAULT_MAX_STEPS;
  const timeout = input.overrides?.timeout ?? DEFAULT_TIMEOUT_MS;
  const maxCost = input.overrides?.maxCost ?? DEFAULT_MAX_COST;

  const emptyBase = {
    plan_id,
    created_at,
    user_id: "",
    intent,
    agents: [] as string[],
    skills: [] as string[],
    tools: [] as string[],
    knowledgeDomains: [] as AgentExecutionPlan["knowledgeDomains"],
    sequence: [] as PlanSequenceStep[],
    maxSteps,
    timeout,
    estimatedCost: 0,
  };

  const rawUser = input.trustedUserId?.trim() ?? "";
  if (!rawUser) {
    return rejectedPlan({
      ...emptyBase,
      rejection_reason: ORCH_ERROR.ANONYMOUS_DENIED,
    });
  }

  let userId: string;
  try {
    userId = asTrustedUserId(rawUser);
  } catch {
    return rejectedPlan({
      ...emptyBase,
      rejection_reason: ORCH_ERROR.INVALID_TRUSTED_USER,
    });
  }

  if (!intent) {
    return rejectedPlan({
      ...emptyBase,
      user_id: userId,
      rejection_reason: ORCH_ERROR.EMPTY_INTENT,
    });
  }

  try {
    assertTimeoutBudget(timeout);
  } catch (e) {
    const code = e instanceof OrchError ? e.code : ORCH_ERROR.TIMEOUT_BUDGET;
    return rejectedPlan({
      ...emptyBase,
      user_id: userId,
      rejection_reason: code,
    });
  }

  const classified = classifyIntent(intent);
  let agents = input.overrides?.forceAgents?.length
    ? [...input.overrides.forceAgents]
    : [...classified.agents];

  // Validate forced / classified agents
  try {
    assertAgentsRegistered(agents);
  } catch (e) {
    const msg = e instanceof OrchError ? e.message : String(e);
    return rejectedPlan({
      ...emptyBase,
      user_id: userId,
      agents,
      rejection_reason: `${ORCH_ERROR.INVALID_AGENT}:${msg}`,
    });
  }

  const skillHints = input.overrides?.forceSkills?.length
    ? input.overrides.forceSkills
    : classified.skillHints;
  const toolHints = input.overrides?.forceTools?.length
    ? input.overrides.forceTools
    : classified.toolHints;

  // Explicit invalid force checks (reject even before intersect strip)
  if (input.overrides?.forceAgents) {
    for (const a of input.overrides.forceAgents) {
      if (!hasAgent(a)) {
        return rejectedPlan({
          ...emptyBase,
          user_id: userId,
          agents: input.overrides.forceAgents,
          rejection_reason: `${ORCH_ERROR.INVALID_AGENT}:${a}`,
        });
      }
    }
  }
  if (input.overrides?.forceTools?.length) {
    const { rejected } = resolveToolsForAgents(agents, input.overrides.forceTools);
    if (rejected.length) {
      return rejectedPlan({
        ...emptyBase,
        user_id: userId,
        agents,
        tools: input.overrides.forceTools,
        rejection_reason: `${ORCH_ERROR.INVALID_TOOL}:${rejected.join(",")}`,
      });
    }
  }
  if (input.overrides?.forceSkills?.length) {
    const { rejected } = resolveSkillsForAgents(agents, input.overrides.forceSkills);
    if (rejected.length) {
      return rejectedPlan({
        ...emptyBase,
        user_id: userId,
        agents,
        skills: input.overrides.forceSkills,
        rejection_reason: `${ORCH_ERROR.INVALID_SKILL}:${rejected.join(",")}`,
      });
    }
  }

  const contextAvailable = input.contextAvailable !== false;
  const insufficientContext = !contextAvailable;

  let skills: string[];
  let tools: string[];
  let knowledgeDomains = filterKnowledgeDomains(classified.knowledgeDomains);
  const warnings: string[] = [];

  if (insufficientContext) {
    // Fallback: gather context only — no Decision handoff
    agents = agents.length ? agents : ["coach"];
    const fbSkills = resolveSkillsForAgents(agents, [
      "generate_daily_context",
      ...skillHints.filter((s) => s === "analyze_recovery" || s === "analyze_fatigue"),
    ]);
    const fbTools = resolveToolsForAgents(agents, [
      "get_user_profile",
      "get_recovery",
      "get_current_plan",
      "get_recent_decisions",
    ]);
    skills = fbSkills.skills.length
      ? fbSkills.skills
      : ["generate_daily_context"].filter((s) =>
          agents.some((a) => getAgent(a)?.allowed_skill_ids.includes(s)),
        );
    // coach always has generate_daily_context — ensure coach present for fallback
    if (!skills.includes("generate_daily_context")) {
      if (!agents.includes("coach") && hasAgent("coach")) {
        agents = ["coach", ...agents];
      }
      const again = resolveSkillsForAgents(agents, ["generate_daily_context"]);
      skills = [...new Set([...skills, ...again.skills])];
    }
    tools = fbTools.tools;
    knowledgeDomains = filterKnowledgeDomains(["coaching", ...knowledgeDomains]);
    warnings.push("insufficient_context_fallback");
  } else {
    const sk = resolveSkillsForAgents(agents, skillHints);
    const tl = resolveToolsForAgents(agents, toolHints);
    skills = sk.skills;
    tools = tl.tools;
    if (sk.rejected.length) warnings.push(`skills_stripped:${sk.rejected.join(",")}`);
    if (tl.rejected.length) warnings.push(`tools_stripped:${tl.rejected.join(",")}`);
  }

  const sequence = buildSequence({
    agents,
    skills,
    tools,
    knowledgeDomains,
    needsDecisionHandoff: classified.needsDecisionHandoff && !insufficientContext,
    insufficientContext,
  });

  const estimatedCost = estimateCost(sequence);
  const fingerprint = planFingerprint({ intent, agents, skills, tools });

  try {
    assertNoLoop(fingerprint, input.parentPlanFingerprint);
    assertCostLimit(estimatedCost, maxCost);
    assertMaxSteps(sequence.length, maxSteps);
  } catch (e) {
    const code = e instanceof OrchError ? e.code : ORCH_ERROR.MAX_STEPS;
    return rejectedPlan({
      ...emptyBase,
      user_id: userId,
      agents,
      skills,
      tools,
      knowledgeDomains,
      rejection_reason: code,
      ...(warnings.length ? { warnings } : {}),
    });
  }

  const plan: AgentExecutionPlan = {
    plan_id,
    created_at,
    user_id: userId,
    intent,
    status: insufficientContext ? "insufficient_context" : "ready",
    agents,
    skills,
    tools,
    knowledgeDomains,
    sequence,
    maxSteps,
    timeout,
    estimatedCost,
    loop_fingerprint: fingerprint,
  };
  if (warnings.length) plan.warnings = warnings;

  return { ok: true, plan };
}
