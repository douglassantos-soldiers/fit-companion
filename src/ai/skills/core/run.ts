/**
 * Skills Framework — runSkill pipeline.
 * Agent → Skill → Tools (MCP) → SkillResult / SkillProposal
 * Never Skill → Database.
 */
import type { SkillResult } from "@/ai/contracts/skill-result";
import type { SkillRun } from "@/ai/contracts/skill-run";
import { asTrustedUserId } from "@/ai/contracts/trusted-user-id";
import { validateToolInput } from "@/ai/mcp/core/validate";
import { SKILL_ERROR } from "@/ai/skills/core/errors";
import { getSkill } from "@/ai/skills/core/registry";
import { recordSkillRun } from "@/ai/skills/core/skill-run-log";
import { createToolBridge } from "@/ai/skills/core/tool-bridge";
import type { SkillInvokeRequest, SkillInvokeResult } from "@/ai/skills/core/types";
import { todayKey } from "@/lib/types";

function newSkillRunId(): string {
  return `sr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isSkillResult(raw: unknown): raw is SkillResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  return (
    "result" in o &&
    Array.isArray(o["evidence"]) &&
    typeof o["confidence"] === "number" &&
    Array.isArray(o["warnings"])
  );
}

export async function runSkill(req: SkillInvokeRequest): Promise<SkillInvokeResult> {
  const created_at = new Date().toISOString();
  const started = Date.now();
  const skill_run_id = newSkillRunId();
  const agent_id = req.agentId ?? "system";
  const run_id = req.runId ?? `run_${skill_run_id}`;
  const skill = getSkill(req.skillId);

  const baseRun = (): SkillRun => ({
    skill_run_id,
    skill_id: req.skillId,
    run_id,
    agent_id,
    user_id: req.trustedUserId ?? "",
    status: "queued",
    created_at,
  });

  const finish = (
    partial: Omit<SkillInvokeResult, "skill_run"> & { skill_run?: Partial<SkillRun> },
  ): SkillInvokeResult => {
    const latency_ms = Date.now() - started;
    const run: SkillRun = {
      ...baseRun(),
      ...partial.skill_run,
      status: partial.status,
      latency_ms,
      finished_at: new Date().toISOString(),
      started_at: created_at,
    };
    if (partial.error_code) run.error_code = partial.error_code;
    if (partial.error_message) run.error_message = partial.error_message;
    recordSkillRun(run);
    const out: SkillInvokeResult = {
      ok: partial.ok,
      status: partial.status,
      skill_run: run,
    };
    if (partial.data !== undefined) out.data = partial.data;
    if (partial.error_code) out.error_code = partial.error_code;
    if (partial.error_message) out.error_message = partial.error_message;
    return out;
  };

  if (!skill) {
    return finish({
      ok: false,
      status: "failed",
      error_code: SKILL_ERROR.UNKNOWN_SKILL,
      error_message: "unknown_or_unregistered_skill",
    });
  }

  const rawUser = req.trustedUserId?.trim() ?? "";
  if (!rawUser) {
    return finish({
      ok: false,
      status: "denied",
      error_code: SKILL_ERROR.ANONYMOUS_DENIED,
      error_message: "authentication_required",
    });
  }

  let userId;
  try {
    userId = asTrustedUserId(rawUser);
  } catch {
    return finish({
      ok: false,
      status: "denied",
      error_code: SKILL_ERROR.INVALID_TRUSTED_USER,
      error_message: "invalid_trusted_user_id",
    });
  }

  const validated = validateToolInput(req.input ?? {}, skill.input_schema);
  if (!validated.ok) {
    return finish({
      ok: false,
      status: "failed",
      error_code: SKILL_ERROR.INVALID_INPUT,
      error_message: validated.error_message,
      skill_run: { user_id: userId },
    });
  }

  const date =
    (typeof validated.value["date"] === "string" && validated.value["date"]) ||
    req.date ||
    todayKey();

  const callTool =
    req.callTool ??
    createToolBridge({
      userId,
      date,
      agentId: agent_id,
      runId: run_id,
      ...(req.loader ? { loader: req.loader } : {}),
    });

  try {
    const data = await skill.execute(
      { userId, date, callTool, skillId: skill.id },
      validated.value,
    );
    if (!isSkillResult(data)) {
      return finish({
        ok: false,
        status: "failed",
        error_code: SKILL_ERROR.INVALID_OUTPUT,
        error_message: "skill_result_shape_invalid",
        skill_run: { user_id: userId },
      });
    }
    const conf = Math.max(0, Math.min(1, data.confidence));
    const normalized: SkillResult = {
      result: data.result,
      evidence: data.evidence,
      confidence: conf,
      warnings: data.warnings,
    };
    if (data.proposal) normalized.proposal = data.proposal;
    return finish({
      ok: true,
      status: "completed",
      data: normalized,
      skill_run: {
        user_id: userId,
        output_summary: {
          confidence: conf,
          has_proposal: Boolean(data.proposal),
          warnings: data.warnings.length,
        },
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return finish({
      ok: false,
      status: "failed",
      error_code: SKILL_ERROR.SKILL_FAILED,
      error_message: msg.slice(0, 200),
      skill_run: { user_id: userId },
    });
  }
}
