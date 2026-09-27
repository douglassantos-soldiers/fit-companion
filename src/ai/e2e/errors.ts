/**
 * FASE 15 — canonical AI pipeline error taxonomy.
 * Normalize layer errors at the harness boundary; do not rewrite each layer.
 */

export type AiPipelineErrorCode =
  | "authentication_error"
  | "authorization_error"
  | "context_error"
  | "tool_error"
  | "skill_error"
  | "rag_error"
  | "memory_error"
  | "proposal_error"
  | "safety_rejection"
  | "decision_error"
  | "persistence_error"
  | "evaluation_error";

export type PipelineStage =
  | "identity"
  | "context"
  | "orchestrator"
  | "agent"
  | "skill"
  | "tool"
  | "rag"
  | "memory"
  | "proposal"
  | "safety"
  | "decision"
  | "living_plan"
  | "outcome"
  | "learning"
  | "audit"
  | "evaluation";

export type PipelineStageResult = {
  stage: PipelineStage;
  ok: boolean;
  /** Always true — failures must be observable, never silent. */
  observable: true;
  code?: AiPipelineErrorCode;
  message?: string;
  run_id?: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type AiPipelineError = {
  code: AiPipelineErrorCode;
  stage: PipelineStage;
  message: string;
  observable: true;
  run_id?: string;
};

const AUTH_CODES = new Set([
  "anonymous_denied",
  "authentication_required",
  "invalid_trusted_user_id",
]);

const AUTHZ_CODES = new Set([
  "unauthorized_tool",
  "tool_not_allowed",
  "forged_user_context",
  "admin_permission_required",
  "write_not_enabled",
  "unauthorized",
]);

/** Map a layer error_code / reason string → pipeline taxonomy. */
export function mapLayerErrorToPipeline(
  layerCode: string | undefined | null,
  hint?: PipelineStage,
): AiPipelineErrorCode {
  const c = (layerCode ?? "").trim().toLowerCase();
  if (!c) {
    if (hint === "safety") return "safety_rejection";
    if (hint === "context") return "context_error";
    if (hint === "decision") return "decision_error";
    if (hint === "proposal") return "proposal_error";
    if (hint === "rag") return "rag_error";
    if (hint === "memory") return "memory_error";
    if (hint === "tool") return "tool_error";
    if (hint === "skill") return "skill_error";
    if (hint === "evaluation") return "evaluation_error";
    if (hint === "living_plan" || hint === "outcome" || hint === "learning") {
      return "persistence_error";
    }
    return "decision_error";
  }

  if (AUTH_CODES.has(c) || c.includes("anonymous") || c.includes("authentication")) {
    return "authentication_error";
  }
  if (AUTHZ_CODES.has(c) || c.includes("unauthorized") || c.includes("forged_user")) {
    return "authorization_error";
  }
  if (
    c.includes("safety") ||
    c === "escalate_requires_rest_aligned" ||
    c === "blocked_by_safety" ||
    c === "bias_blocked"
  ) {
    return "safety_rejection";
  }
  if (
    c.includes("proposal") ||
    c === "invalid_proposal" ||
    c === "user_mismatch" ||
    c === "context_fingerprint_mismatch" ||
    c.startsWith("conflicts_with_training_mode")
  ) {
    return "proposal_error";
  }
  if (
    c.includes("context") ||
    c === "insufficient_context" ||
    c === "missing_context" ||
    c === "no_profile"
  ) {
    return "context_error";
  }
  if (c.includes("rag") || c.includes("knowledge") || c.includes("retrieval")) {
    return "rag_error";
  }
  if (c.includes("memory")) return "memory_error";
  if (c.includes("skill")) return "skill_error";
  if (c.includes("tool") || c === "timeout" || c === "tool_failed") return "tool_error";
  if (c.includes("eval")) return "evaluation_error";
  if (c.includes("persist") || c.includes("living_plan") || c.includes("db_")) {
    return "persistence_error";
  }
  if (c.includes("decision") || c === "assemble_failed") return "decision_error";
  return hint ? mapLayerErrorToPipeline(null, hint) : "decision_error";
}

export function stageOk(
  stage: PipelineStage,
  meta?: Record<string, string | number | boolean | null>,
  runId?: string,
): PipelineStageResult {
  const r: PipelineStageResult = { stage, ok: true, observable: true };
  if (runId) r.run_id = runId;
  if (meta) r.meta = meta;
  return r;
}

export function stageFail(
  stage: PipelineStage,
  code: AiPipelineErrorCode,
  message: string,
  runId?: string,
  meta?: Record<string, string | number | boolean | null>,
): PipelineStageResult {
  const r: PipelineStageResult = {
    stage,
    ok: false,
    observable: true,
    code,
    message,
  };
  if (runId) r.run_id = runId;
  if (meta) r.meta = meta;
  return r;
}

export function toPipelineError(stage: PipelineStageResult): AiPipelineError | null {
  if (stage.ok || !stage.code) return null;
  const err: AiPipelineError = {
    code: stage.code,
    stage: stage.stage,
    message: stage.message ?? stage.code,
    observable: true,
  };
  if (stage.run_id) err.run_id = stage.run_id;
  return err;
}
