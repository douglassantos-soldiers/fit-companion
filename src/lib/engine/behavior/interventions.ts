/**
 * Micro-interventions — not clinical. Ranked by interventionResponse history.
 */
import type {
  BehaviorIntervention,
  BehaviorProfile,
  BehaviorTrigger,
  BehaviorTriggerKey,
  InterventionType,
} from "@/lib/engine/behavior/types";
import { activeTriggers } from "@/lib/engine/behavior/triggers";

type Candidate = Omit<BehaviorIntervention, "id" | "confidence" | "trigger"> & {
  trigger: BehaviorTriggerKey;
};

const CATALOG: Record<BehaviorTriggerKey, Candidate[]> = {
  LOW_FRIDAY_ADHERENCE: [
    {
      type: "express_workout",
      trigger: "LOW_FRIDAY_ADHERENCE",
      action: "Faça o treino Express de 20 min hoje",
      reason: "Sextas costumam cair — Express reduz fricção",
      expectedOutcome: "Completar 1 sessão curta na sexta",
      channel: "today",
    },
    {
      type: "reminder",
      trigger: "LOW_FRIDAY_ADHERENCE",
      action: "Lembrete: sessão curta antes do fim do dia",
      reason: "Padrão de baixa aderência na sexta",
      expectedOutcome: "Abrir o treino do dia",
      channel: "today",
    },
  ],
  LOW_SLEEP_STREAK: [
    {
      type: "sleep_prompt",
      trigger: "LOW_SLEEP_STREAK",
      action: "Durma 30 min mais cedo esta noite",
      reason: "Sequência de sono baixo",
      expectedOutcome: "Check-in de sono ≥ 6.5h",
      channel: "lesson",
    },
    {
      type: "coach_checkin",
      trigger: "LOW_SLEEP_STREAK",
      action: "Registre o check-in de sono agora",
      reason: "Precisamos de evidência fresca de recuperação",
      expectedOutcome: "Day check-in atualizado",
      channel: "coach",
    },
  ],
  MEAL_LOGGING_DROP: [
    {
      type: "meal_swap",
      trigger: "MEAL_LOGGING_DROP",
      action: "Logue a próxima refeição em 2 toques (preset)",
      reason: "Queda no registro de refeições",
      expectedOutcome: "≥1 refeição logada hoje",
      channel: "today",
    },
    {
      type: "micro_goal",
      trigger: "MEAL_LOGGING_DROP",
      action: "Meta micro: 2 refeições registradas",
      reason: "Reconstruir o hábito de logging",
      expectedOutcome: "2 meals logged",
      channel: "quest",
    },
  ],
  TRAINING_SKIPPING_PATTERN: [
    {
      type: "express_workout",
      trigger: "TRAINING_SKIPPING_PATTERN",
      action: "Troque o treino longo por Express",
      reason: "Dia fraco do padrão semanal",
      expectedOutcome: "Sessão concluída",
      channel: "today",
    },
    {
      type: "micro_goal",
      trigger: "TRAINING_SKIPPING_PATTERN",
      action: "Meta: 15 min de movimento",
      reason: "Manter identidade de quem treina",
      expectedOutcome: "Qualquer sessão > 0",
      channel: "quest",
    },
  ],
  WEEKEND_MEAL_GAP: [
    {
      type: "meal_swap",
      trigger: "WEEKEND_MEAL_GAP",
      action: "Preset rápido de proteína no café de fim de semana",
      reason: "Gap de refeições no weekend",
      expectedOutcome: "≥1 refeição no sábado/domingo",
      channel: "today",
    },
    {
      type: "environment_prompt",
      trigger: "WEEKEND_MEAL_GAP",
      action: "Deixe whey/ovos visíveis na geladeira",
      reason: "Ambiente reduz fricção no fim de semana",
      expectedOutcome: "Logging restaurado",
      channel: "lesson",
    },
  ],
  TIME_CONSTRAINT_PATTERN: [
    {
      type: "express_workout",
      trigger: "TIME_CONSTRAINT_PATTERN",
      action: "Priorize Express — você conclui melhor o curto",
      reason: "Padrão de restrição de tempo",
      expectedOutcome: "Sessão curta concluída",
      channel: "today",
    },
    {
      type: "hydration_prompt",
      trigger: "TIME_CONSTRAINT_PATTERN",
      action: "Água agora + Express depois",
      reason: "Âncora rápida quando o dia aperta",
      expectedOutcome: "Água + sessão",
      channel: "quest",
    },
  ],
};

function scoreCandidate(
  c: Candidate,
  profile: BehaviorProfile,
): number {
  const hist = profile.interventionResponse[c.type] ?? 0.5;
  return hist;
}

export function selectInterventions(
  triggers: BehaviorTrigger[],
  profile: BehaviorProfile,
  max = 3,
): BehaviorIntervention[] {
  const active = activeTriggers(triggers);
  const scored: BehaviorIntervention[] = [];

  for (const t of active) {
    const candidates = CATALOG[t.key] ?? [];
    const ranked = [...candidates].sort(
      (a, b) => scoreCandidate(b, profile) - scoreCandidate(a, profile),
    );
    const best = ranked[0];
    if (!best) continue;
    scored.push({
      id: `bi-${t.key}-${best.type}`,
      ...best,
      confidence: Math.round(t.confidence * scoreCandidate(best, profile) * 100) / 100,
    });
  }

  return scored
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, max);
}

export function interventionForTrigger(
  key: BehaviorTriggerKey,
  profile: BehaviorProfile,
): BehaviorIntervention | null {
  const fake: BehaviorTrigger = {
    key,
    description: key,
    patternKeys: [],
    supportCount: 2,
    confidence: 0.7,
    active: true,
    evidence: [],
  };
  return selectInterventions([fake], profile, 1)[0] ?? null;
}
