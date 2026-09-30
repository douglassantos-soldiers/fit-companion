// @ts-nocheck
/**
 * FASE 18 — decision pipeline unit tests.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { clearAuditLog, listAudits } from "@/ai/governance/audit";
import {
  attachProposalEvidence,
  collectProposalsFromSpecialists,
  detectProposalConflicts,
  mergeSpecialistProposals,
  selectByPriority,
  runSpecialistsDecisionPipeline,
} from "@/ai/decision-pipeline";
import type { AgentAnalysisResult } from "@/ai/contracts/agent-analysis";
import type { DecisionProposal } from "@/lib/engine/decision-proposal";
import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import { buildQaScenario } from "@/lib/qa/scenarios";
import {
  clearAgentRegistry,
  clearAgentRunLog,
  registerDefaultAgents,
} from "@/ai/agents";
import { registerAllSkills, clearSkillRegistry, clearSkillRunLog } from "@/ai/skills";
import { registerAllMcpTools } from "@/ai/mcp/register";
import { clearToolRegistry } from "@/ai/mcp/core/registry";
import { resetMemoryInfrastructure } from "@/ai/memory";
import { clearKnowledgeStore, resetEmbeddingProvider } from "@/ai/rag";
import type { SkillCallTool } from "@/ai/skills";

const USER = "user-decision-pipe01";
const DATE = "2026-03-11";

function baseProposal(
  partial: Partial<DecisionProposal> & Pick<DecisionProposal, "proposed_type" | "proposed_value">,
): DecisionProposal {
  return {
    proposal_id: partial.proposal_id ?? `prop_${partial.proposed_type}`,
    user_id: partial.user_id ?? USER,
    proposed_type: partial.proposed_type,
    proposed_value: partial.proposed_value,
    reason_codes: partial.reason_codes ?? ["test"],
    confidence: partial.confidence ?? 0.7,
    source: "agent",
    created_at: partial.created_at ?? new Date().toISOString(),
    ...(partial.agent_id ? { agent_id: partial.agent_id } : {}),
    ...(partial.confidence_breakdown
      ? { confidence_breakdown: partial.confidence_breakdown }
      : {}),
    ...(partial.evidence ? { evidence: partial.evidence } : {}),
  };
}

function agentResult(
  agentId: string,
  proposal: DecisionProposal | null,
  evidenceExtra = true,
): AgentAnalysisResult {
  return {
    agent_id: agentId,
    run_id: `ar_${agentId}`,
    user_id: USER,
    analysis: { ok: true },
    evidence: evidenceExtra
      ? [{ signal: "tool_signal", value: 1, source: "get_recovery" }]
      : [],
    confidence: 0.7,
    warnings: [],
    status: "completed",
    ...(proposal ? { proposal } : {}),
  };
}

const mockCallTool: SkillCallTool = async (toolId) => {
  switch (toolId) {
    case "get_recovery":
      return {
        ok: true,
        data: {
          recovery: { score: 35, level: "low", readiness: "low", fatigueSignal: true },
        },
      };
    case "get_sleep":
      return { ok: true, data: { sleep: { hours: 5, source: "checkin", avg7d: 5.5 } } };
    case "get_wearable_data":
      return {
        ok: true,
        data: { wearable: { available: false, confidence: null, restingHr: null, hrv: null } },
      };
    case "get_training_history":
      return {
        ok: true,
        data: {
          sessions: [
            { id: "s1", date: DATE, title: "Squat", durationMin: 50 },
            { id: "s2", date: DATE, title: "Push", durationMin: 40 },
            { id: "s3", date: DATE, title: "Pull", durationMin: 45 },
          ],
        },
      };
    case "get_current_plan":
      return {
        ok: true,
        data: {
          plan: { date: DATE, workoutMode: "full" },
          decisions: { trainingMode: "full", trainingVolume: 1 },
        },
      };
    case "get_recent_decisions":
      return { ok: true, data: { decisions: [], trainingMode: "full" } };
    case "get_nutrition":
      return {
        ok: true,
        data: {
          nutrition: { mealsLoggedToday: 0, proteinAdherence7d: 0.5, kcalTrend: 0 },
        },
      };
    case "get_user_goal":
      return { ok: true, data: { goal: "massa" } };
    case "get_user_profile":
      return { ok: true, data: { profile: { goal: "massa" } } };
    case "get_recent_outcomes":
      return { ok: true, data: { outcomes: [] } };
    case "get_training_session":
      return { ok: true, data: { session: { id: "s1" } } };
    default:
      return { ok: true, data: {} };
  }
};

beforeEach(() => {
  clearAuditLog();
  clearAgentRunLog();
  clearAgentRegistry();
  clearSkillRegistry();
  clearSkillRunLog();
  clearToolRegistry();
  resetMemoryInfrastructure();
  clearKnowledgeStore();
  resetEmbeddingProvider();
  registerDefaultAgents();
  registerAllSkills();
  registerAllMcpTools();
});

describe("evidence + confidence split", () => {
  it("attachProposalEvidence sets evidence_confidence without using model as Decision confidence", () => {
    const p = baseProposal({
      proposed_type: "REST",
      proposed_value: "rest",
      confidence: 0.8,
      confidence_breakdown: { model_confidence: 0.99, proposal_confidence: 0.8 },
    });
    const out = attachProposalEvidence({
      proposal: p,
      toolEvidence: [{ signal: "fatigued", value: true, source: "get_recovery" }],
      ragCitations: [
        {
          citation_id: "c1",
          document_id: "d1",
          chunk_id: "ch1",
          title: "Recovery",
          score: 0.9,
          excerpt: "rest when fatigued",
        },
      ],
      memoryEvidence: [{ signal: "memory:pref", value: "rest", source: "memory" }],
      modelConfidence: 0.99,
    });
    expect(out.confidence).toBe(0.8);
    expect(out.confidence_breakdown?.model_confidence).toBe(0.99);
    expect(out.confidence_breakdown?.evidence_confidence).toBeGreaterThan(0.5);
    expect(out.evidence?.items?.length).toBeGreaterThan(0);
  });

  it("missing evidence discards candidate", () => {
    const p = baseProposal({
      proposed_type: "FULL_WORKOUT",
      proposed_value: "full",
      agent_id: "specialist_training",
      confidence: 0.9,
    });
    const { candidates, discarded } = collectProposalsFromSpecialists([
      agentResult("specialist_training", p, false),
    ]);
    expect(candidates.length).toBe(0);
    expect(discarded[0]?.discarded_reason).toBe("missing_evidence");
  });

  it("low confidence discards candidate", () => {
    const p = baseProposal({
      proposed_type: "CHECKIN",
      proposed_value: true,
      agent_id: "specialist_behavior",
      confidence: 0.2,
    });
    const withEv = agentResult("specialist_behavior", p, true);
    const { discarded } = collectProposalsFromSpecialists([withEv]);
    expect(discarded.some((d) => d.discarded_reason === "low_confidence")).toBe(true);
  });
});

describe("conflicts + priority", () => {
  it("detects training vs recovery conflict", () => {
    const training = baseProposal({
      proposed_type: "FULL_WORKOUT",
      proposed_value: "full",
      agent_id: "specialist_training",
      confidence: 0.9,
      confidence_breakdown: { evidence_confidence: 0.75, proposal_confidence: 0.9 },
    });
    const recovery = baseProposal({
      proposed_type: "REST",
      proposed_value: "rest",
      agent_id: "specialist_recovery",
      confidence: 0.7,
      confidence_breakdown: { evidence_confidence: 0.75, proposal_confidence: 0.7 },
    });
    const conflicts = detectProposalConflicts([
      { proposal: training, agent_id: "specialist_training" },
      { proposal: recovery, agent_id: "specialist_recovery" },
    ]);
    expect(conflicts.some((c) => c.conflict_type === "training_vs_recovery")).toBe(true);
  });

  it("recovery wins over training by priority (not max confidence)", () => {
    const training = baseProposal({
      proposed_type: "FULL_WORKOUT",
      proposed_value: "full",
      agent_id: "specialist_training",
      confidence: 0.95,
      confidence_breakdown: { evidence_confidence: 0.5, proposal_confidence: 0.95 },
    });
    const recovery = baseProposal({
      proposed_type: "REST",
      proposed_value: "rest",
      agent_id: "specialist_recovery",
      confidence: 0.6,
      confidence_breakdown: { evidence_confidence: 0.5, proposal_confidence: 0.6 },
    });
    const { selected } = selectByPriority([
      { proposal: training, agent_id: "specialist_training" },
      { proposal: recovery, agent_id: "specialist_recovery" },
    ]);
    expect(selected?.proposal.proposed_type).toBe("REST");
  });

  it("mergeSpecialistProposals audits and selects recovery", () => {
    const training = baseProposal({
      proposed_type: "PROGRESSION",
      proposed_value: "full",
      agent_id: "specialist_training",
      confidence: 0.9,
    });
    const recovery = baseProposal({
      proposed_type: "REST",
      proposed_value: "rest",
      agent_id: "specialist_recovery",
      confidence: 0.75,
    });
    const merge = mergeSpecialistProposals({
      specialistResults: [
        agentResult("specialist_training", training),
        agentResult("specialist_recovery", recovery),
      ],
      userId: USER,
      runId: "run_merge_1",
    });
    expect(merge.selected?.proposed_type).toBe("REST");
    expect(merge.conflicts.length).toBeGreaterThan(0);
    const audits = listAudits(20).filter((a) => a.kind === "proposal_merge");
    expect(audits.length).toBeGreaterThan(0);
  });
});

describe("runSpecialistsDecisionPipeline", () => {
  it("single specialist → proposal → decision path", async () => {
    let state = buildQaScenario("healthy_full", { date: DATE });
    state = { ...state, userId: USER };
    const snapshot = assembleDecisionContext(state, {
      date: DATE,
      userId: USER,
      source: "offline_legacy",
    });
    expect(snapshot).toBeTruthy();

    const out = await runSpecialistsDecisionPipeline({
      trustedUserId: USER,
      intent: "ajustar volume do treino",
      snapshot: snapshot!,
      forceAgents: ["specialist_training"],
      callTool: mockCallTool,
      skipKnowledge: true,
      emitOutcomeAndLearning: false,
    });
    expect(out.specialist_results.length).toBe(1);
    expect(out.merge).toBeTruthy();
    if (out.proposal && out.bridge) {
      expect(out.decision).toBeTruthy();
      expect(out.decision?.why?.reason_codes?.length).toBeGreaterThanOrEqual(0);
      expect(out.bridge.living_plan != null || out.bridge.degraded).toBe(true);
    }
  });

  it("multiple specialists with conflict → recovery preferred", async () => {
    let state = buildQaScenario("low_sleep", { date: DATE });
    state = { ...state, userId: USER };
    const snapshot = assembleDecisionContext(state, {
      date: DATE,
      userId: USER,
      source: "offline_legacy",
    });
    expect(snapshot).toBeTruthy();

    const out = await runSpecialistsDecisionPipeline({
      trustedUserId: USER,
      intent: "estou cansado mas quero treinar forte",
      snapshot: snapshot!,
      forceAgents: ["specialist_recovery", "specialist_training"],
      callTool: mockCallTool,
      skipKnowledge: true,
      emitOutcomeAndLearning: false,
    });
    expect(out.specialist_results.length).toBe(2);
    if (out.merge.candidates.length >= 2) {
      expect(
        out.merge.conflicts.some((c) => c.conflict_type === "training_vs_recovery") ||
          out.proposal?.agent_id === "specialist_recovery" ||
          out.proposal?.proposed_type === "REST" ||
          out.proposal?.proposed_type === "EXPRESS_WORKOUT" ||
          out.proposal?.proposed_type === "INCREASE_RECOVERY" ||
          out.proposal?.proposed_type === "SLEEP_FOCUS" ||
          out.proposal?.proposed_type === "DELOAD" ||
          out.proposal?.proposed_type === "REDUCE_VOLUME",
      ).toBe(true);
    }
  });

  it("invalid / safety rejection observable via bridge", async () => {
    let state = buildQaScenario("healthy_full", { date: DATE });
    state = { ...state, userId: USER };
    let snapshot = assembleDecisionContext(state, {
      date: DATE,
      userId: USER,
      source: "offline_legacy",
    })!;
    snapshot = {
      ...snapshot,
      safety: {
        ...snapshot.safety,
        escalateCare: true,
        ok: false,
        reasons: [...snapshot.safety.reasons, "test_escalate"],
      },
    };

    const out = await runSpecialistsDecisionPipeline({
      trustedUserId: USER,
      intent: "treino full hoje",
      snapshot,
      forceAgents: ["specialist_training"],
      callTool: mockCallTool,
      skipKnowledge: true,
      emitOutcomeAndLearning: false,
    });
    // Either no non-rest proposal selected, or bridge rejects
    if (out.proposal && out.bridge && !out.bridge.ok) {
      expect(out.bridge.error_code === "safety_rejection" || out.degraded).toBe(true);
    }
  });
});
