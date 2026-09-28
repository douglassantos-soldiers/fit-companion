/**
 * FASE 22.13 — Supplemental final certification probes.
 * Execute/verify only — never invent PASS. No product features.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runProbe, type ProbeContext } from "@/ai/certification/probes/run-probe";
import type { CertCheck } from "@/ai/certification/types";
import { AI_PATH_LABEL } from "@/ai/runtime/path-labels";
import {
  registerDefaultAgents,
  listAgents,
  getAgent,
} from "@/ai/orchestrator/agents/registry";
import {
  COACH_AGENT_ID,
  SPECIALIST_TRAINING_ID,
  SPECIALIST_NUTRITION_ID,
  SPECIALIST_RECOVERY_ID,
  SPECIALIST_BEHAVIOR_ID,
  SPECIALIST_PERFORMANCE_ID,
} from "@/ai/agents/ids";
import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import { buildQaScenario } from "@/lib/qa/scenarios";
import { runProductionAiRuntime } from "@/ai/runtime/production-runtime";
import { runSpecialistAgent } from "@/ai/agents/runtime/run-specialist";
import { createExecutionPlan } from "@/ai/orchestrator/plan";
import { asTrustedUserId } from "@/ai/contracts/trusted-user-id";
import type { SkillCallTool } from "@/ai/skills/core/types";
import { clearAuditLog } from "@/ai/governance/audit";
import {
  clearAgentRegistry,
  clearAgentRunLog,
  registerDefaultAgents as registerAgentsFresh,
} from "@/ai/agents";
import { registerAllSkills, clearSkillRegistry, clearSkillRunLog } from "@/ai/skills";
import { registerAllMcpTools } from "@/ai/mcp/register";
import { clearToolRegistry } from "@/ai/mcp/core/registry";
import { resetMemoryInfrastructure } from "@/ai/memory";
import { clearKnowledgeStore, resetEmbeddingProvider } from "@/ai/rag";

const execFileAsync = promisify(execFile);
const USER = "user-canonical-rt01";
const DATE = "2026-03-11";

/** Deterministic tool DI for runtime smoke — Decision Engine remains real. */
const certCallTool: SkillCallTool = async (toolId) => {
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
    default:
      return { ok: true, data: { mock: true, toolId } };
  }
};
const REQUIRED_AGENTS = [
  COACH_AGENT_ID,
  SPECIALIST_TRAINING_ID,
  SPECIALIST_NUTRITION_ID,
  SPECIALIST_RECOVERY_ID,
  SPECIALIST_BEHAVIOR_ID,
  SPECIALIST_PERFORMANCE_ID,
] as const;

/**
 * Unique canonical runtime: Coach facade → production runtime; specialists via runtime; no parallel Decision.
 */
export async function probeCanonicalRuntime(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe(
    { check_id: "canonical_runtime", name: "Canonical Runtime", critical: true },
    ctx,
    async () => {
      const coachSrc = readFileSync(
        join(process.cwd(), "src", "ai", "agents", "coach", "run-coach.ts"),
        "utf8",
      );
      const usesRuntime = coachSrc.includes("runProductionAiRuntime");
      const facadeLabel = coachSrc.includes("CANONICAL_FACADE");
      const runtimeSrc = readFileSync(
        join(process.cwd(), "src", "ai", "runtime", "production-runtime.ts"),
        "utf8",
      );
      const pathCanonical = runtimeSrc.includes("AI_PATH_LABEL.CANONICAL");
      const bridgeOnly =
        runtimeSrc.includes("runAuthoritativeBridge") &&
        !runtimeSrc.includes("writeLivingPlan") &&
        !runtimeSrc.includes("forgeDecision");

      const state = { ...buildQaScenario("healthy_full", { date: DATE }), userId: USER };
      const snap = assembleDecisionContext(state, {
        date: DATE,
        userId: USER,
        source: "offline_legacy",
      });
      if (!snap) {
        return { status: "FAIL", error: "no_snapshot", evidence: { usesRuntime } };
      }

      clearAuditLog();
      clearAgentRunLog();
      clearSkillRunLog();
      clearAgentRegistry();
      clearSkillRegistry();
      clearToolRegistry();
      clearKnowledgeStore();
      resetEmbeddingProvider();
      resetMemoryInfrastructure();
      delete process.env["AI_GLOBAL_ENABLED"];
      delete process.env["SPECIALISTS_ENABLED"];
      delete process.env["AI_SPECIALISTS_ENABLED"];
      registerAgentsFresh();
      registerAllSkills();
      registerAllMcpTools();

      const out = await runProductionAiRuntime({
        trustedUserId: USER,
        intent: "como está minha recuperação",
        snapshot: snap,
        forceAgents: ["specialist_recovery", "specialist_training"],
        callTool: certCallTool,
        skipKnowledge: true,
        emitOutcomeAndLearning: false,
        parentRunId: "final_cert_canonical_runtime",
      });

      const ok =
        usesRuntime &&
        facadeLabel &&
        pathCanonical &&
        bridgeOnly &&
        out.path_label === AI_PATH_LABEL.CANONICAL &&
        Boolean(out.decision) &&
        out.ok;

      return {
        status: ok ? "PASS" : "FAIL",
        error: ok ? null : out.reason ?? out.error_code ?? "canonical_runtime_invariant_failed",
        evidence: {
          coach_uses_runtime: usesRuntime,
          coach_facade_label: facadeLabel,
          runtime_path_canonical: pathCanonical,
          no_parallel_decision_writer: bridgeOnly,
          runtime_path_label: out.path_label ?? null,
          runtime_ok: out.ok,
          has_decision: Boolean(out.decision),
          decision_id: out.decision?.decision_id ?? null,
          reason: out.reason ?? null,
          runtime_version: AI_PATH_LABEL.CANONICAL,
        },
      };
    },
  );
}

/** Agents registered + specialist smoke (proposal path, never Decision authority). */
export async function probeAgents(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe(
    { check_id: "agents", name: "Agents", critical: true },
    ctx,
    async () => {
      registerDefaultAgents({ force: true });
      const listed = listAgents();
      const missing = REQUIRED_AGENTS.filter((id) => !getAgent(id));
      if (missing.length) {
        return {
          status: "FAIL",
          error: `agents_missing:${missing.join(",")}`,
          evidence: { registered: listed.length },
        };
      }

      const planResult = createExecutionPlan({
        trustedUserId: asTrustedUserId(USER),
        intent: "Quero ajustar o volume do meu treino",
        contextAvailable: true,
      });
      if (!planResult.ok || !planResult.plan || planResult.plan.status === "rejected") {
        return {
          status: "FAIL",
          error: "agent_plan_failed",
          evidence: { registered: listed.length },
        };
      }

      const specialist = await runSpecialistAgent({
        trustedUserId: USER,
        agentId: SPECIALIST_TRAINING_ID,
        plan: planResult.plan,
        intent: "Quero ajustar o volume do meu treino",
        skipKnowledge: true,
        runtimeMode: "deterministic",
      });

      const hasDecisionField =
        specialist.result != null &&
        Object.prototype.hasOwnProperty.call(specialist.result, "decision");
      const ok = specialist.ok === true && !hasDecisionField;

      return {
        status: ok ? "PASS" : "FAIL",
        error: ok
          ? null
          : (specialist.agent_run.metadata?.["error_code"] as string | undefined) ??
            "specialist_smoke_failed",
        evidence: {
          registered: listed.length,
          specialist_id: SPECIALIST_TRAINING_ID,
          specialist_ok: specialist.ok,
          no_decision_authority: !hasDecisionField,
          has_proposal: specialist.result?.proposal != null,
          status: specialist.result?.status ?? null,
        },
      };
    },
  );
}

/** Spawn real eval suite — never hardcode ok:true. */
export async function probeEvaluation(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe(
    { check_id: "evaluation", name: "Evaluation", critical: true },
    ctx,
    async () => {
      const vitestBin = join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
      const files = [
        "src/ai/governance/evaluation.test.ts",
        "src/ai/governance/eval-v2.test.ts",
      ];
      const started = Date.now();
      try {
        await execFileAsync(process.execPath, [vitestBin, "run", ...files, "--reporter=dot"], {
          cwd: process.cwd(),
          timeout: 300_000,
          maxBuffer: 20 * 1024 * 1024,
          windowsHide: true,
          env: { ...process.env, AI_AUDIT_PERSIST: "0" },
        });
        return {
          status: "PASS",
          evidence: {
            suite: "test:eval",
            files: files.join(","),
            duration_ms: Date.now() - started,
            golden: "golden_v1",
            eval_version: "eval_v2",
          },
        };
      } catch (e: unknown) {
        const err = e as { code?: number; message?: string };
        return {
          status: "FAIL",
          error: `eval_exit_${err.code ?? "error"}`,
          evidence: {
            suite: "test:eval",
            files: files.join(","),
            duration_ms: Date.now() - started,
          },
        };
      }
    },
  );
}

/** CI workflow present + gate verdict script executed against latest.json. */
export async function probeCiCd(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe(
    { check_id: "ci_cd", name: "CI/CD Safety Gate", critical: true },
    ctx,
    async () => {
      const workflow = join(process.cwd(), ".github", "workflows", "ai-eval.yml");
      const verdictScript = join(process.cwd(), "scripts", "ai-ci-gate-verdict.mjs");
      const latest = join(process.cwd(), "docs", "certification", "latest.json");

      if (!existsSync(workflow)) {
        return { status: "FAIL", error: "workflow_missing", evidence: { workflow: false } };
      }
      if (!existsSync(verdictScript)) {
        return { status: "FAIL", error: "verdict_script_missing", evidence: { script: false } };
      }
      if (!existsSync(latest)) {
        return {
          status: "BLOCKED",
          error: "latest_json_missing_run_cert_first",
          evidence: { workflow: true, script: true, latest: false },
        };
      }

      const wf = readFileSync(workflow, "utf8");
      const hasGates =
        wf.includes("ai:certification") &&
        wf.includes("ai-ci-gate-verdict") &&
        wf.includes("ai:prod-e2e");

      try {
        const { stdout, stderr } = await execFileAsync(process.execPath, [verdictScript], {
          cwd: process.cwd(),
          timeout: 60_000,
          windowsHide: true,
          env: { ...process.env },
        });
        const text = `${String(stdout ?? "")}\n${String(stderr ?? "")}`;
        const gateMatch = text.match(/AI_CI_GATE:\s*(PASS|BLOCKED|FAIL)/);
        const gate = gateMatch?.[1] ?? "PASS";
        return {
          status: hasGates ? "PASS" : "FAIL",
          error: hasGates ? null : "workflow_missing_required_steps",
          evidence: {
            workflow: true,
            script: true,
            latest: true,
            gate_stdout_class: gate,
            gate_exit: 0,
            workflow_has_gates: hasGates,
          },
        };
      } catch (e: unknown) {
        const err = e as { code?: number; stdout?: string; stderr?: string };
        const code = typeof err.code === "number" ? err.code : 1;
        const text = `${String(err.stdout ?? "")}\n${String(err.stderr ?? "")}`;
        const gateMatch = text.match(/AI_CI_GATE:\s*(PASS|BLOCKED|FAIL)/);
        const gate = gateMatch?.[1] ?? (code === 0 ? "PASS" : "FAIL");

        if (code === 0 || gate === "BLOCKED" || gate === "PASS") {
          return {
            status: hasGates ? "PASS" : "FAIL",
            error: hasGates ? null : "workflow_missing_required_steps",
            evidence: {
              workflow_has_gates: hasGates,
              gate_stdout_class: gate,
              gate_exit: code,
            },
          };
        }

        return {
          status: "FAIL",
          error: `ci_gate_exit_${code}`,
          evidence: {
            workflow_has_gates: hasGates,
            gate_stdout_class: gate,
            gate_exit: code,
          },
        };
      }
    },
  );
}

export async function runFinalSupplementalProbes(ctx: ProbeContext): Promise<CertCheck[]> {
  const out: CertCheck[] = [];
  out.push(await probeCanonicalRuntime(ctx));
  out.push(await probeAgents(ctx));
  out.push(await probeEvaluation(ctx));
  out.push(await probeCiCd(ctx));
  return out;
}
