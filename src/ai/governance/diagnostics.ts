/**
 * diagnoseAgentRun — answers the 12 diagnostic questions without inventing data or secrets.
 */
import { getAgent } from "@/ai/orchestrator/agents/registry";
import { buildAiAuditTrail } from "@/ai/governance/correlate";
import { redactForAudit } from "@/ai/governance/redact";
import { AI_GOVERNANCE_VERSION } from "@/ai/governance/version";

export type DiagnosticAnswerStatus = "known" | "unknown" | "insufficient";

export type DiagnosticAnswer = {
  question: string;
  status: DiagnosticAnswerStatus;
  value: unknown;
};

export type AgentRunDiagnosticView = {
  run_id: string;
  governance_version: string;
  answers: DiagnosticAnswer[];
  sections: {
    agent: Record<string, unknown>;
    skills: unknown[];
    tools: unknown[];
    rag: unknown[];
    sources: unknown[];
    context: Record<string, unknown>;
    decision: Record<string, unknown>;
    evidence: unknown[];
    model_cost: Record<string, unknown>;
    result: Record<string, unknown>;
  };
};

function answer(question: string, value: unknown, present: boolean): DiagnosticAnswer {
  if (!present || value === undefined || value === null || value === "") {
    return { question, status: "unknown", value: null };
  }
  return { question, status: "known", value: redactForAudit(value) };
}

export function diagnoseAgentRun(
  runId: string,
  opts?: { extraAudits?: import("@/ai/governance/audit").AiAuditEvent[] },
): AgentRunDiagnosticView {
  const trail = buildAiAuditTrail(runId, {
    ...(opts?.extraAudits ? { extraAudits: opts.extraAudits } : {}),
  });
  const run = trail.agent_run;
  const registryAgent = run ? getAgent(run.agent_id) : null;
  const agentVersion =
    (typeof run?.metadata?.["agent_version"] === "string" ? run.metadata["agent_version"] : null) ??
    run?.metadata?.["agent_version"] ??
    registryAgent?.version ??
    null;

  const skillIds = [...new Set(trail.skill_runs.map((s) => s.skill_id))];
  const toolIds = [...new Set(trail.tool_calls.map((t) => t.tool_id || t.tool))];
  const retrievalIds = trail.rag_retrievals.map((r) => r.retrieval_id);
  const sources = trail.rag_retrievals.flatMap((r) =>
    r.hits.map((h) => ({
      document_id: h.document_id,
      source_id: h.source_id ?? null,
      title: h.title,
      score: h.score,
    })),
  );

  const contextFp =
    run?.context_fingerprint ??
    (typeof run?.metadata?.["context_fingerprint"] === "string"
      ? run.metadata["context_fingerprint"]
      : null) ??
    trail.audits.find((a) => a.context_fingerprint)?.context_fingerprint ??
    null;

  const decisionIds = [
    ...(run?.decision_ids ?? []),
    ...trail.decisions.map((d) => d.decision_id).filter(Boolean),
  ] as string[];
  const uniqueDecisions = [...new Set(decisionIds.filter(Boolean))];

  const evidence: unknown[] = [];
  for (const a of trail.decisions) {
    if (a.metadata) evidence.push({ kind: "decision_meta", ...a.metadata });
  }
  for (const r of trail.rag_retrievals) {
    for (const h of r.hits.slice(0, 3)) {
      evidence.push({
        kind: "rag_hit",
        document_id: h.document_id,
        score: h.score,
        excerpt: h.excerpt,
      });
    }
  }

  const model =
    (typeof run?.metadata?.["model"] === "string" ? run.metadata["model"] : null) ??
    trail.audits.find((a) => a.model)?.model ??
    null;
  const cost =
    (typeof run?.metadata?.["estimated_cost"] === "number"
      ? run.metadata["estimated_cost"]
      : null) ??
    trail.audits.reduce((sum, a) => sum + (a.estimated_cost ?? 0), 0) ??
    null;
  const tokens = trail.audits.reduce(
    (acc, a) => ({
      input: acc.input + (a.token_usage?.input ?? 0),
      output: acc.output + (a.token_usage?.output ?? 0),
    }),
    { input: 0, output: 0 },
  );

  const latencyMs =
    typeof run?.metadata?.["latency_ms"] === "number" ? run.metadata["latency_ms"] : null;

  const answers: DiagnosticAnswer[] = [
    answer("Qual Agent participou?", run?.agent_id ?? null, Boolean(run?.agent_id)),
    answer("Qual versão do Agent?", agentVersion, agentVersion != null && agentVersion !== ""),
    answer("Qual Skill foi usada?", skillIds, skillIds.length > 0),
    answer("Quais Tools foram chamadas?", toolIds, toolIds.length > 0),
    answer("Qual RAG foi consultado?", retrievalIds, retrievalIds.length > 0),
    answer("Quais fontes foram utilizadas?", sources, sources.length > 0),
    answer("Qual Context foi utilizado?", contextFp, Boolean(contextFp)),
    answer(
      "Qual decisão foi produzida?",
      uniqueDecisions.length ? uniqueDecisions : trail.decisions.map((d) => d.subject_id),
      uniqueDecisions.length > 0 || trail.decisions.length > 0,
    ),
    answer("Quais evidências sustentaram a decisão?", evidence, evidence.length > 0),
    answer(
      "Qual modelo foi utilizado?",
      model ?? (run ? "deterministic_runtime" : null),
      Boolean(run),
    ),
    answer(
      "Quanto custou?",
      { estimated_cost: cost, token_usage: tokens, latency_ms: latencyMs },
      Boolean(run),
    ),
    answer(
      "Qual foi o resultado?",
      run
        ? {
            status: run.status,
            error_code: run.error_code ?? null,
            outcomes: trail.outcomes.map((o) => o.subject_id),
            learning_events: trail.learning_events.map((e) => e.subject_id),
          }
        : null,
      Boolean(run),
    ),
  ];

  // Mark missing context as insufficient when run exists but fingerprint empty
  if (run && !contextFp) {
    const idx = answers.findIndex((a) => a.question.startsWith("Qual Context"));
    if (idx >= 0) {
      answers[idx] = {
        question: answers[idx]!.question,
        status: "insufficient",
        value: null,
      };
    }
  }

  return {
    run_id: runId,
    governance_version: AI_GOVERNANCE_VERSION,
    answers,
    sections: {
      agent: redactForAudit({
        agent_id: run?.agent_id ?? null,
        agent_version: agentVersion,
        user_id: run?.user_id ?? null,
        parent_run_id: run?.parent_run_id ?? null,
        status: run?.status ?? null,
      }) as Record<string, unknown>,
      skills: trail.skill_runs.map((s) =>
        redactForAudit({
          skill_run_id: s.skill_run_id,
          skill_id: s.skill_id,
          status: s.status,
          latency_ms: s.latency_ms ?? null,
        }),
      ),
      tools: trail.tool_calls.map((t) =>
        redactForAudit({
          tool_call_id: t.tool_call_id,
          tool_id: t.tool_id,
          status: t.status,
          latency_ms: t.latency_ms ?? null,
          error_code: t.error_code ?? null,
        }),
      ),
      rag: trail.rag_retrievals.map((r) =>
        redactForAudit({
          retrieval_id: r.retrieval_id,
          hit_count: r.hits.length,
          latency_ms: r.latency_ms,
          mode: r.mode,
        }),
      ),
      sources: redactForAudit(sources) as unknown[],
      context: redactForAudit({
        context_fingerprint: contextFp,
      }) as Record<string, unknown>,
      decision: redactForAudit({
        decision_ids: uniqueDecisions,
        audits: trail.decisions.map((d) => d.subject_id),
      }) as Record<string, unknown>,
      evidence: redactForAudit(evidence) as unknown[],
      model_cost: redactForAudit({
        model: model ?? "deterministic_runtime",
        estimated_cost: cost,
        token_usage: tokens,
        latency_ms: latencyMs,
      }) as Record<string, unknown>,
      result: redactForAudit({
        status: run?.status ?? null,
        error_code: run?.error_code ?? null,
        error_message: run?.error_message ?? null,
      }) as Record<string, unknown>,
    },
  };
}
