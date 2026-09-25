/**
 * Coach Agent barrel.
 */

export { COACH_AGENT_ERROR } from "@/ai/agents/coach/errors";
export type { CoachAgentErrorCode } from "@/ai/agents/coach/errors";
export { detectCoachAgentIntent, intentForOrchestrator } from "@/ai/agents/coach/intent";
export type { CoachAgentIntentKind } from "@/ai/agents/coach/intent";
export { buildFactPack, emptyWhyFacts } from "@/ai/agents/coach/fact-pack";
export type { CoachFactPack, WhyFacts } from "@/ai/agents/coach/fact-pack";
export {
  buildCoachResponse,
  buildInsufficientContextResponse,
  buildRejectedPlanResponse,
  buildBlockedAnonymousResponse,
} from "@/ai/agents/coach/respond";
export type {
  BuiltCoachResponse,
  CoachAgentResponseStatus,
  CoachAgentStructured,
} from "@/ai/agents/coach/respond";
export { runCoachAgent } from "@/ai/agents/coach/run-coach";
export type { RunCoachAgentInput, RunCoachAgentResult } from "@/ai/agents/coach/run-coach";
