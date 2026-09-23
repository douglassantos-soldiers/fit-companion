/**
 * Personalized challenge suggestions (MVP 4) — rule + profile driven.
 * Registers ephemeral Challenge rows into the live CHALLENGES catalog so join works.
 */
import {
  CHALLENGES,
  computePersonalTarget,
  type Challenge,
} from "@/data/challenges";
import { sessionsInLastDays } from "@/lib/engine/dimensions";
import type { AppState, Goal } from "@/lib/types";

export interface AiChallengeSuggestion {
  challenge: Challenge;
  why: string;
  source: "ai_rules";
}

export function isAiGeneratedChallenge(id: string): boolean {
  return id.startsWith("ai-");
}

function goalCategory(goal: Goal): Challenge["category"] {
  if (goal === "gordura") return "conditioning";
  if (goal === "performance") return "strength";
  if (goal === "saude") return "consistency";
  return "muscle_gain";
}

function volume28d(state: AppState): number {
  const limit = new Date();
  limit.setDate(limit.getDate() - 28);
  const key = limit.toISOString().slice(0, 10);
  return state.sessions
    .filter((s) => s.date.slice(0, 10) >= key)
    .reduce((sum, s) => sum + (s.volumeKg || 0), 0);
}

function upsertChallenge(challenge: Challenge) {
  const idx = CHALLENGES.findIndex((c) => c.id === challenge.id);
  if (idx >= 0) CHALLENGES[idx] = challenge;
  else CHALLENGES.push(challenge);
}

/** Build 1–3 personalized challenges for the current athlete and register them. */
export function suggestAiChallenges(state: AppState, now = new Date()): AiChallengeSuggestion[] {
  const profile = state.profile;
  if (!profile) return [];

  const sessions7 = sessionsInLastDays(state.sessions, 7).length;
  const sessions28 = sessionsInLastDays(state.sessions, 28).length;
  const volume = volume28d(state);
  const daysPerWeek = Math.max(2, profile.daysPerWeek || 3);
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const out: AiChallengeSuggestion[] = [];

  const targetSessions = Math.max(
    daysPerWeek * 2,
    Math.min(18, Math.round(Math.max(sessions7, daysPerWeek) * 3 * 1.25)),
  );
  const consistency: Challenge = {
    id: `ai-consistencia-${stamp}`,
    title: "Sua meta de consistência (IA)",
    description: `Complete ${targetSessions} treinos em 21 dias — calibrado ao seu ritmo atual.`,
    category: "consistency",
    metric: "sessoes",
    target: targetSessions,
    unit: "treinos",
    durationDays: 21,
    participants: 0,
    rankingMode: "personalized",
    personalTargetFactor: 1,
    personalTargetOffset: 0,
    personalTargetMin: targetSessions,
    personalTargetMax: targetSessions,
    reward: "XP de desafio",
    active: true,
  };
  upsertChallenge(consistency);
  out.push({
    challenge: consistency,
    why:
      sessions7 > 0
        ? `Você treinou ${sessions7}x nesta semana — meta ${targetSessions} em 21 dias.`
        : `Com base na sua frequência (${daysPerWeek}x/semana), meta ${targetSessions} treinos em 21 dias.`,
    source: "ai_rules",
  });

  if (volume > 0 || sessions28 >= 2) {
    const baseline = Math.max(volume, 5000);
    const volChallenge: Challenge = {
      id: `ai-volume-${stamp}`,
      title: "Evolução de volume (IA)",
      description: "Suba o volume vs seu baseline recente — meta pessoal, não ranking absoluto.",
      category: goalCategory(profile.goal),
      metric: "volume",
      target: Math.round(baseline * 1.2),
      unit: "kg",
      durationDays: 21,
      participants: 0,
      rankingMode: "personalized",
      personalTargetFactor: 1.2,
      personalTargetOffset: 0,
      personalTargetMin: Math.round(baseline * 1.05),
      personalTargetMax: Math.round(baseline * 2),
      requiresPerformance: true,
      reward: "XP de desafio",
      active: true,
    };
    const personal = computePersonalTarget(volChallenge, baseline);
    const finalized = { ...volChallenge, target: personal };
    upsertChallenge(finalized);
    out.push({
      challenge: finalized,
      why: `Baseline ~${Math.round(baseline).toLocaleString("pt-BR")} kg / 28d → meta ${personal.toLocaleString("pt-BR")} kg.`,
      source: "ai_rules",
    });
  }

  if (sessions28 < daysPerWeek * 2) {
    const short: Challenge = {
      id: `ai-habito-${stamp}`,
      title: "Hábito 14 dias (IA)",
      description: "Feche 6 sessões em 14 dias e estabilize o hábito.",
      category: "consistency",
      metric: "sessoes",
      target: 6,
      unit: "treinos",
      durationDays: 14,
      participants: 0,
      rankingMode: "absolute",
      reward: "XP de desafio",
      active: true,
    };
    upsertChallenge(short);
    out.push({
      challenge: short,
      why: "Poucos treinos no último mês — desafio curto para criar aderência.",
      source: "ai_rules",
    });
  }

  return out.slice(0, 3);
}
