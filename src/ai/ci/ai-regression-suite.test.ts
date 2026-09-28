/**
 * FASE 22.8 — AI CI regression suite (blocking).
 * Failures here must not pass silently: safety, authz, decision, evidence, citation, production guards.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  EVAL_CHECKERS,
  EVAL_NEGATIVE_FIXTURES,
  EVAL_SUITE_FIXTURES,
  getActiveEvalCases,
  runAiEvaluation,
  runAiEvaluationV2,
  applyThresholds,
  DEFAULT_EVAL_THRESHOLDS,
  GOLDEN_NEGATIVE_ARTIFACTS,
  GOLDEN_DATASET,
  scoreEvidenceForGolden,
} from "@/ai/governance";
import { isExecutedPass, untestedCheck } from "@/ai/certification/types";
import { getProvider, resetProviderRegistry } from "@/ai/providers";
import { ProductionMockProviderError } from "@/ai/providers/errors";
import { ensureVectorStore, resetVectorStore } from "@/ai/rag";
import { ensureMemoryStore, resetMemoryInfrastructure } from "@/ai/memory";

const REQUIRED_NEGATIVES = [
  "wrong_user",
  "unauthorized_tool",
  "invalid_proposal",
  "safety_rejection",
  "wrong_evidence",
  "rag_failure",
  "tool_failure",
  "model_timeout",
  "cost_limit",
  "missing_context",
  "hallucination",
  "unsupported_claim",
] as const;

describe("FASE 22.8 AI regression — 12 negative modes", () => {
  it("catalog covers all required regression names", () => {
    const names = new Set(getActiveEvalCases().map((c) => c.name));
    for (const n of REQUIRED_NEGATIVES) {
      expect(names.has(n), n).toBe(true);
      expect(EVAL_CHECKERS[n], n).toBeTypeOf("function");
      expect(EVAL_NEGATIVE_FIXTURES[n], n).toBeTruthy();
    }
  });

  it("positive suite stays 12/12", () => {
    const suite = runAiEvaluation({ inputs: EVAL_SUITE_FIXTURES });
    expect(suite.passed).toBe(12);
    expect(suite.failed).toBe(0);
  });

  it.each([...REQUIRED_NEGATIVES])("negative %s fails checker (no silent pass)", (name) => {
    const checker = EVAL_CHECKERS[name]!;
    const r = checker(EVAL_NEGATIVE_FIXTURES[name]!);
    expect(r.passed, `${name} must fail`).toBe(false);
  });
});

describe("FASE 22.8 critical thresholds block regressions", () => {
  it("default thresholds require 100% safety / proposal / tool auth", () => {
    expect(DEFAULT_EVAL_THRESHOLDS.critical_safety_pass_rate).toBe(1);
    expect(DEFAULT_EVAL_THRESHOLDS.proposal_validity_pass_rate).toBe(1);
    expect(DEFAULT_EVAL_THRESHOLDS.tool_authorization_pass_rate).toBe(1);
  });

  it("applyThresholds blocks critical_safety < 100%", () => {
    const r = applyThresholds({
      critical_safety_pass_rate: 0.99,
      proposal_validity_pass_rate: 1,
      citation_correctness_avg: 1,
      evidence_relevance_avg: 1,
      tool_authorization_pass_rate: 1,
    });
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => b.includes("critical_safety"))).toBe(true);
  });

  it("applyThresholds blocks tool_authorization < 100%", () => {
    const r = applyThresholds({
      critical_safety_pass_rate: 1,
      proposal_validity_pass_rate: 1,
      citation_correctness_avg: 1,
      evidence_relevance_avg: 1,
      tool_authorization_pass_rate: 0.5,
    });
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => b.includes("tool_authorization"))).toBe(true);
  });

  it("golden v2 report ok with thresholds", () => {
    const report = runAiEvaluationV2();
    expect(report.ok).toBe(true);
    expect(report.threshold_result.ok).toBe(true);
    expect(report.governance?.passed).toBe(12);
  });

  it("citation / unsupported claim golden negative fails evidence", () => {
    const g = GOLDEN_DATASET.find((c) => c.case_id === "golden_neg_citation_wrong_claim");
    expect(g).toBeTruthy();
    const art = GOLDEN_NEGATIVE_ARTIFACTS["golden_neg_citation_wrong_claim"];
    expect(art).toBeTruthy();
    const ev = scoreEvidenceForGolden(g!, art!);
    expect(ev.passed).toBe(false);
  });
});

describe("FASE 22.8 production guards", () => {
  const prevEnv = { ...process.env };

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in prevEnv)) delete process.env[k];
    }
    Object.assign(process.env, prevEnv);
    resetProviderRegistry();
    resetVectorStore();
    resetMemoryInfrastructure();
  });

  beforeEach(() => {
    resetProviderRegistry();
    resetVectorStore();
    resetMemoryInfrastructure();
  });

  it("Mock provider in production throws ProductionMockProviderError", () => {
    process.env["NODE_ENV"] = "production";
    process.env["AI_LLM_ENV"] = "production";
    delete process.env["VITEST"];
    expect(() => getProvider("mock")).toThrow(ProductionMockProviderError);
  });

  it("InMemory RAG forbidden in production", async () => {
    process.env["AI_RAG_ENV"] = "production";
    delete process.env["VITEST"];
    process.env["AI_RAG_STORE"] = "memory";
    resetVectorStore();
    await expect(ensureVectorStore({ force: true })).rejects.toThrow(/memory is forbidden/);
  });

  it("InMemory Memory forbidden in production", async () => {
    process.env["AI_MEMORY_ENV"] = "production";
    delete process.env["VITEST"];
    process.env["AI_MEMORY_STORE"] = "memory";
    resetMemoryInfrastructure();
    await expect(ensureMemoryStore({ force: true })).rejects.toThrow(/memory is forbidden/);
  });

  it("UNTESTED never satisfies isExecutedPass", () => {
    const u = untestedCheck("safety", "Safety", true);
    expect(isExecutedPass(u)).toBe(false);
    expect(isExecutedPass({ status: "UNTESTED", executed_at: null })).toBe(false);
    expect(isExecutedPass({ status: "PASS", executed_at: null })).toBe(false);
  });

  it("agents/gateway/skills/runtime do not direct-write Decision or Living Plan", () => {
    const root = join(process.cwd(), "src", "ai");
    const forbidden = [
      "persistDecision",
      "writeLivingPlan",
      "applyLivingPlan",
      "saveLivingPlan",
      "mutateLivingPlan",
    ];
    const scopes = ["agents", "gateway", "skills", "runtime"];
    const hits: string[] = [];

    function walk(dir: string, acc: string[] = []): string[] {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, acc);
        else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) acc.push(p);
      }
      return acc;
    }

    for (const scope of scopes) {
      const dir = join(root, scope);
      for (const file of walk(dir)) {
        const src = readFileSync(file, "utf8");
        for (const sym of forbidden) {
          if (src.includes(sym)) hits.push(`${file}::${sym}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
