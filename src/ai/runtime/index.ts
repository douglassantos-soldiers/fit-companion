/**
 * FASE 22.1 — Production AI runtime surface (CANONICAL).
 */

export { AI_PATH_LABEL, AI_PATH_LABEL_META_KEY, type AiPathLabel } from "@/ai/runtime/path-labels";

export {
  runAuthoritativeBridge,
  type AuthoritativeBridgeInput,
  type AuthoritativeBridgeResult,
} from "@/ai/runtime/authoritative-bridge";

export {
  runProductionAiRuntime,
  type RunProductionAiRuntimeInput,
  type RunProductionAiRuntimeResult,
  type ProductionAiCorrelation,
  type ProductionAiRuntimeErrorCode,
  type ProductionAiRuntimeInject,
} from "@/ai/runtime/production-runtime";

export {
  initializeAIInfrastructure,
  ensureAIInfrastructureReady,
  getAIInfrastructureReport,
  resetAIInfrastructureForTests,
  type AiInfrastructureReport,
  type AiInfrastructureStatus,
} from "@/ai/runtime/initialize-ai-infrastructure";

/** Re-exports of operational controls (FASE 21) — not the canonical journey entrypoint. */
export { getAiFeatureFlags } from "@/ai/runtime/feature-flags";
export { resolveEffectiveRuntimeMode } from "@/ai/runtime/rollback";
