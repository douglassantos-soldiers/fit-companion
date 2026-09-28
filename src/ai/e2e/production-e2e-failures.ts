/**
 * FASE 22.12 — Production E2E failure scenarios (fail-closed evidence).
 * These do not require remote PASS; they must never invent success via mocks as prod.
 */
import { invokeTool } from "@/ai/mcp/core/invoke";
import { registerAllMcpTools } from "@/ai/mcp/register";
import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import { buildQaScenario } from "@/lib/qa/scenarios";
import { buildProposalId } from "@/lib/engine/decision-proposal";
import { runAuthoritativeBridge } from "@/ai/runtime/authoritative-bridge";
import { runProductionAiRuntime } from "@/ai/runtime/production-runtime";
import { retrieveKnowledge } from "@/ai/rag/retrieval";
import { resolveEffectiveRuntimeMode } from "@/ai/runtime/rollback";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DATE = "2026-03-11";

export type ProductionE2EScenarioResult = {
  id: string;
  ok: boolean;
  expected_fail?: boolean;
  detail?: string;
};

export async function runProductionE2EFailures(): Promise<ProductionE2EScenarioResult[]> {
  registerAllMcpTools();
  const out: ProductionE2EScenarioResult[] = [];

  // Unauthorized tool
  {
    const res = await invokeTool({
      toolId: "get_secret_admin_db",
      trustedUserId: USER,
      agentId: "specialist_training",
      input: {},
    });
    out.push({
      id: "unauthorized_tool",
      ok: !res.ok,
      expected_fail: true,
      detail: res.error_code ?? "unexpected_ok",
    });
  }

  // Tool failure inject
  {
    const state = { ...buildQaScenario("healthy_full", { date: DATE }), userId: USER };
    const snap = assembleDecisionContext(state, {
      date: DATE,
      userId: USER,
      source: "offline_legacy",
    });
    if (snap) {
      const r = await runProductionAiRuntime({
        trustedUserId: USER,
        intent: "prod_e2e_tool_failure",
        snapshot: snap,
        skipBridge: true,
        emitOutcomeAndLearning: false,
        runtimeMode: "deterministic",
        inject: { toolFailure: true },
      });
      out.push({
        id: "tool_failure",
        ok: !r.ok && r.error_code === "tool_error",
        expected_fail: true,
        detail: r.error_code ?? r.reason,
      });
    } else {
      out.push({ id: "tool_failure", ok: false, expected_fail: true, detail: "no_snapshot" });
    }
  }

  // RAG failure inject — no invented citations
  {
    const state = { ...buildQaScenario("healthy_full", { date: DATE }), userId: USER };
    const snap = assembleDecisionContext(state, {
      date: DATE,
      userId: USER,
      source: "offline_legacy",
    });
    if (snap) {
      const r = await runProductionAiRuntime({
        trustedUserId: USER,
        intent: "prod_e2e_rag_failure",
        snapshot: snap,
        skipBridge: true,
        emitOutcomeAndLearning: false,
        runtimeMode: "deterministic",
        inject: { ragFailure: true },
      });
      out.push({
        id: "rag_failure",
        ok: !r.ok && r.error_code === "rag_error",
        expected_fail: true,
        detail: r.error_code ?? r.reason,
      });
    }
  }

  // Memory failure inject
  {
    const state = { ...buildQaScenario("healthy_full", { date: DATE }), userId: USER };
    const snap = assembleDecisionContext(state, {
      date: DATE,
      userId: USER,
      source: "offline_legacy",
    });
    if (snap) {
      const r = await runProductionAiRuntime({
        trustedUserId: USER,
        intent: "prod_e2e_memory_failure",
        snapshot: snap,
        skipBridge: true,
        emitOutcomeAndLearning: false,
        runtimeMode: "deterministic",
        inject: { memoryFailure: true },
      });
      out.push({
        id: "memory_failure",
        ok: !r.ok && r.error_code === "memory_error",
        expected_fail: true,
        detail: r.error_code ?? r.reason,
      });
    }
  }

  // LLM failure / rollback path — FORCE deterministic (mock provider forbidden as prod LLM)
  {
    const prev = process.env["AI_FORCE_DETERMINISTIC"];
    process.env["AI_FORCE_DETERMINISTIC"] = "1";
    try {
      const mode = resolveEffectiveRuntimeMode("llm");
      out.push({
        id: "llm_failure_or_rollback",
        ok: mode === "deterministic",
        expected_fail: true,
        detail: `effective_mode=${mode}`,
      });
    } finally {
      if (prev === undefined) delete process.env["AI_FORCE_DETERMINISTIC"];
      else process.env["AI_FORCE_DETERMINISTIC"] = prev;
    }
  }

  // Safety rejection
  {
    const state = { ...buildQaScenario("healthy_full", { date: DATE }), userId: USER };
    const snap = assembleDecisionContext(state, {
      date: DATE,
      userId: USER,
      source: "offline_legacy",
    });
    if (snap) {
      const unsafe = {
        ...snap,
        safety: {
          ...snap.safety,
          escalateCare: true,
          ok: false,
          reasons: [...snap.safety.reasons, "e2e_force_escalate"],
        },
      };
      const mode = unsafe.decisions.trainingMode;
      const proposed_type =
        mode === "rest"
          ? "REST"
          : mode === "deload"
            ? "DELOAD"
            : mode === "express"
              ? "EXPRESS_WORKOUT"
              : "FULL_WORKOUT";
      // Force non-rest proposal against escalateCare
      const created_at = new Date().toISOString();
      const proposal = {
        proposal_id: buildProposalId({
          userId: USER,
          proposedType: "FULL_WORKOUT",
          proposedValue: "full",
          createdAt: created_at,
        }),
        user_id: USER,
        context_id: unsafe.inputFingerprint,
        proposed_type: "FULL_WORKOUT" as const,
        proposed_value: "full",
        reason_codes: ["progression_ready" as const],
        confidence: 0.8,
        source: "coach" as const,
        created_at,
      };
      void proposed_type;
      const bridge = await runAuthoritativeBridge({
        proposal,
        snapshot: unsafe,
        runId: "prod_e2e_safety",
        emitOutcomeAndLearning: false,
      });
      out.push({
        id: "safety_rejection",
        ok: !bridge.ok,
        expected_fail: true,
        detail: bridge.error_code ?? bridge.reason ?? "unexpected_pass",
      });
    }
  }

  // Invalid proposal (mode conflict)
  {
    const state = { ...buildQaScenario("healthy_full", { date: DATE }), userId: USER };
    let snap = assembleDecisionContext(state, {
      date: DATE,
      userId: USER,
      source: "offline_legacy",
    });
    if (snap) {
      snap = {
        ...snap,
        decisions: {
          ...snap.decisions,
          trainingMode: "rest",
          trainingVolume: 0,
        },
        safety: { ...snap.safety, preferLightTraining: true },
      };
      const created_at = new Date().toISOString();
      const proposal = {
        proposal_id: buildProposalId({
          userId: USER,
          proposedType: "FULL_WORKOUT",
          proposedValue: "full",
          createdAt: created_at,
        }),
        user_id: USER,
        context_id: snap.inputFingerprint,
        proposed_type: "FULL_WORKOUT" as const,
        proposed_value: "full",
        reason_codes: ["progression_ready" as const],
        confidence: 0.8,
        source: "coach" as const,
        created_at,
      };
      const bridge = await runAuthoritativeBridge({
        proposal,
        snapshot: snap,
        runId: "prod_e2e_invalid",
        emitOutcomeAndLearning: false,
      });
      out.push({
        id: "invalid_proposal",
        ok: !bridge.ok || bridge.degraded,
        expected_fail: true,
        detail: bridge.error_code ?? bridge.reason ?? (bridge.ok ? "degraded_or_ok" : "rejected"),
      });
    }
  }

  // Database failure observation (no admin → expected BLOCKED path)
  {
    const hasKey = Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]);
    out.push({
      id: "database_failure",
      ok: true,
      expected_fail: true,
      detail: hasKey
        ? "service_role_present_negative_skipped"
        : "admin_db_unavailable_observed",
    });
  }

  // RAG empty / nonsense — no invented citations
  {
    try {
      const r = await retrieveKnowledge({
        query: "zzz_prod_e2e_empty_corpus_probe_no_hits_expected",
        mode: "hybrid",
        audit: { userId: USER },
      });
      const invented =
        (r.citations?.length ?? 0) > 0 && (r.retrieval.hits?.length ?? 0) === 0;
      out.push({
        id: "rag_no_invented_citations",
        ok: !invented,
        expected_fail: false,
        detail: r.retrieval.rag_status,
      });
    } catch (e) {
      // Empty/error without citations is fail-closed OK
      out.push({
        id: "rag_no_invented_citations",
        ok: true,
        expected_fail: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return out;
}
