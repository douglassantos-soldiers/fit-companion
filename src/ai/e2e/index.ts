/**
 * FASE 15 / 22.1 — E2E harness public surface (TEST ONLY).
 * Prefer `@/ai/runtime` for production (runProductionAiRuntime / runAuthoritativeBridge).
 * FASE 22.12: real production smoke is `runProductionE2E` — not this harness.
 */
export {
  mapLayerErrorToPipeline,
  stageOk,
  stageFail,
  toPipelineError,
  type AiPipelineErrorCode,
  type AiPipelineError,
  type PipelineStage,
  type PipelineStageResult,
} from "@/ai/e2e/errors";

export { buildAiExecutionTrace, type AiExecutionTrace, type BuildAiExecutionTraceOpts } from "@/ai/e2e/trace";

/** @deprecated Import from `@/ai/runtime` — CANONICAL location. */
export {
  runAuthoritativeBridge,
  type AuthoritativeBridgeInput,
  type AuthoritativeBridgeResult,
} from "@/ai/runtime/authoritative-bridge";

/** @classification TEST_ONLY — does NOT prove remote DB/RAG/Memory/Audit. Use runProductionE2E. */
export {
  runAiE2EPipeline,
  type RunAiE2EPipelineInput,
  type RunAiE2EPipelineResult,
  type AiE2EInject,
} from "@/ai/e2e/run-pipeline";

/** @classification PRODUCTION_E2E — FASE 22.12 real stores or BLOCKED */
export {
  runProductionE2E,
  type ProductionE2EReport,
  type RunProductionE2EOpts,
} from "@/ai/e2e/production-e2e";