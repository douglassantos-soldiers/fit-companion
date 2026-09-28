/**
 * FASE 21 — Agents/Gateway/Skills must not write Decision / Living Plan directly.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src", "ai");

const FORBIDDEN = [
  "persistDecision",
  "writeLivingPlan",
  "applyLivingPlan",
  "saveLivingPlan",
  "mutateLivingPlan",
];

const SCOPES = ["agents", "gateway", "skills", "runtime"];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

describe("FASE 21 / 22.1 data integrity", () => {
  it("agents/gateway/skills/runtime do not call Living Plan / Decision persist writers", () => {
    const hits: string[] = [];
    for (const scope of SCOPES) {
      const dir = join(ROOT, scope);
      for (const file of walk(dir)) {
        const src = readFileSync(file, "utf8");
        for (const sym of FORBIDDEN) {
          if (src.includes(sym)) hits.push(`${file}::${sym}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("canonical runtime exists and decision-pipeline wraps it", () => {
    const canon = join(ROOT, "runtime", "production-runtime.ts");
    const canonSrc = readFileSync(canon, "utf8");
    expect(canonSrc).toMatch(/runProductionAiRuntime/);
    expect(canonSrc).toMatch(/CANONICAL/);
    expect(canonSrc).not.toMatch(/computeDecisions\s*\(/);
    expect(canonSrc).not.toMatch(/materializeLivingPlan\s*\(/);

    const bridge = join(ROOT, "decision-pipeline", "run-pipeline.ts");
    const src = readFileSync(bridge, "utf8");
    expect(src).toMatch(/runProductionAiRuntime/);
    expect(src).toMatch(/emitOutcomeAndLearning/);
    expect(src).toMatch(/DecisionProposal|proposal/i);
  });
});
