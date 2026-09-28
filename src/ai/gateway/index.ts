/**
 * AI Gateway barrel — Agents import only from here (not provider SDKs).
 */

export { invokeAI, type InvokeAIInput, type InvokeAIResult, type InvokeAISuccess, type InvokeAIFailure } from "@/ai/gateway/gateway";
export { getAiRuntimeMode, isLlmPathEnabled, type AiRuntimeMode } from "@/ai/gateway/runtime-mode";
export { getAgentAIConfig, getGatewayRuntimeSnapshot } from "@/ai/gateway/config";
export {
  parseStructuredOutput,
  validateAndBridgeStructured,
  type LlmStructuredOutput,
  type ValidatedLlmOutput,
} from "@/ai/gateway/validate";
export { recordGatewayAudit, redactGatewayMetadata } from "@/ai/gateway/audit";
export { getPrompt, listPrompts, buildMessagesForAgent } from "@/ai/gateway/prompts";
export {
  checkLlmHealth,
  checkLlmLiveProbe,
  getLlmReadiness,
} from "@/ai/gateway/health";
export type {
  LlmHealthCheckId,
  LlmHealthCheckResult,
  LlmHealthReport,
  LlmLiveProbeResult,
  LlmReadinessResult,
} from "@/ai/gateway/health";
export {
  resolveLlmEnvironment,
  resolvePrimaryProvider,
  resolveFallbackProvider,
  isLlmProduction,
  assertProviderAllowedInEnv,
} from "@/ai/gateway/runtime/env";
export type { LlmEnvironment } from "@/ai/gateway/runtime/env";
export {
  resetCircuitBreakers,
  getCircuitSnapshot,
  getCircuitState,
  canCallProvider,
  recordCircuitFailure,
  recordCircuitSuccess,
} from "@/ai/gateway/circuit-breaker";
export {
  checkAiCostLimits,
  recordAiCost,
  resetAiCostLimits,
  getAiCostLimitDefaults,
} from "@/ai/gateway/cost-limits";
export { generateWithFallback } from "@/ai/gateway/fallback";
export {
  ProductionMockProviderError,
  isProductionMockProviderError,
} from "@/ai/providers/errors";
export type { AiExecutionStatus } from "@/ai/gateway/gateway";
