/**
 * runSpecialistAgent — thin single-agent runtime.
 * Uses Context (via tools/skills), MCP, Skills, RAG, Memory.
 * Emits Analysis + Evidence + Confidence + Proposal — NEVER final Decision.
 * Decision Engine remains the only authority (not invoked here).
 */

import type { AgentAnalysisResult } from "@/ai/contracts/agent-analysis";
import type { AgentExecutionPlan } from "@/ai/contracts/agent-execution-plan";
import type { AgentRun } from "@/ai/contracts/agent-run";
import type { KnowledgeCitation } from "@/ai/contracts/knowledge-citation";
import type { KnowledgeDomain } from "@/ai/contracts/knowledge-document";
import type { SkillEvidenceItem } from "@/ai/contracts/skill-result";
import { asTrustedUserId } from "@/ai/contracts/trusted-user-id";
import { getAgent, registerDefaultAgents } from "@/ai/orchestrator/agents/registry";
import { retrieveMemory } from "@/ai/memory/api";
import { retrieveKnowledge } from "@/ai/rag/retrieval";
import { runSkill } from "@/ai/skills/core/run";
import type { SkillCallTool } from "@/ai/skills/core/types";
import { registerAllSkills } from "@/ai/skills/register";
import { registerAllMcpTools } from "@/ai/mcp/register";
import { invokeTool } from "@/ai/mcp/core/invoke";
import type { DomainContextLoader } from "@/ai/mcp/core/types";
import { aggregateSpecialistOutputs, type SkillPartial } from "@/ai/agents/runtime/aggregate";
import { recordAgentRun } from "@/ai/agents/runtime/agent-run-log";
import { AGENT_ERROR, AgentError } from "@/ai/agents/runtime/errors";
import { invokeAI, getAiRuntimeMode, type AiRuntimeMode } from "@/ai/gateway";
import type { AIProviderId } from "@/ai/providers/types";
import { isSpecialistsEnabled } from "@/ai/runtime/feature-flags";
import { resolveEffectiveRuntimeMode } from "@/ai/runtime/rollback";

export type RunSpecialistAgentInput = {
  trustedUserId: string | null;
  agentId: string;
  plan: AgentExecutionPlan;
  intent?: string;
  /** Test DI */
  callTool?: SkillCallTool;
  loader?: DomainContextLoader;
  /** Skip RAG store miss noise in tests without corpus */
  skipKnowledge?: boolean;
  /** Coach / parent correlation */
  parentRunId?: string;
  /** Override AI_RUNTIME_MODE (tests) */
  runtimeMode?: AiRuntimeMode;
  /** Force gateway provider (tests) */
  aiProvider?: AIProviderId;
  aiFallbackProvider?: AIProviderId;
};

export type RunSpecialistAgentResult = {
  ok: boolean;
  result: AgentAnalysisResult;
  agent_run: AgentRun;
};

function newRunId(): string {
  return `ar_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function runSpecialistAgent(
  input: RunSpecialistAgentInput,
): Promise<RunSpecialistAgentResult> {
  registerDefaultAgents();
  registerAllSkills();
  registerAllMcpTools();

  const created_at = new Date().toISOString();
  const run_id = newRunId();
  const started = Date.now();
  const agentId = input.agentId;

  if (!isSpecialistsEnabled()) {
    const agent_run: AgentRun = {
      run_id,
      agent_id: agentId,
      user_id: input.trustedUserId ?? "",
      status: "cancelled",
      created_at,
      completed_at: new Date().toISOString(),
      metadata: { error_code: "specialists_disabled", model: "deterministic_runtime" },
      ...(input.parentRunId ? { parent_run_id: input.parentRunId } : {}),
    };
    recordAgentRun(agent_run);
    return {
      ok: false,
      result: {
        agent_id: agentId,
        run_id,
        user_id: input.trustedUserId ?? "",
        analysis: { reason: "specialists_disabled" },
        evidence: [],
        confidence: 0,
        proposal: null,
        warnings: ["specialists_disabled"],
        status: "failed",
      },
      agent_run,
    };
  }

  const { checkAiRateLimits } = await import("@/ai/runtime/rate-limit");
  const rl = await checkAiRateLimits({
    ...(input.trustedUserId ? { userId: input.trustedUserId } : {}),
    agentId,
    runId: run_id,
  });
  if (!rl.ok) {
    const agent_run: AgentRun = {
      run_id,
      agent_id: agentId,
      user_id: input.trustedUserId ?? "",
      status: "failed",
      created_at,
      completed_at: new Date().toISOString(),
      metadata: {
        error_code: "rate_limited",
        model: "deterministic_runtime",
        scope: rl.scope,
        window: rl.window,
      },
      ...(input.parentRunId ? { parent_run_id: input.parentRunId } : {}),
    };
    recordAgentRun(agent_run);
    return {
      ok: false,
      result: {
        agent_id: agentId,
        run_id,
        user_id: input.trustedUserId ?? "",
        analysis: { reason: "rate_limited" },
        evidence: [],
        confidence: 0,
        proposal: null,
        warnings: [`rate_limited:${rl.scope}:${rl.window}`],
        status: "failed",
      },
      agent_run,
    };
  }

  const baseRun = (): AgentRun => ({
    run_id,
    agent_id: agentId,
    user_id: input.trustedUserId ?? "",
    status: "queued",
    created_at,
    ...(input.parentRunId ? { parent_run_id: input.parentRunId } : {}),
  });

  const finish = (
    partial: Omit<RunSpecialistAgentResult, "agent_run"> & {
      agent_run?: Partial<AgentRun>;
    },
  ): RunSpecialistAgentResult => {
    const latency_ms = Date.now() - started;
    const agent = getAgent(agentId);
    const runtime_mode = resolveEffectiveRuntimeMode(input.runtimeMode ?? getAiRuntimeMode());
    const meta: Record<string, string | number | boolean | null> = {
      agent_version: agent?.version ?? "1.0.0",
      model: "deterministic_runtime",
      estimated_cost: partial.result.skill_run_ids?.length
        ? partial.result.skill_run_ids.length
        : 1,
      latency_ms,
      runtime_mode,
      execution_mode: runtime_mode,
      provider: "none",
      status:
        partial.result.status === "completed"
          ? "ok"
          : partial.result.status === "blocked"
            ? "error"
            : "error",
      deterministic_runtime: runtime_mode === "deterministic",
    };
    const existingMeta = partial.agent_run?.metadata;
    if (existingMeta) {
      for (const [k, v] of Object.entries(existingMeta)) meta[k] = v;
    }
    const run: AgentRun = {
      ...baseRun(),
      ...partial.agent_run,
      status:
        partial.result.status === "completed"
          ? "completed"
          : partial.result.status === "blocked"
            ? "blocked_by_safety"
            : "failed",
      started_at: created_at,
      finished_at: new Date().toISOString(),
      metadata: meta,
    };
    if (partial.result.skill_run_ids) run.skill_run_ids = partial.result.skill_run_ids;
    if (partial.result.tool_call_ids) run.tool_call_ids = partial.result.tool_call_ids;
    recordAgentRun(run);
    return { ok: partial.ok, result: partial.result, agent_run: run };
  };

  const fail = (
    status: AgentAnalysisResult["status"],
    code: string,
    message: string,
  ): RunSpecialistAgentResult =>
    finish({
      ok: false,
      result: {
        agent_id: agentId,
        run_id,
        user_id: input.trustedUserId ?? "",
        analysis: null,
        evidence: [],
        confidence: 0,
        warnings: [message],
        status,
      },
      agent_run: { error_code: code, error_message: message, user_id: input.trustedUserId ?? "" },
    });

  const rawUser = input.trustedUserId?.trim() ?? "";
  if (!rawUser) {
    return fail("blocked", AGENT_ERROR.ANONYMOUS_DENIED, "authentication_required");
  }

  let userId;
  try {
    userId = asTrustedUserId(rawUser);
  } catch {
    return fail("blocked", AGENT_ERROR.INVALID_TRUSTED_USER, "invalid_trusted_user_id");
  }

  if (!input.plan) {
    return fail("failed", AGENT_ERROR.PLAN_REQUIRED, "plan_required");
  }

  const agent = getAgent(agentId);
  if (!agent) {
    return fail("failed", AGENT_ERROR.UNKNOWN_AGENT, `unknown_agent:${agentId}`);
  }

  const intent = (input.intent ?? input.plan.intent ?? "").trim();
  const timeout = input.plan.timeout > 0 ? input.plan.timeout : 30_000;
  const deadline = started + timeout;

  const allowedSkills = new Set(agent.allowed_skill_ids);
  const allowedTools = new Set(agent.allowed_tool_ids);

  // Steps owned by this agent, or plan-level skills/tools in allowlist
  const skillIds = [
    ...input.plan.skills.filter((s) => allowedSkills.has(s)),
    ...input.plan.sequence
      .filter((s) => s.kind === "skill" && allowedSkills.has(s.ref))
      .filter((s) => !s.agent_id || s.agent_id === agentId)
      .map((s) => s.ref),
  ];
  const uniqueSkills = [...new Set(skillIds)];

  const toolIds = [
    ...input.plan.tools.filter((t) => allowedTools.has(t)),
    ...input.plan.sequence
      .filter((s) => s.kind === "tool" && allowedTools.has(s.ref))
      .filter((s) => !s.agent_id || s.agent_id === agentId)
      .map((s) => s.ref),
  ];
  const uniqueTools = [...new Set(toolIds)];

  const domains = input.plan.knowledgeDomains.filter((d) =>
    input.plan.sequence.some(
      (s) => s.kind === "knowledge" && s.ref === d && (!s.agent_id || s.agent_id === agentId),
    ),
  );
  const knowledgeDomains: KnowledgeDomain[] =
    domains.length > 0 ? domains : input.plan.knowledgeDomains.slice(0, 3);

  const skillPartials: SkillPartial[] = [];
  const toolSummaries: Array<{ toolId: string; ok: boolean; tool_call_id?: string }> = [];
  const citations: KnowledgeCitation[] = [];
  const memoryIds: string[] = [];
  const memoryEvidence: SkillEvidenceItem[] = [];
  const warnings: string[] = [];

  try {
    // Memory (read-only)
    try {
      const mem = await retrieveMemory({
        trustedUserId: userId,
        family: "user",
        minConfidence: 0.3,
        limit: 10,
      });
      for (const r of mem.records) {
        memoryIds.push(r.memory_id);
        memoryEvidence.push({
          signal: `memory:${r.type}`,
          value: r.key ?? r.type,
          source: "memory",
        });
      }
    } catch (e) {
      const code =
        e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
      warnings.push(code === "MEMORY_UNAVAILABLE" ? "MEMORY_UNAVAILABLE" : "memory_unavailable");
    }

    if (Date.now() > deadline) {
      throw new AgentError(AGENT_ERROR.TIMEOUT, "timeout_before_work");
    }

    // RAG — never invent citations on failure
    const retrievalIds: string[] = [];
    let rag_status: AgentAnalysisResult["rag_status"] = "skipped";
    let rag_availability: AgentAnalysisResult["rag_availability"] = undefined;
    let evidence_available = false;
    if (!input.skipKnowledge && knowledgeDomains.length > 0 && intent) {
      try {
        const { citations: cites, retrieval } = await retrieveKnowledge({
          query: intent,
          domains: knowledgeDomains,
          topK: 3,
          mode: "hybrid",
          timeoutMs: 5_000,
          audit: {
            userId: userId,
            runId: run_id,
            agentId: agentId,
          },
        });
        rag_status = retrieval.rag_status ?? (cites.length > 0 ? "ok" : "empty");
        rag_availability = retrieval.rag_availability;
        evidence_available = Boolean(retrieval.evidence_available);
        if (cites.length > 0 && rag_availability === "RAG_AVAILABLE") {
          citations.push(...cites);
        } else if (cites.length > 0 && rag_availability === "RAG_DEGRADED") {
          // Low confidence — keep citations but warn; do not treat as solid knowledge
          citations.push(...cites);
          warnings.push(`rag_${rag_availability}`);
          warnings.push(`rag_${rag_status}`);
        } else {
          warnings.push(`rag_${rag_availability ?? rag_status}`);
        }
        if (retrieval?.retrieval_id) retrievalIds.push(retrieval.retrieval_id);
      } catch {
        rag_status = "error";
        rag_availability = "RAG_UNAVAILABLE";
        evidence_available = false;
        warnings.push("rag_error");
        warnings.push("RAG_UNAVAILABLE");
      }
    } else if (input.skipKnowledge) {
      rag_status = "skipped";
      rag_availability = "RAG_UNAVAILABLE";
    }

    // Tools (MCP) — optional direct; skills also call tools
    const callTool: SkillCallTool =
      input.callTool ??
      (async (toolId, toolInput = {}) => {
        if (!allowedTools.has(toolId)) {
          return { ok: false, error_code: "tool_not_allowed" };
        }
        const res = await invokeTool({
          toolId,
          trustedUserId: userId,
          input: toolInput,
          agentId,
          runId: run_id,
          ...(input.loader ? { loader: input.loader } : {}),
        });
        toolSummaries.push({
          toolId,
          ok: res.ok,
          ...(res.tool_call?.tool_call_id ? { tool_call_id: res.tool_call.tool_call_id } : {}),
        });
        if (!res.ok) return { ok: false, error_code: res.error_code ?? "tool_failed" };
        return { ok: true, data: res.data };
      });

    for (const toolId of uniqueTools.slice(0, 4)) {
      if (Date.now() > deadline) break;
      if (input.callTool) {
        const res = await input.callTool(toolId, {});
        toolSummaries.push({ toolId, ok: res.ok });
      } else {
        await callTool(toolId, {});
      }
    }

    // Skills
    for (const skillId of uniqueSkills.slice(0, 6)) {
      if (Date.now() > deadline) {
        warnings.push("timeout_partial");
        break;
      }
      const skillRes = await runSkill({
        skillId,
        trustedUserId: userId,
        agentId,
        runId: run_id,
        callTool,
        ...(input.loader ? { loader: input.loader } : {}),
        input: skillId === "substitute_exercise" ? { sessionId: "s1" } : {},
      });
      if (!skillRes.ok || !skillRes.data) {
        warnings.push(`skill_failed:${skillId}:${skillRes.error_code ?? "unknown"}`);
        continue;
      }
      const partial: SkillPartial = {
        skillId,
        result: skillRes.data.result,
        evidence: skillRes.data.evidence,
        confidence: skillRes.data.confidence,
        warnings: skillRes.data.warnings,
        skill_run_id: skillRes.skill_run.skill_run_id,
      };
      if (skillRes.data.proposal) partial.proposal = skillRes.data.proposal;
      skillPartials.push(partial);
    }

    const agg = aggregateSpecialistOutputs({
      agentId,
      skillPartials,
      toolSummaries,
      citations,
      memoryIds,
      memoryEvidence,
    });
    warnings.push(...agg.warnings);

    const runtime_mode = resolveEffectiveRuntimeMode(input.runtimeMode ?? getAiRuntimeMode());
    let analysis: unknown = agg.analysis;
    let evidence = agg.evidence;
    let confidence = agg.confidence;
    let proposal = agg.proposal;
    const gatewayMeta: Record<string, string | number | boolean | null> = {
      runtime_mode,
      execution_mode: runtime_mode,
      provider: "none",
      model: "deterministic_runtime",
      status: "ok",
      deterministic_runtime: runtime_mode === "deterministic",
    };

    // FASE 17 — AI Gateway for specialist_training (hybrid | llm only)
    const useGateway =
      agentId === "specialist_training" &&
      (runtime_mode === "hybrid" || runtime_mode === "llm");

    if (useGateway) {
      const contextPayload = JSON.stringify({
        intent,
        skills: skillPartials.map((p) => ({
          skillId: p.skillId,
          result: p.result,
          confidence: p.confidence,
          proposal: p.proposal
            ? {
                proposed_type: p.proposal.proposed_type,
                proposed_value: p.proposal.proposed_value,
                reason_codes: p.proposal.reason_codes,
              }
            : null,
        })),
        citations: citations.slice(0, 5).map((c) => ({
          title: c.title,
          excerpt: c.excerpt,
          score: c.score,
        })),
        memory_ids: memoryIds.slice(0, 8),
        deterministic_analysis: agg.analysis,
      });

      const ai = await invokeAI({
        agentId,
        userId: userId,
        runId: run_id,
        userContent: contextPayload,
        runtimeMode: runtime_mode,
        ...(input.aiProvider ? { provider: input.aiProvider } : {}),
        ...(input.aiFallbackProvider
          ? { fallbackProvider: input.aiFallbackProvider }
          : {}),
      });

      if (ai.ok) {
        gatewayMeta["provider"] = ai.provider;
        gatewayMeta["model"] = ai.model;
        gatewayMeta["execution_mode"] = ai.execution_mode;
        gatewayMeta["status"] = ai.status;
        gatewayMeta["prompt_version"] = ai.prompt_version;
        gatewayMeta["input_tokens"] = ai.usage.input_tokens;
        gatewayMeta["output_tokens"] = ai.usage.output_tokens;
        gatewayMeta["token_usage"] = JSON.stringify({
          input: ai.usage.input_tokens,
          output: ai.usage.output_tokens,
        });
        if (ai.usage.estimated_cost != null) {
          gatewayMeta["estimated_cost"] = ai.usage.estimated_cost;
        }
        gatewayMeta["fallback_used"] = ai.fallback_used;

        if (ai.structured) {
          if (runtime_mode === "llm") {
            analysis = ai.structured.analysis;
            evidence = [...ai.structured.evidence, ...memoryEvidence];
            confidence = ai.structured.confidence;
            if (ai.decision_proposal) proposal = ai.decision_proposal;
            else proposal = null;
          } else {
            // hybrid: enrich analysis/evidence; candidate proposal only if validated
            analysis = {
              deterministic: agg.analysis,
              llm: ai.structured.analysis,
            };
            evidence = [
              ...agg.evidence,
              ...ai.structured.evidence,
              {
                signal: "llm_enrichment",
                value: ai.model,
                source: "ai_gateway",
              },
            ];
            confidence = Math.min(
              1,
              Math.max(agg.confidence, ai.structured.confidence) * 0.95 +
                Math.min(agg.confidence, ai.structured.confidence) * 0.05,
            );
            if (ai.decision_proposal) {
              proposal = ai.decision_proposal;
            }
          }
        }
      } else {
        gatewayMeta["gateway_error"] = ai.error.code;
        gatewayMeta["execution_mode"] = ai.execution_mode;
        gatewayMeta["status"] = runtime_mode === "hybrid" ? "degraded" : ai.status;
        if (ai.provider) gatewayMeta["provider"] = ai.provider;
        if (ai.model) gatewayMeta["model"] = ai.model;
        if (runtime_mode === "llm") {
          // llm-only: fail observable — do not invent proposal
          warnings.push(`llm_failed:${ai.error.code}`);
          return finish({
            ok: false,
            result: {
              agent_id: agentId,
              run_id,
              user_id: userId,
              analysis: null,
              evidence: [],
              confidence: 0,
              warnings: [...warnings, ai.error.message],
              status: "failed",
              rag_status,
              retrieval_status: rag_status,
              ...(rag_availability ? { rag_availability } : {}),
              evidence_available,
            },
            agent_run: {
              user_id: userId,
              error_code: ai.error.code,
              error_message: ai.error.message.slice(0, 200),
              metadata: gatewayMeta,
            },
          });
        }
        // hybrid: degrade to deterministic aggregation
        warnings.push(`gateway_degraded:${ai.error.code}`);
        gatewayMeta["provider"] = "none";
        gatewayMeta["model"] = "deterministic_runtime";
      }
    }

    const result: AgentAnalysisResult = {
      agent_id: agentId,
      run_id,
      user_id: userId,
      analysis,
      evidence,
      confidence,
      warnings,
      status: "completed",
      rag_status,
      retrieval_status: rag_status,
      evidence_available,
    };
    if (rag_availability) result.rag_availability = rag_availability;
    if (proposal) result.proposal = proposal;
    if (citations.length) result.citations = citations;
    if (memoryIds.length) result.memory_ids = memoryIds;
    if (agg.skill_run_ids.length) result.skill_run_ids = agg.skill_run_ids;
    if (agg.tool_call_ids.length) result.tool_call_ids = agg.tool_call_ids;

    return finish({
      ok: true,
      result,
      agent_run: {
        user_id: userId,
        ...(input.plan.plan_id ? { context_fingerprint: input.plan.plan_id } : {}),
        metadata: {
          ...(retrievalIds.length ? { retrieval_ids: retrievalIds.join(",") } : {}),
          ...gatewayMeta,
        },
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = e instanceof AgentError ? e.code : AGENT_ERROR.AGENT_FAILED;
    return fail("failed", code, msg.slice(0, 200));
  }
}
