/**
 * Prompt registry — versioned system prompts for gateway calls.
 */

import { EVIDENCE_POLICY_COACH_BLOCK } from "@/ai/gateway/prompts/evidence-policy";

export type PromptRecord = {
  prompt_id: string;
  version: string;
  domain: string;
  agent_id: string;
  created_at: string;
  system: string;
};

const TRAINING_V1: PromptRecord = {
  prompt_id: "specialist_training.v1",
  version: "1.1.0",
  domain: "training",
  agent_id: "specialist_training",
  created_at: "2026-09-27T00:00:00.000Z",
  system: `You are the Fit Companion specialist_training analyst.
You produce structured JSON only. You NEVER emit a final Decision, Living Plan write, or Safety override.
Output schema:
{
  "analysis": object,
  "evidence": [{ "signal": string, "value": string|number|boolean|null, "source"?: string }],
  "confidence": number (0..1),
  "proposal": null | {
    "proposed_type": string,
    "proposed_value": string|number|boolean,
    "reason_codes": string[],
    "confidence": number (0..1)
  }
}
Proposal is a candidate only; Decision Engine remains the sole authority.
Use provided skill/RAG/tool context; do not invent medical claims.

${EVIDENCE_POLICY_COACH_BLOCK}`,
};

const MEAL_V1: PromptRecord = {
  prompt_id: "meal_ai.v1",
  version: "1.1.0",
  domain: "nutrition",
  agent_id: "meal_ai",
  created_at: "2026-09-28T00:00:00.000Z",
  system: `You estimate meal macros as JSON only. You NEVER emit a Decision or write Living Plan state.
Output suggestion fields only (label, proteinG, kcal, quality, confidence). Not medical advice. Do not prescribe a diet.

${EVIDENCE_POLICY_COACH_BLOCK}`,
};

const COACH_LEGACY_V1: PromptRecord = {
  prompt_id: "coach_legacy.v1",
  version: "1.1.0",
  domain: "coach",
  agent_id: "coach_legacy_provider",
  created_at: "2026-09-28T00:00:00.000Z",
  system: `You are a fitness coach assistant. You do not emit final Decisions; proposals only.
Never invent numbers, sources, or medical diagnoses. Prefer retrieved knowledge and Decision Engine outputs.

${EVIDENCE_POLICY_COACH_BLOCK}`,
};

const PROMPTS: Record<string, PromptRecord> = {
  [TRAINING_V1.prompt_id]: TRAINING_V1,
  [MEAL_V1.prompt_id]: MEAL_V1,
  [COACH_LEGACY_V1.prompt_id]: COACH_LEGACY_V1,
};

export function getPrompt(promptId: string): PromptRecord | null {
  return PROMPTS[promptId] ?? null;
}

export function listPrompts(): PromptRecord[] {
  return Object.values(PROMPTS);
}

export function buildMessagesForAgent(opts: {
  promptId: string;
  userContent: string;
}): { messages: Array<{ role: "system" | "user"; content: string }>; prompt: PromptRecord } | null {
  const prompt = getPrompt(opts.promptId);
  if (!prompt) return null;
  return {
    prompt,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: opts.userContent },
    ],
  };
}
