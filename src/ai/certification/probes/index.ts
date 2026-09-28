/**
 * FASE 22.7 — Real certification probes. Each probe executes work and returns evidence.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  assertDiagnosticOwnership,
  parseListIgnoresClientUserId,
} from "@/ai/certification/ownership";
import { verifyAiDatabaseReadiness } from "@/ai/certification/verify-migrations.server";
import { AI_REQUIRED_MIGRATIONS } from "@/ai/certification/ai-schema-inventory";
import { runProbe, type ProbeContext } from "@/ai/certification/probes/run-probe";
import type { CertCheck } from "@/ai/certification/types";
import { classifyAuditDurability } from "@/ai/governance/durability";
import { recordCriticalAudit, stableCriticalAuditId } from "@/ai/governance/audit";
import { isSensitiveKey, redactForAudit, redactSummary } from "@/ai/governance/redact";
import { setAiAuditPersistDbForTests } from "@/ai/governance/persist.server";
import { invokeTool } from "@/ai/mcp/core/invoke";
import { registerAllMcpTools } from "@/ai/mcp/register";
import { registerAllSkills } from "@/ai/skills/register";
import { listSkills, runSkill, type SkillCallTool } from "@/ai/skills";
import { getRagReadiness } from "@/ai/rag/health";
import { getMemoryReadiness } from "@/ai/memory/health";
import { getLlmReadiness } from "@/ai/gateway/health";
import { checkAiRateLimits } from "@/ai/runtime/rate-limit";
import { forceDeterministicRuntime, resolveEffectiveRuntimeMode } from "@/ai/runtime/rollback";
import { assertCostBounds } from "@/ai/runtime/cost-bounds";
import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import { buildQaScenario } from "@/lib/qa/scenarios";
import {
  buildProposalId,
  resolveProposalAgainstEngine,
  validateProposalAgainstSafety,
  validateProposalContext,
} from "@/lib/engine/decision-proposal";
import { runAuthoritativeBridge } from "@/ai/runtime/authoritative-bridge";

const UUID = "11111111-1111-4111-8111-111111111111";

function readinessToStatus(
  ready: boolean,
  reasons: string[],
): "PASS" | "DEGRADED" | "BLOCKED" | "FAIL" {
  if (ready) return "PASS";
  const joined = reasons.join(" ").toLowerCase();
  if (
    joined.includes("unavailable") ||
    joined.includes("admin_db") ||
    joined.includes("permission") ||
    joined.includes("requires_supabase") ||
    joined.includes("production_forbids")
  ) {
    return "BLOCKED";
  }
  if (reasons.length > 0) return "DEGRADED";
  return "FAIL";
}

export async function probeIdentity(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe({ check_id: "identity", name: "Identity", critical: true }, ctx, async () => {
    const p = parseListIgnoresClientUserId({
      deviceId: "device-abcdefgh",
      userId: "attacker-forged-id",
    });
    if (!p.clientUserIdIgnored) {
      return { status: "FAIL", error: "client_user_id_not_ignored", evidence: {} };
    }
    const own = assertDiagnosticOwnership({
      trustedUserId: "user_a",
      auditUserIds: ["user_b"],
      agentUserId: "user_b",
    });
    if (own.ok) {
      return { status: "FAIL", error: "cross_user_not_forbidden", evidence: {} };
    }
    return {
      status: "PASS",
      evidence: { client_user_ignored: true, cross_user_forbidden: true },
    };
  });
}

export async function probeAuthorization(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe(
    { check_id: "authorization", name: "Authorization", critical: true },
    ctx,
    async () => {
      registerAllMcpTools();
      const res = await invokeTool({
        toolId: "admin_wipe_everything",
        trustedUserId: "user_cert_authz",
        agentId: "specialist_training",
        input: {},
      });
      if (res.ok) {
        return { status: "FAIL", error: "unauthorized_tool_allowed", evidence: { ok: true } };
      }
      return {
        status: "PASS",
        evidence: { unauthorized_tool_denied: true, tool: "admin_wipe_everything" },
      };
    },
  );
}

export async function probeContext(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe({ check_id: "context", name: "Context", critical: false }, ctx, async () => {
    const date = "2026-03-11";
    const state = { ...buildQaScenario("healthy_full", { date }), userId: UUID };
    const snap = assembleDecisionContext(state, {
      date,
      userId: UUID,
      source: "offline_legacy",
    });
    if (!snap) {
      return { status: "FAIL", error: "assemble_context_null", evidence: {} };
    }
    return {
      status: "PASS",
      evidence: {
        fingerprint: snap.inputFingerprint.slice(0, 24),
        training_mode: snap.decisions.trainingMode,
      },
    };
  });
}

export async function probeSafety(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe({ check_id: "safety", name: "Safety", critical: true }, ctx, async () => {
    const date = "2026-03-11";
    const state = { ...buildQaScenario("healthy_full", { date }), userId: UUID };
    const snap = assembleDecisionContext(state, {
      date,
      userId: UUID,
      source: "offline_legacy",
    });
    if (!snap) return { status: "FAIL", error: "no_snapshot", evidence: {} };

    // Force escalateCare so FULL_WORKOUT must be rejected (engine contract).
    const escalated = {
      ...snap,
      safety: { ...snap.safety, escalateCare: true, ok: false },
    };

    const created_at = new Date().toISOString();
    const unsafe = {
      proposal_id: buildProposalId({
        userId: UUID,
        proposedType: "FULL_WORKOUT",
        proposedValue: "full",
        createdAt: created_at,
      }),
      user_id: UUID,
      context_id: escalated.inputFingerprint,
      proposed_type: "FULL_WORKOUT" as const,
      proposed_value: "full" as const,
      reason_codes: ["escalate_care" as const],
      confidence: 0.9,
      source: "agent" as const,
      created_at,
    };
    const safety = validateProposalAgainstSafety(unsafe, escalated.safety);
    if (safety.ok) {
      return { status: "FAIL", error: "unsafe_proposal_accepted", evidence: {} };
    }
    return {
      status: "PASS",
      evidence: { rejected: true, reason: safety.reason ?? "safety_rejection" },
    };
  });
}

export async function probeDecisionEngine(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe(
    { check_id: "decision_engine", name: "Decision Engine", critical: true },
    ctx,
    async () => {
      const date = "2026-03-11";
      const state = { ...buildQaScenario("healthy_full", { date }), userId: UUID };
      const snap = assembleDecisionContext(state, {
        date,
        userId: UUID,
        source: "offline_legacy",
      });
      if (!snap) return { status: "FAIL", error: "no_snapshot", evidence: {} };

      const mode = snap.decisions.trainingMode;
      const proposed_type =
        mode === "rest"
          ? "REST"
          : mode === "deload"
            ? "DELOAD"
            : mode === "express"
              ? "EXPRESS_WORKOUT"
              : "FULL_WORKOUT";
      const created_at = new Date().toISOString();
      const forgedValue = "__FORGED_PROPOSED_VALUE__";
      const proposal = {
        proposal_id: buildProposalId({
          userId: UUID,
          proposedType: proposed_type,
          proposedValue: forgedValue,
          createdAt: created_at,
        }),
        user_id: UUID,
        context_id: snap.inputFingerprint,
        proposed_type,
        proposed_value: forgedValue,
        reason_codes: ["progression_ready" as const],
        confidence: 0.8,
        source: "coach" as const,
        created_at,
      };

      const resolved = resolveProposalAgainstEngine(proposal, snap);
      if (!resolved.ok || !resolved.decision) {
        // Aligned value mismatch may reject — try with engine-aligned value
        const aligned = {
          ...proposal,
          proposed_value: mode,
          proposal_id: buildProposalId({
            userId: UUID,
            proposedType: proposed_type,
            proposedValue: mode,
            createdAt: created_at,
          }),
        };
        const r2 = resolveProposalAgainstEngine(aligned, snap);
        if (!r2.ok || !r2.decision) {
          return {
            status: "FAIL",
            error: r2.rejection_reason ?? "decision_failed",
            evidence: {},
          };
        }
        const copied = JSON.stringify(r2.decision).includes(forgedValue);
        if (copied) {
          return { status: "FAIL", error: "proposed_value_leaked_into_decision", evidence: {} };
        }
        return {
          status: "PASS",
          evidence: {
            decision_id: r2.decision.decision_id,
            decision_type: r2.decision.decision_type,
            forged_not_copied: true,
          },
        };
      }
      const copied = JSON.stringify(resolved.decision).includes(forgedValue);
      if (copied) {
        return { status: "FAIL", error: "proposed_value_leaked_into_decision", evidence: {} };
      }
      return {
        status: "PASS",
        evidence: {
          decision_id: resolved.decision.decision_id,
          forged_not_copied: true,
        },
      };
    },
  );
}

export async function probeProposalContract(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe(
    { check_id: "proposal_contract", name: "Proposal Contract", critical: true },
    ctx,
    async () => {
      const date = "2026-03-11";
      const state = { ...buildQaScenario("healthy_full", { date }), userId: UUID };
      const snap = assembleDecisionContext(state, {
        date,
        userId: UUID,
        source: "offline_legacy",
      });
      if (!snap) return { status: "FAIL", error: "no_snapshot", evidence: {} };
      const created_at = new Date().toISOString();
      const bad = {
        proposal_id: buildProposalId({
          userId: UUID,
          proposedType: "FULL_WORKOUT",
          proposedValue: "full",
          createdAt: created_at,
        }),
        user_id: UUID,
        context_id: "wrong_fingerprint",
        proposed_type: "FULL_WORKOUT" as const,
        proposed_value: "full" as const,
        reason_codes: ["progression_ready" as const],
        confidence: 0.8,
        source: "coach" as const,
        created_at,
      };
      const ctxCheck = validateProposalContext(bad, snap);
      if (ctxCheck.ok) {
        return { status: "FAIL", error: "invalid_context_accepted", evidence: {} };
      }
      return {
        status: "PASS",
        evidence: { invalid_context_rejected: true, reason: ctxCheck.reason ?? null },
      };
    },
  );
}

export async function probeTools(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe({ check_id: "tools", name: "Tools", critical: true }, ctx, async () => {
    registerAllMcpTools();
    const denied = await invokeTool({
      toolId: "admin_wipe_everything",
      trustedUserId: UUID,
      agentId: "specialist_training",
      input: {},
    });
    if (denied.ok) {
      return { status: "FAIL", error: "deny_path_failed", evidence: {} };
    }
    return {
      status: "PASS",
      evidence: { deny_ok: true },
    };
  });
}

export async function probeSkills(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe({ check_id: "skills", name: "Skills", critical: false }, ctx, async () => {
    registerAllSkills({ force: true });
    const skills = listSkills();
    if (skills.length < 1) {
      return { status: "FAIL", error: "no_skills_registered", evidence: { count: 0 } };
    }
    const mockCallTool: SkillCallTool = async () => ({
      ok: true,
      data: { items: [] },
    });
    const res = await runSkill({
      skillId: "analyze_training",
      trustedUserId: "user-skill-cert",
      input: { date: "2026-03-11" },
      callTool: mockCallTool,
    });
    if (!res.ok) {
      return {
        status: "FAIL",
        error: res.error_code ?? res.error_message ?? "skill_failed",
        evidence: { skill_count: skills.length },
      };
    }
    return {
      status: "PASS",
      evidence: { skill_count: skills.length, ran: "analyze_training" },
    };
  });
}

export async function probeRag(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe({ check_id: "rag", name: "RAG", critical: true }, ctx, async () => {
    const ready = await getRagReadiness();
    const status = readinessToStatus(ready.RAG_READY, ready.reasons);
    return {
      status,
      evidence: {
        RAG_READY: ready.RAG_READY,
        environment: ready.health.environment,
        store_id: ready.health.store_id,
        reasons: ready.reasons.join("|") || null,
      },
      error: ready.RAG_READY ? null : ready.reasons.join("; ") || "rag_not_ready",
    };
  });
}

export async function probeMemory(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe({ check_id: "memory", name: "Memory", critical: true }, ctx, async () => {
    const ready = await getMemoryReadiness();
    const status = readinessToStatus(ready.MEMORY_READY, ready.reasons);
    return {
      status,
      evidence: {
        MEMORY_READY: ready.MEMORY_READY,
        environment: ready.health.environment,
        store_id: ready.health.store_id,
        reasons: ready.reasons.join("|") || null,
      },
      error: ready.MEMORY_READY ? null : ready.reasons.join("; ") || "memory_not_ready",
    };
  });
}

export async function probeLlm(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe({ check_id: "llm", name: "LLM Gateway", critical: true }, ctx, async () => {
    const ready = await getLlmReadiness();
    const status = readinessToStatus(ready.LLM_READY, ready.reasons);
    return {
      status,
      evidence: {
        LLM_READY: ready.LLM_READY,
        environment: ready.health.environment,
        primary: ready.health.primary,
        reasons: ready.reasons.join("|") || null,
      },
      error: ready.LLM_READY ? null : ready.reasons.join("; ") || "llm_not_ready",
    };
  });
}

export async function probeAudit(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe({ check_id: "audit", name: "Audit", critical: true }, ctx, async () => {
    const prev = process.env["AI_AUDIT_PERSIST"];
    process.env["AI_AUDIT_PERSIST"] = "1";
    const store = new Map<string, Record<string, unknown>>();
    setAiAuditPersistDbForTests(async () => ({
      from: () => ({
        upsert: async (row: Record<string, unknown>) => {
          store.set(String(row["audit_id"]), row);
          return { error: null };
        },
      }),
    }));
    try {
      const decisionId = "dec_cert_audit";
      const r = await recordCriticalAudit({
        kind: "decision",
        audit_id: stableCriticalAuditId("decision", decisionId),
        user_id: UUID,
        subject_id: decisionId,
        decision_id: decisionId,
        run_id: "run_cert_audit",
        status: "resolved",
        summary: "Bearer sk-certleak12345678",
        metadata: { api_key: "secret", safe: "ok" },
      });
      if (!r.persisted) {
        return {
          status: "FAIL",
          error: "error" in r ? r.error : "not_persisted",
          evidence: { persisted: false },
        };
      }
      if (r.event.metadata?.["api_key"] !== "[REDACTED]") {
        return { status: "FAIL", error: "secrets_not_redacted", evidence: {} };
      }
      if (r.event.summary?.includes("sk-certleak")) {
        return { status: "FAIL", error: "summary_not_redacted", evidence: {} };
      }
      const dur = classifyAuditDurability(r.event);
      if (dur !== "critical") {
        return { status: "FAIL", error: "decision_not_critical", evidence: { dur } };
      }
      void redactSummary("password=abc");
      void redactForAudit({ service_role: "x" });
      if (!isSensitiveKey("access_token")) {
        return { status: "FAIL", error: "sensitive_key_miss", evidence: {} };
      }
      return {
        status: "PASS",
        evidence: {
          persisted: true,
          audit_id: r.audit_id,
          durability: dur,
          store_size: store.size,
        },
      };
    } finally {
      setAiAuditPersistDbForTests(null);
      if (prev === undefined) delete process.env["AI_AUDIT_PERSIST"];
      else process.env["AI_AUDIT_PERSIST"] = prev;
    }
  });
}

export async function probeDatabase(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe({ check_id: "database", name: "Database", critical: true }, ctx, async () => {
    const ready = await verifyAiDatabaseReadiness({ persistPath: null });
    if (ready.verdict === "PASS") {
      return {
        status: "PASS",
        evidence: {
          verdict: ready.verdict,
          check_count: ready.checks.length,
          critical_drift: ready.critical_drift.join(",") || "none",
        },
      };
    }
    if (ready.verdict === "BLOCKED" || ready.error_code === "MIGRATION_VERIFICATION_BLOCKED") {
      return {
        status: "BLOCKED",
        error: ready.error_code ?? "MIGRATION_VERIFICATION_BLOCKED",
        evidence: {
          verdict: ready.verdict,
          critical_drift: ready.critical_drift.join(","),
          sample: ready.checks
            .filter((c) => c.status !== "pass" && c.status !== "observed" && c.status !== "na")
            .slice(0, 8)
            .map((c) => `${c.object}:${c.expected}:${c.status}`)
            .join("|"),
        },
      };
    }
    return {
      status: "FAIL",
      error: "database_schema_drift",
      evidence: {
        verdict: ready.verdict,
        critical_drift: ready.critical_drift.join(","),
      },
    };
  });
}

export async function probeRateLimit(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe(
    { check_id: "rate_limit", name: "Rate Limit", critical: false },
    ctx,
    async () => {
      const { verifyAiRateLimitReadiness } = await import(
        "@/ai/certification/verify-rate-limit-readiness.server"
      );
      const { SharedMemoryRateLimitStore } = await import("@/ai/runtime/rate-limit-store");
      const prev = process.env["AI_RL_USER_RPM"];
      process.env["AI_RL_USER_RPM"] = "2";
      try {
        const store = new SharedMemoryRateLimitStore();
        const userId = `rl_cert_${Date.now()}`;
        const a = await checkAiRateLimits({ userId }, store);
        const b = await checkAiRateLimits({ userId }, store);
        const c = await checkAiRateLimits({ userId }, store);
        if (!a.ok || !b.ok || c.ok) {
          return {
            status: "FAIL",
            error: "rate_limit_did_not_trip",
            evidence: { a: a.ok, b: b.ok, c: c.ok },
          };
        }
        const ready = await verifyAiRateLimitReadiness({ persistPath: null });
        if (ready.verdict === "FAIL") {
          return {
            status: "FAIL",
            error: "rate_limit_readiness_fail",
            evidence: { verdict: ready.verdict },
          };
        }
        return {
          status: ready.verdict === "PASS" ? "PASS" : "BLOCKED",
          evidence: {
            tripped: true,
            user_rpm: 2,
            readiness: ready.verdict,
            ...(ready.error_code ? { error_code: ready.error_code } : {}),
          },
          ...(ready.verdict === "BLOCKED"
            ? { error: ready.error_code ?? "RATE_LIMIT_VERIFICATION_BLOCKED" }
            : {}),
        };
      } finally {
        if (prev === undefined) delete process.env["AI_RL_USER_RPM"];
        else process.env["AI_RL_USER_RPM"] = prev;
      }
    },
  );
}

export async function probeKillSwitch(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe(
    { check_id: "kill_switch", name: "Kill Switch", critical: true },
    ctx,
    async () => {
      const prev = process.env["AI_FORCE_DETERMINISTIC"];
      const prevLlm = process.env["AI_LLM_ENABLED"];
      const prevGlobal = process.env["AI_GLOBAL_ENABLED"];
      const prevRag = process.env["RAG_ENABLED"];
      try {
        process.env["AI_FORCE_DETERMINISTIC"] = "1";
        process.env["AI_LLM_ENABLED"] = "1";
        const mode = resolveEffectiveRuntimeMode("llm");
        if (mode !== "deterministic") {
          return { status: "FAIL", error: "kill_switch_ineffective", evidence: { mode } };
        }
        if (!forceDeterministicRuntime()) {
          return { status: "FAIL", error: "force_deterministic_false", evidence: {} };
        }

        delete process.env["AI_FORCE_DETERMINISTIC"];
        process.env["AI_GLOBAL_ENABLED"] = "0";
        if (resolveEffectiveRuntimeMode("hybrid") !== "deterministic") {
          return { status: "FAIL", error: "global_kill_ineffective", evidence: {} };
        }

        delete process.env["AI_GLOBAL_ENABLED"];
        process.env["RAG_ENABLED"] = "0";
        const { isRagEnabled } = await import("@/ai/runtime/feature-flags");
        if (isRagEnabled()) {
          return { status: "FAIL", error: "rag_kill_ineffective", evidence: {} };
        }

        const { verifyKillSwitchReadiness } = await import(
          "@/ai/certification/verify-kill-switch-readiness.server"
        );
        // Clear kill envs before readiness self-test
        delete process.env["RAG_ENABLED"];
        delete process.env["AI_GLOBAL_ENABLED"];
        delete process.env["AI_FORCE_DETERMINISTIC"];
        const ready = await verifyKillSwitchReadiness({ persistPath: null });
        if (ready.verdict === "FAIL") {
          return {
            status: "FAIL",
            error: "kill_switch_readiness_fail",
            evidence: {
              failed: ready.checks
                .filter((c) => c.status === "fail")
                .map((c) => c.object)
                .join(","),
            },
          };
        }
        return {
          status: "PASS",
          evidence: {
            mode: "deterministic",
            force: true,
            global_alias: true,
            rag_alias: true,
            readiness: ready.verdict,
          },
        };
      } finally {
        if (prev === undefined) delete process.env["AI_FORCE_DETERMINISTIC"];
        else process.env["AI_FORCE_DETERMINISTIC"] = prev;
        if (prevLlm === undefined) delete process.env["AI_LLM_ENABLED"];
        else process.env["AI_LLM_ENABLED"] = prevLlm;
        if (prevGlobal === undefined) delete process.env["AI_GLOBAL_ENABLED"];
        else process.env["AI_GLOBAL_ENABLED"] = prevGlobal;
        if (prevRag === undefined) delete process.env["RAG_ENABLED"];
        else process.env["RAG_ENABLED"] = prevRag;
      }
    },
  );
}

export async function probeRollback(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe({ check_id: "rollback", name: "Rollback", critical: true }, ctx, async () => {
    const prev = process.env["AI_FORCE_DETERMINISTIC"];
    try {
      process.env["AI_FORCE_DETERMINISTIC"] = "1";
      const mode = resolveEffectiveRuntimeMode("hybrid");
      if (mode !== "deterministic") {
        return { status: "FAIL", error: "rollback_failed", evidence: { mode } };
      }
      return { status: "PASS", evidence: { effective_mode: mode } };
    } finally {
      if (prev === undefined) delete process.env["AI_FORCE_DETERMINISTIC"];
      else process.env["AI_FORCE_DETERMINISTIC"] = prev;
    }
  });
}

export async function probeMigrations(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe(
    { check_id: "migrations", name: "Migrations", critical: true },
    ctx,
    async () => {
      const migDir = join(process.cwd(), "supabase", "migrations");
      let files: string[] = [];
      try {
        files = readdirSync(migDir).filter((f) => f.endsWith(".sql"));
      } catch (e) {
        return {
          status: "FAIL",
          error: e instanceof Error ? e.message : String(e),
          evidence: {},
        };
      }
      const required = AI_REQUIRED_MIGRATIONS.map((m) => m.file);
      const missingFiles = required.filter((r) => !files.includes(r));
      if (missingFiles.length) {
        return {
          status: "FAIL",
          error: "migration_files_missing",
          evidence: { missing: missingFiles.join(","), file_count: files.length },
        };
      }
      const ready = await verifyAiDatabaseReadiness({ persistPath: null });
      if (ready.verdict === "PASS") {
        return {
          status: "PASS",
          evidence: {
            file_count: files.length,
            remote_verdict: ready.verdict,
            check_count: ready.checks.length,
          },
        };
      }
      if (ready.verdict === "BLOCKED" || ready.error_code === "MIGRATION_VERIFICATION_BLOCKED") {
        return {
          status: "BLOCKED",
          error: ready.error_code ?? "MIGRATION_VERIFICATION_BLOCKED",
          evidence: {
            files_ok: true,
            remote_verdict: ready.verdict,
            critical_drift: ready.critical_drift.join(","),
          },
        };
      }
      return {
        status: "FAIL",
        error: "remote_migrations_incomplete",
        evidence: {
          files_ok: true,
          remote_verdict: ready.verdict,
          critical_drift: ready.critical_drift.join(","),
        },
      };
    },
  );
}

export async function probeE2e(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe({ check_id: "e2e", name: "E2E Bridge", critical: true }, ctx, async () => {
    const { verifyProductionE2EReadiness } = await import(
      "@/ai/certification/verify-production-e2e-readiness.server"
    );
    const ready = await verifyProductionE2EReadiness({
      mode: "full",
      persistPath: null,
    });
    if (ready.verdict === "PASS") {
      return {
        status: "PASS",
        evidence: {
          production_e2e: "PASS",
          decision_id: ready.correlation.decision_id,
          run_id: ready.correlation.run_id,
        },
      };
    }
    if (ready.verdict === "BLOCKED" || ready.error_code === "PRODUCTION_E2E_BLOCKED") {
      // Local bridge still proves Decision Engine path when remote blocked
      const prev = process.env["AI_AUDIT_PERSIST"];
      process.env["AI_AUDIT_PERSIST"] = "0";
      try {
        const date = "2026-03-11";
        const state = { ...buildQaScenario("healthy_full", { date }), userId: UUID };
        const snap = assembleDecisionContext(state, {
          date,
          userId: UUID,
          source: "offline_legacy",
        });
        if (!snap?.livingPlan) {
          return {
            status: "BLOCKED",
            error: ready.error_code ?? "PRODUCTION_E2E_BLOCKED",
            evidence: { production_e2e: ready.verdict, local_bridge: "no_snapshot" },
          };
        }
        const mode = snap.decisions.trainingMode;
        const proposed_type =
          mode === "rest"
            ? "REST"
            : mode === "deload"
              ? "DELOAD"
              : mode === "express"
                ? "EXPRESS_WORKOUT"
                : "FULL_WORKOUT";
        const created_at = new Date().toISOString();
        const proposal = {
          proposal_id: buildProposalId({
            userId: UUID,
            proposedType: proposed_type,
            proposedValue: mode,
            createdAt: created_at,
          }),
          user_id: UUID,
          context_id: snap.inputFingerprint,
          proposed_type,
          proposed_value: mode,
          reason_codes: ["progression_ready" as const],
          confidence: 0.8,
          source: "coach" as const,
          created_at,
        };
        const bridge = await runAuthoritativeBridge({
          proposal,
          snapshot: snap,
          runId: "cert_e2e_bridge",
          emitOutcomeAndLearning: false,
        });
        if (!bridge.ok || !bridge.decision) {
          return {
            status: "FAIL",
            error: bridge.error_code ?? bridge.reason ?? "bridge_failed",
            evidence: { production_e2e: ready.verdict },
          };
        }
        return {
          status: "BLOCKED",
          error: ready.error_code ?? "PRODUCTION_E2E_BLOCKED",
          evidence: {
            production_e2e: ready.verdict,
            local_bridge_decision: bridge.decision.decision_id,
            note: "remote_stores_blocked_local_engine_ok",
          },
        };
      } finally {
        if (prev === undefined) delete process.env["AI_AUDIT_PERSIST"];
        else process.env["AI_AUDIT_PERSIST"] = prev;
      }
    }
    return {
      status: "FAIL",
      error: "production_e2e_fail",
      evidence: {
        verdict: ready.verdict,
        notes: ready.notes.join("|").slice(0, 200),
      },
    };
  });
}

export async function probeCost(ctx: ProbeContext): Promise<CertCheck> {
  return runProbe({ check_id: "cost", name: "Cost Bounds", critical: true }, ctx, async () => {
    const c = assertCostBounds();
    if (!c.ok) {
      return { status: "FAIL", error: c.notes.join("; ") || "cost_bounds", evidence: {} };
    }
    return {
      status: "PASS",
      evidence: {
        orchestrator_max: c.orchestrator.max_cost,
        gateway_max_tokens: c.gateway.max_tokens,
      },
    };
  });
}

/** Ordered registry of all required probes. */
export async function runAllProbes(ctx: ProbeContext): Promise<CertCheck[]> {
  const runners = [
    probeIdentity,
    probeAuthorization,
    probeContext,
    probeSafety,
    probeDecisionEngine,
    probeProposalContract,
    probeTools,
    probeSkills,
    probeRag,
    probeMemory,
    probeLlm,
    probeAudit,
    probeDatabase,
    probeRateLimit,
    probeKillSwitch,
    probeRollback,
    probeMigrations,
    probeE2e,
    probeCost,
  ];
  const out: CertCheck[] = [];
  for (const run of runners) {
    out.push(await run(ctx));
  }
  return out;
}
