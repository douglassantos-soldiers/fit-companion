/**
 * Live deterministic runtime scorer.
 * Checks domain, skill, kb citation, and claims that lack evidence.
 * Does not mutate Decision.
 */

import type { AgentAnalysisResult } from "@/ai/contracts/agent-analysis";
import type { RunProductionAiRuntimeResult } from "@/ai/runtime/production-runtime";

export type LiveRuntimeExpect = {
  case_id: string;
  intent: string;
  agents: string[];
  skills: string[];
  /** Document id prefix or kb_ref that must appear when the case is knowledge-backed. */
  kb_marker: string;
  /** Patterns that are claims; they may appear only with a matching citation/evidence. */
  claim_patterns: RegExp[];
};

export type LiveRuntimeScore = {
  case_id: string;
  passed: boolean;
  detail: string;
};

const CLAIM_NEEDS_EVIDENCE = [/você deve tomar/i, /prescrevo/i, /dose individual de \d/i];

function blobOf(results: AgentAnalysisResult[]): string {
  return JSON.stringify(
    results.map((r) => ({
      analysis: r.analysis,
      evidence: r.evidence,
      warnings: r.warnings,
    })),
  );
}

function hasKnowledgeMarker(results: AgentAnalysisResult[], marker: string): boolean {
  for (const r of results) {
    for (const c of r.citations ?? []) {
      if (c.kb_ref === marker || c.document_id.includes(marker) || (c.kb_ref ?? "").includes(marker)) {
        return true;
      }
    }
    for (const e of r.evidence) {
      const signal = e.signal;
      const value = e.value == null ? "" : String(e.value);
      if (signal.includes(marker) || value.includes(marker)) return true;
    }
  }
  return false;
}

export function scoreLiveRuntime(
  expectCase: LiveRuntimeExpect,
  out: RunProductionAiRuntimeResult,
): LiveRuntimeScore {
  const plan = out.plan;
  const results = out.specialist_results ?? [];
  const reasons: string[] = [];

  if (!plan) reasons.push("missing_plan");
  for (const agent of expectCase.agents) {
    if (!plan?.agents.includes(agent)) reasons.push(`missing_agent:${agent}`);
  }
  for (const skill of expectCase.skills) {
    const inPlan = plan?.skills.includes(skill) ?? false;
    const inAnalysis = results.some((r) => {
      const analysis = r.analysis as { skills?: Array<{ skillId?: string }> } | null;
      return analysis?.skills?.some((s) => s.skillId === skill) ?? false;
    });
    if (!inPlan && !inAnalysis) reasons.push(`missing_skill:${skill}`);
  }

  const stripped = (plan?.warnings ?? []).filter(
    (w) => w.includes("skills_stripped") || w.includes("tools_stripped"),
  );
  for (const skill of expectCase.skills) {
    if (stripped.some((w) => w.includes(skill))) reasons.push(`stripped:${skill}`);
  }

  if (!hasKnowledgeMarker(results, expectCase.kb_marker)) {
    reasons.push(`missing_kb:${expectCase.kb_marker}`);
  }

  const text = blobOf(results);
  const evidenced = hasKnowledgeMarker(results, expectCase.kb_marker);
  for (const pattern of [...expectCase.claim_patterns, ...CLAIM_NEEDS_EVIDENCE]) {
    if (pattern.test(text) && !evidenced) reasons.push(`claim_without_evidence:${pattern.source}`);
  }

  return {
    case_id: expectCase.case_id,
    passed: reasons.length === 0,
    detail: reasons.length ? reasons.join(",") : "ok",
  };
}

export const LIVE_RUNTIME_CASES: LiveRuntimeExpect[] = [
  {
    case_id: "live_creatine",
    intent: "posso tomar creatina monoidratada?",
    agents: ["specialist_nutrition"],
    skills: ["explain_supplement"],
    kb_marker: "supplements-knowledge-001",
    claim_patterns: [/você deve tomar/i],
  },
  {
    case_id: "live_progression",
    intent: "como subir a carga na progressão do treino?",
    agents: ["specialist_training"],
    skills: ["analyze_training"],
    kb_marker: "tkd-resistido-adultos-001",
    claim_patterns: [],
  },
  {
    case_id: "live_protein",
    intent: "como estão minhas macros e proteína na refeição?",
    agents: ["specialist_nutrition"],
    skills: ["analyze_nutrition"],
    kb_marker: "nutrition-knowledge-001",
    claim_patterns: [/prescrevo/i],
  },
];
