/**
 * LearningEvent — signal that may update future context priors.
 * Learning never overrides Safety or Decision authority.
 * SoT: src/lib/engine/learning/events.ts
 */
export type {
  LearningEvent,
  LearningEventKind,
  LearningEventDomain,
  EngineLearningEvent,
} from "@/lib/engine/learning/events";
export { LEARNING_ENGINE_VERSION, LEARNING_CONTRACT_VERSION } from "@/lib/engine/learning/version";
