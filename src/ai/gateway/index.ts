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
export { recordGatewayAudit } from "@/ai/gateway/audit";
export { getPrompt, listPrompts, buildMessagesForAgent } from "@/ai/gateway/prompts";
