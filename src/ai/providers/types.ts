/**
 * AI Provider contracts — FASE 17.
 * Agents never import provider SDKs; they call AI Gateway only.
 */

export type AIProviderId = "mock" | "openai" | "anthropic" | "google";

export type AIMessageRole = "system" | "user" | "assistant";

export type AIMessage = {
  role: AIMessageRole;
  content: string;
};

export type AIUsage = {
  input_tokens: number;
  output_tokens: number;
  cached_tokens?: number;
  estimated_cost?: number;
  actual_cost?: number | null;
};

export type AIRequest = {
  provider?: AIProviderId;
  model?: string;
  messages: AIMessage[];
  temperature?: number;
  max_tokens?: number;
  timeout_ms?: number;
  max_cost?: number;
  /** When true, provider should return JSON object text. */
  json_mode?: boolean;
  /** Correlation for audit */
  run_id?: string;
  agent_id?: string;
  prompt_version?: string;
};

export type AIResponse = {
  ok: true;
  provider: AIProviderId;
  model: string;
  text: string;
  usage: AIUsage;
  latency_ms: number;
  request_id?: string;
  finish_reason?: string;
};

export type AIErrorCode =
  | "not_configured"
  | "not_implemented"
  | "unauthorized"
  | "rate_limit"
  | "timeout"
  | "upstream"
  | "invalid_request"
  | "cost_limit"
  | "invalid_structured_output"
  | "safety_rejection"
  | "unknown";

export type AIError = {
  ok: false;
  code: AIErrorCode;
  message: string;
  provider?: AIProviderId;
  model?: string;
  retryable?: boolean;
  latency_ms?: number;
  usage?: AIUsage;
};

export type AIResult = AIResponse | AIError;

export type AIProvider = {
  readonly id: AIProviderId;
  generate(req: AIRequest): Promise<AIResult>;
  stream(req: AIRequest): AsyncIterable<string> | Promise<AIError>;
  estimateCost(usage: AIUsage, model?: string): number;
  countTokens(text: string): number;
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
};
