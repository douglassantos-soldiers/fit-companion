/**
 * FASE 22.11 — Kill-switch readiness (local PASS/FAIL; no remote required).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertServerAuthoritativeFlags,
  getAiFeatureFlags,
  isAiEnabled,
  isLlmFeatureAllowed,
  isMemoryEnabled,
  isRagEnabled,
  isSpecialistsEnabled,
  isLearningEnabled,
} from "@/ai/runtime/feature-flags";
import { resolveEffectiveRuntimeMode, ROLLBACK_PROCEDURE } from "@/ai/runtime/rollback";

export type KillSwitchReadinessVerdict = "PASS" | "BLOCKED" | "FAIL";

export type KillSwitchReadinessReport = {
  report_version: "fase22_11_v1";
  checked_at: string;
  environment: string;
  verdict: KillSwitchReadinessVerdict;
  error_code?: "KILL_SWITCH_VERIFICATION_BLOCKED";
  checks: Array<{
    object: string;
    expected: string;
    actual: string;
    status: "pass" | "fail" | "blocked";
    detail?: string;
  }>;
};

const ENGINE_ALLOW_LEARNING = "src/lib/engine/learning/run-learning.ts";

function scanEngineForFeatureFlagImports(cwd: string): string[] {
  const engineDir = join(cwd, "src", "lib", "engine");
  const offenders: string[] = [];
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const name of entries) {
      const p = join(dir, name.name);
      if (name.isDirectory()) {
        walk(p);
        continue;
      }
      if (!name.name.endsWith(".ts") && !name.name.endsWith(".tsx")) continue;
      const rel = p.slice(cwd.length).replace(/^[/\\]/, "").replace(/\\/g, "/");
      if (rel === ENGINE_ALLOW_LEARNING) continue;
      const text = readFileSync(p, "utf8");
      if (/from\s+["']@\/ai\/runtime\/feature-flags["']/.test(text)) {
        offenders.push(rel);
      }
    }
  };
  walk(engineDir);
  return offenders;
}

export async function verifyKillSwitchReadiness(opts?: {
  environment?: string;
  persistPath?: string | null;
  cwd?: string;
}): Promise<KillSwitchReadinessReport> {
  const checked_at = new Date().toISOString();
  const environment =
    opts?.environment ?? process.env["AI_CERT_ENV"] ?? process.env["NODE_ENV"] ?? "unknown";
  const cwd = opts?.cwd ?? process.cwd();
  const checks: KillSwitchReadinessReport["checks"] = [];

  // Preserve env
  const saved: Record<string, string | undefined> = {};
  const keys = [
    "AI_GLOBAL_ENABLED",
    "AI_ENABLED",
    "AI_FORCE_DETERMINISTIC",
    "AI_LLM_ENABLED",
    "LLM_ENABLED",
    "AI_RAG_ENABLED",
    "RAG_ENABLED",
    "AI_SPECIALISTS_ENABLED",
    "SPECIALISTS_ENABLED",
    "AI_MEMORY_ENABLED",
    "MEMORY_ENABLED",
    "AI_LEARNING_ENABLED",
    "LEARNING_ENABLED",
    "AI_RUNTIME_MODE",
  ];
  for (const k of keys) saved[k] = process.env[k];

  const restore = () => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k]!;
    }
  };

  try {
    // Clear for clean defaults
    for (const k of keys) delete process.env[k];

    const auth = assertServerAuthoritativeFlags();
    checks.push({
      object: "server_authoritative",
      expected: "ok",
      actual: auth.ok ? "ok" : "fail",
      status: auth.ok ? "pass" : "fail",
    });

    try {
      assertServerAuthoritativeFlags({ clientFlags: { AI_ENABLED: false } });
      checks.push({
        object: "client_flags_rejected",
        expected: "throw",
        actual: "no_throw",
        status: "fail",
      });
    } catch {
      checks.push({
        object: "client_flags_rejected",
        expected: "throw",
        actual: "thrown",
        status: "pass",
      });
    }

    // Defaults
    const d = getAiFeatureFlags();
    const defaultsOk = d.ai_enabled && d.rag_enabled && d.memory_enabled && d.specialists_enabled;
    checks.push({
      object: "defaults_safe",
      expected: "ai_on_components_on",
      actual: defaultsOk ? "ok" : "bad",
      status: defaultsOk ? "pass" : "fail",
    });

    // Alias AI_GLOBAL_ENABLED
    process.env["AI_GLOBAL_ENABLED"] = "0";
    const globalOff = !isAiEnabled() && resolveEffectiveRuntimeMode("llm") === "deterministic";
    checks.push({
      object: "alias_AI_GLOBAL_ENABLED",
      expected: "off_deterministic",
      actual: globalOff ? "ok" : "fail",
      status: globalOff ? "pass" : "fail",
    });
    delete process.env["AI_GLOBAL_ENABLED"];

    // Alias RAG_ENABLED
    process.env["RAG_ENABLED"] = "0";
    const ragOff = !isRagEnabled();
    checks.push({
      object: "alias_RAG_ENABLED",
      expected: "off",
      actual: ragOff ? "ok" : "fail",
      status: ragOff ? "pass" : "fail",
    });
    delete process.env["RAG_ENABLED"];

    process.env["MEMORY_ENABLED"] = "0";
    checks.push({
      object: "alias_MEMORY_ENABLED",
      expected: "off",
      actual: !isMemoryEnabled() ? "ok" : "fail",
      status: !isMemoryEnabled() ? "pass" : "fail",
    });
    delete process.env["MEMORY_ENABLED"];

    process.env["SPECIALISTS_ENABLED"] = "0";
    checks.push({
      object: "alias_SPECIALISTS_ENABLED",
      expected: "off",
      actual: !isSpecialistsEnabled() ? "ok" : "fail",
      status: !isSpecialistsEnabled() ? "pass" : "fail",
    });
    delete process.env["SPECIALISTS_ENABLED"];

    process.env["LEARNING_ENABLED"] = "0";
    checks.push({
      object: "alias_LEARNING_ENABLED",
      expected: "off",
      actual: !isLearningEnabled() ? "ok" : "fail",
      status: !isLearningEnabled() ? "pass" : "fail",
    });
    delete process.env["LEARNING_ENABLED"];

    process.env["AI_FORCE_DETERMINISTIC"] = "1";
    process.env["AI_LLM_ENABLED"] = "1";
    const forced = resolveEffectiveRuntimeMode("hybrid") === "deterministic";
    checks.push({
      object: "force_deterministic",
      expected: "deterministic",
      actual: forced ? "ok" : "fail",
      status: forced ? "pass" : "fail",
    });
    delete process.env["AI_FORCE_DETERMINISTIC"];
    delete process.env["AI_LLM_ENABLED"];

    process.env["LLM_ENABLED"] = "0";
    process.env["AI_RUNTIME_MODE"] = "hybrid";
    const llmOff = !isLlmFeatureAllowed("hybrid");
    checks.push({
      object: "alias_LLM_ENABLED",
      expected: "off",
      actual: llmOff ? "ok" : "fail",
      status: llmOff ? "pass" : "fail",
    });
    delete process.env["LLM_ENABLED"];
    delete process.env["AI_RUNTIME_MODE"];

    checks.push({
      object: "rollback_procedure",
      expected: "4_steps",
      actual: String(ROLLBACK_PROCEDURE.length),
      status: ROLLBACK_PROCEDURE.length >= 4 ? "pass" : "fail",
    });

    const offenders = scanEngineForFeatureFlagImports(cwd);
    checks.push({
      object: "engine_isolation",
      expected: "no_feature_flags_except_learning",
      actual: offenders.length === 0 ? "ok" : offenders.join(","),
      status: offenders.length === 0 ? "pass" : "fail",
      ...(offenders.length ? { detail: offenders.join("|") } : {}),
    });

    const doc = join(cwd, "docs", "AI_KILL_SWITCH.md");
    checks.push({
      object: "docs",
      expected: "AI_KILL_SWITCH.md",
      actual: existsSync(doc) ? "present" : "absent",
      status: existsSync(doc) ? "pass" : "fail",
    });
  } finally {
    restore();
  }

  const failed = checks.some((c) => c.status === "fail");
  const verdict: KillSwitchReadinessVerdict = failed ? "FAIL" : "PASS";

  const report: KillSwitchReadinessReport = {
    report_version: "fase22_11_v1",
    checked_at,
    environment,
    verdict,
    checks,
  };

  if (opts?.persistPath !== null) {
    const path =
      opts?.persistPath ??
      join(cwd, "docs", "certification", "kill-switch-readiness.json");
    try {
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, JSON.stringify(report, null, 2), "utf8");
    } catch {
      /* ignore */
    }
  }

  return report;
}
