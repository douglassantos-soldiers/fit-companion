/**
 * Deterministic Coach response builder — never invents facts.
 */

import type { CoachFactPack } from "@/ai/agents/coach/fact-pack";

export type CoachAgentResponseStatus =
  "ok" | "insufficient_context" | "insufficient_evidence" | "rejected" | "partial" | "blocked";

export type CoachAgentStructured = {
  summary: string;
  why: string[];
  decisions: string[];
  evidence: Array<{ signal: string; value: string | number | boolean | null }>;
  warnings: string[];
  proposalType?: string;
  proposalStatus: CoachFactPack["proposalStatus"];
  intentKind: CoachFactPack["intentKind"];
  safetyNotice?: string;
};

export type BuiltCoachResponse = {
  text: string;
  structured: CoachAgentStructured;
  status: CoachAgentResponseStatus;
};

function linesFromWhy(pack: CoachFactPack): string[] {
  const why = pack.why;
  if (!why) return [];
  const out: string[] = [];
  if (why.explanations.length) out.push(...why.explanations.slice(0, 6));
  if (why.reason_codes.length) {
    out.push(`Códigos: ${why.reason_codes.slice(0, 8).join(", ")}`);
  }
  if (why.training_mode) out.push(`Modo de treino: ${why.training_mode}`);
  if (why.decision_value !== null && why.decision_value !== undefined) {
    out.push(`Decisão: ${String(why.decision_value)}`);
  }
  if (why.expected_outcome) {
    const eo =
      typeof why.expected_outcome === "object" && why.expected_outcome !== null
        ? (why.expected_outcome as Record<string, unknown>)
        : null;
    const kind = eo?.["kind"] ?? eo?.["Kind"];
    if (kind) out.push(`Resultado esperado: ${String(kind)}`);
  }
  return out;
}

function specialistSummaries(pack: CoachFactPack): string[] {
  const out: string[] = [];
  for (const r of pack.specialistResults) {
    if (r.status !== "completed") continue;
    const analysis = r.analysis as { skills?: Array<{ skillId: string }> } | null;
    const skills = analysis?.skills?.map((s) => s.skillId).slice(0, 4) ?? [];
    if (skills.length) {
      out.push(`${r.agent_id}: ${skills.join(", ")} (confiança ${r.confidence.toFixed(2)})`);
    } else {
      out.push(`${r.agent_id}: análise concluída (confiança ${r.confidence.toFixed(2)})`);
    }
  }
  return out;
}

export function buildCoachResponse(pack: CoachFactPack): BuiltCoachResponse {
  const whyLines = linesFromWhy(pack);
  const specialistLines = specialistSummaries(pack);
  const evidence = pack.evidence.slice(0, 12).map((e) => ({
    signal: e.signal,
    value: e.value,
  }));

  if (pack.intentKind === "why_plan_changed") {
    if (!pack.why || (pack.why.reason_codes.length === 0 && whyLines.length === 0)) {
      const text =
        "Não tenho evidência suficiente no Decision Engine / contexto de hoje para explicar por que o plano mudou. Complete o check-in ou aguarde o snapshot do dia — não invento justificativas.";
      return {
        text,
        status: "insufficient_evidence",
        structured: {
          summary: text,
          why: [],
          decisions: [],
          evidence,
          warnings: [...pack.warnings, "insufficient_evidence"],
          proposalStatus: "none",
          intentKind: pack.intentKind,
        },
      };
    }

    const parts = [
      "Com base no Decision Engine (WHY / WHAT / EXPECTED) e nas evidências disponíveis:",
      ...whyLines.map((l) => `• ${l}`),
    ];
    if (pack.why.outcome_summary) {
      parts.push(`• Outcomes recentes: ${JSON.stringify(pack.why.outcome_summary).slice(0, 200)}`);
    }
    if (pack.proposalStatus === "rejected" || pack.proposalStatus === "safety_blocked") {
      parts.push(
        `• Proposta de ajuste não aplicada: ${pack.proposalRejectReason ?? pack.proposalStatus}`,
      );
    }
    const text = parts.join("\n");
    return {
      text,
      status: "ok",
      structured: {
        summary: "Explicação do plano com base em Decision + Evidence + Context + Outcome.",
        why: whyLines,
        decisions: pack.why.training_mode ? [`trainingMode=${pack.why.training_mode}`] : [],
        evidence,
        warnings: pack.warnings,
        proposalStatus: pack.proposalStatus,
        intentKind: pack.intentKind,
        ...(pack.proposal ? { proposalType: pack.proposal.proposed_type } : {}),
      },
    };
  }

  const domainLabel = pack.intentKind === "general" ? "visão geral" : pack.intentKind;
  const parts: string[] = [
    `Resumo (${domainLabel}) com base em especialistas, contexto e ferramentas — sem inventar dados:`,
  ];
  if (specialistLines.length) {
    parts.push(...specialistLines.map((l) => `• ${l}`));
  } else {
    parts.push("• Nenhum especialista concluiu análise com dados utilizáveis.");
  }
  if (whyLines.length) {
    parts.push("Decisões / contexto:");
    parts.push(...whyLines.slice(0, 4).map((l) => `• ${l}`));
  }
  if (pack.warnings.some((w) => w.includes("tool_failed") || w.includes("skill_failed"))) {
    parts.push("• Algumas tools/skills falharam; omiti valores em vez de inventá-los.");
  }
  if (pack.warnings.some((w) => w.includes("knowledge"))) {
    parts.push("• Recuperação de conhecimento (RAG) indisponível ou vazia nesta rodada.");
  }
  if (pack.proposalStatus === "rejected" || pack.proposalStatus === "safety_blocked") {
    parts.push(
      `• Sugestão bloqueada por Safety/Decision: ${pack.proposalRejectReason ?? pack.proposalStatus}`,
    );
  } else if (pack.proposal) {
    parts.push(
      `• Há uma proposta (${pack.proposal.proposed_type}) para validação no Decision Engine — o plano Living não foi alterado aqui.`,
    );
  }

  const partial = pack.specialistResults.some((r) => r.status !== "completed");
  const text = parts.join("\n");
  return {
    text,
    status: partial ? "partial" : "ok",
    structured: {
      summary: text.split("\n")[0] ?? text,
      why: whyLines,
      decisions: specialistLines,
      evidence,
      warnings: pack.warnings,
      proposalStatus: pack.proposalStatus,
      intentKind: pack.intentKind,
      ...(pack.proposal ? { proposalType: pack.proposal.proposed_type } : {}),
    },
  };
}

export function buildInsufficientContextResponse(message: string): BuiltCoachResponse {
  const text =
    "Não tenho contexto suficiente (check-in / snapshot / sinais do dia) para responder com segurança. Não invento dados — complete o check-in ou tente novamente quando o Context Engine estiver disponível.";
  return {
    text,
    status: "insufficient_context",
    structured: {
      summary: text,
      why: [],
      decisions: [],
      evidence: [],
      warnings: ["insufficient_context"],
      proposalStatus: "none",
      intentKind: "general",
    },
  };
}

export function buildRejectedPlanResponse(reason: string): BuiltCoachResponse {
  const text = `Não consegui montar um plano de execução válido (${reason}). Não invento uma resposta sem orquestração autorizada.`;
  return {
    text,
    status: "rejected",
    structured: {
      summary: text,
      why: [],
      decisions: [],
      evidence: [],
      warnings: [reason],
      proposalStatus: "none",
      intentKind: "general",
    },
  };
}

export function buildBlockedAnonymousResponse(): BuiltCoachResponse {
  const text = "Autenticação necessária para o Coach Agent.";
  return {
    text,
    status: "blocked",
    structured: {
      summary: text,
      why: [],
      decisions: [],
      evidence: [],
      warnings: ["anonymous_denied"],
      proposalStatus: "none",
      intentKind: "general",
    },
  };
}
