/**
 * FASE 15 — E2E harness public surface.
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

export {
  runAuthoritativeBridge,
  type AuthoritativeBridgeInput,
  type AuthoritativeBridgeResult,
} from "@/ai/e2e/authoritative-bridge";

export {
  runAiE2EPipeline,
  type RunAiE2EPipelineInput,
  type RunAiE2EPipelineResult,
  type AiE2EInject,
} from "@/ai/e2e/run-pipeline";
