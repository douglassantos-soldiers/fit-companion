/**
 * LearningSignalRecord — allowlisted key + deterministic PT narrative.
 * Never invents clinical traits; never mutates Decision rules.
 */
import type { LearningDecisionRef } from "@/lib/engine/learning/decision-ref";
import type { LearningOutcome } from "@/lib/engine/learning/outcome";
import type { LearningSignal } from "@/lib/engine/learning/types";
import { LEARNING_SIGNALS } from "@/lib/engine/learning/types";
import { LEARNING_ENGINE_VERSION } from "@/lib/engine/learning/version";
import type { RecoveryLevel } from "@/lib/engine/recovery/types";

export type LearningSignalRecord = {
  signalId: string;
  signal: LearningSignal;
  narrative: string;
  decisionId: string;
  confidence: number;
  engineVersion: string;
  createdAt: string;
  blockedByGuardrail: boolean;
};

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) + h + str.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16);
}

export function isLearningSignal(value: string): value is LearningSignal {
  return (LEARNING_SIGNALS as readonly string[]).includes(value);
}

function recoveryLabel(level: RecoveryLevel | undefined): string {
  if (level === "recovered") return "alta recuperação";
  if (level === "low") return "baixa recuperação";
  if (level === "unknown") return "recuperação indefinida";
  return "recuperação moderada";
}

/**
 * Map decision / outcome to an allowlisted LearningSignal key.
 */
export function resolveSignalKey(
  decision: LearningDecisionRef,
  outcome: LearningOutcome,
): LearningSignal | null {
  const t = decision.decisionType.toLowerCase();
  const action = outcome.action.toLowerCase();
  if (
    t.includes("volume") ||
    t.includes("training_load") ||
    action.includes("volume") ||
    action.includes("reduce")
  ) {
    return "volume_reduction_helps";
  }
  if (t.includes("express") || action.includes("express")) {
    return "express_training_high_adherence";
  }
  if (t.includes("meal") || t.includes("nutrition") || action.includes("meal")) {
    if (action.includes("priority") || t.includes("priority")) return "meal_priority_logged";
    return "nutrition_target_adherence";
  }
  if (t.includes("sleep") || action.includes("sleep")) return "sleep_priority_followed";
  if (t.includes("rest") || action.includes("rest")) return "rest_next_day_recovery";
  return "volume_reduction_helps";
}

export function buildSignalNarrative(opts: {
  signal: LearningSignal;
  decision: LearningDecisionRef;
  outcome: LearningOutcome;
  recoveryLevel?: RecoveryLevel;
}): string {
  const recovery = recoveryLabel(opts.recoveryLevel);
  const adherencePct =
    opts.outcome.adherence != null ? `${Math.round(opts.outcome.adherence * 100)}%` : null;

  switch (opts.signal) {
    case "volume_reduction_helps":
      if (opts.outcome.result === "positive") {
        return adherencePct
          ? `redução de volume acessório parece eficaz sob ${recovery} (adesão ${adherencePct})`
          : `redução de volume acessório parece eficaz sob ${recovery}`;
      }
      if (opts.outcome.result === "negative") {
        return `redução de volume acessório não melhorou o resultado sob ${recovery}`;
      }
      return `sinais mistos após redução de volume sob ${recovery}`;
    case "express_training_high_adherence":
      return opts.outcome.result === "positive"
        ? `treino express com adesão alta parece sustentável sob ${recovery}`
        : `treino express não sustentou o resultado esperado sob ${recovery}`;
    case "meal_priority_logged":
      return opts.outcome.result === "positive"
        ? "registrar refeição prioritária correlaciona com melhor adesão nutricional"
        : "refeição prioritária não sustentou o resultado esperado";
    case "nutrition_target_adherence":
      return opts.outcome.result === "positive"
        ? "atingir alvos nutricionais reforça o padrão de adesão"
        : "alvos nutricionais não foram sustentados no outcome";
    case "sleep_priority_followed":
      return opts.outcome.result === "positive"
        ? "priorizar sono correlaciona com melhor recuperação no dia seguinte"
        : "prioridade de sono não produziu o outcome esperado";
    case "rest_next_day_recovery":
      return opts.outcome.result === "positive"
        ? "dia de descanso correlaciona com recuperação positiva no dia seguinte"
        : "descanso não produziu recuperação positiva no dia seguinte";
    default:
      return `sinal ${opts.signal} observado sob ${recovery}`;
  }
}

export function buildLearningSignalRecord(opts: {
  decision: LearningDecisionRef;
  outcome: LearningOutcome;
  signal: LearningSignal;
  confidence: number;
  blockedByGuardrail?: boolean;
  recoveryLevel?: RecoveryLevel;
  createdAt?: string;
}): LearningSignalRecord {
  const createdAt = opts.createdAt ?? opts.outcome.createdAt;
  const narrative = buildSignalNarrative({
    signal: opts.signal,
    decision: opts.decision,
    outcome: opts.outcome,
    ...(opts.recoveryLevel !== undefined ? { recoveryLevel: opts.recoveryLevel } : {}),
  });
  return {
    signalId: `ls_${djb2([opts.decision.decisionId, opts.signal, createdAt, String(opts.confidence)].join("|"))}`,
    signal: opts.signal,
    narrative,
    decisionId: opts.decision.decisionId,
    confidence: Math.max(0, Math.min(1, opts.confidence)),
    engineVersion: LEARNING_ENGINE_VERSION,
    createdAt,
    blockedByGuardrail: Boolean(opts.blockedByGuardrail),
  };
}
