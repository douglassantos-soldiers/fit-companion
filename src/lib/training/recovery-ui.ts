/**
 * UI helpers for muscle recovery → actionable training CTAs.
 * Domain authority remains in src/lib/engine/recovery/.
 */
import { exerciseById, type MuscleGroup } from "@/data/exercises";
import {
  freshnessForGroups,
  type MuscleRecoverySnapshot,
  type MuscleRecoveryStatus,
  type RecoveryContext,
} from "@/lib/engine/recovery";
import type { SessionLog } from "@/lib/types";

export type DayLike = {
  id: string;
  title: string;
  exercises: Array<{ exerciseId: string }>;
  recoveryScore?: number;
  /** Optional override when exercise catalog is unavailable (tests / sticky). */
  groups?: MuscleGroup[];
};

export const STATUS_LABEL: Record<MuscleRecoveryStatus, string> = {
  fresh: "Pronto",
  ok: "Ok",
  fatigued: "Fatigado",
  unknown: "Sem dado",
};

export const REASON_LABEL: Record<string, string> = {
  recent_training: "Treino recente",
  excessive_muscle_load: "Carga 7d alta",
  low_muscle_fatigue: "Carga baixa",
  undertrained_muscle: "Pouco treinado",
  sleep_low: "Sono baixo",
  energy_low: "Energia baixa",
  rpe_high: "RPE alto recente",
};

const LOAD_EMPTY_THRESHOLD = 2;

export function muscleGroupsOfDay(day: DayLike): MuscleGroup[] {
  if (day.groups?.length) {
    return day.groups.filter((g) => g !== "cardio");
  }
  const groups = new Set<MuscleGroup>();
  for (const ex of day.exercises) {
    const g = exerciseById(ex.exerciseId)?.group;
    if (g && g !== "cardio") groups.add(g);
  }
  return [...groups];
}

export function isMuscleRecoveryEmpty(snaps: MuscleRecoverySnapshot[]): boolean {
  const relevant = snaps.filter((s) => s.muscle !== "cardio");
  if (!relevant.length) return true;
  return relevant.every((s) => s.load7d < LOAD_EMPTY_THRESHOLD && s.status === "unknown");
}

export function findDayForMuscle<T extends DayLike>(plan: T[], muscle: MuscleGroup): T | null {
  return (
    plan.find((day) =>
      day.exercises.some((ex) => exerciseById(ex.exerciseId)?.group === muscle),
    ) ?? null
  );
}

export function bestStimulusDayId(
  plan: DayLike[],
  sessions: SessionLog[],
  ctx: RecoveryContext = {},
): string | null {
  if (!plan.length) return null;
  let bestId = plan[0]!.id;
  let bestScore = -1;
  for (const day of plan) {
    const groups = muscleGroupsOfDay(day);
    const score = groups.length
      ? freshnessForGroups(groups, sessions, ctx)
      : (day.recoveryScore ?? 50);
    if (score > bestScore) {
      bestScore = score;
      bestId = day.id;
    }
  }
  return bestId;
}

export type RecoveryActionHint = {
  empty: boolean;
  message: string;
  ctaLabel: string;
  preferExpress: boolean;
};

export function recoveryActionHint(
  snaps: MuscleRecoverySnapshot[],
  todayDay: DayLike | null,
  opts?: { express?: boolean; trainingMode?: string | null },
): RecoveryActionHint {
  const empty = isMuscleRecoveryEmpty(snaps);
  if (empty) {
    return {
      empty: true,
      message: "Ainda sem carga registrada — o mapa fica preciso após o 1º treino.",
      ctaLabel: "Treinar agora",
      preferExpress: false,
    };
  }

  const express = Boolean(opts?.express) || opts?.trainingMode === "express";
  const todayGroups = todayDay ? muscleGroupsOfDay(todayDay) : [];
  const byMuscle = new Map(snaps.map((s) => [s.muscle, s]));

  if (todayGroups.length) {
    const todaySnaps = todayGroups
      .map((g) => byMuscle.get(g))
      .filter((s): s is MuscleRecoverySnapshot => Boolean(s));
    const fatigued = todaySnaps.filter((s) => s.status === "fatigued");
    const fresh = todaySnaps.filter((s) => s.status === "fresh");

    if (fatigued.length >= Math.ceil(todayGroups.length / 2)) {
      const names = fatigued
        .slice(0, 2)
        .map((s) => s.label)
        .join("/");
      return {
        empty: false,
        message: `${names} ainda em recuperação — prefira express ou outro dia.`,
        ctaLabel: express ? "Começar Express" : "Treinar leve",
        preferExpress: true,
      };
    }

    if (fresh.length) {
      const names = fresh
        .slice(0, 2)
        .map((s) => s.label)
        .join("/");
      return {
        empty: false,
        message: `${names} pronto${fresh.length > 1 ? "s" : ""} → ${express ? "express" : "treinar agora"}.`,
        ctaLabel: express ? "Começar Express" : "Treinar agora",
        preferExpress: express,
      };
    }
  }

  const ready = snaps
    .filter((s) => s.muscle !== "cardio" && s.status === "fresh")
    .sort((a, b) => b.freshness - a.freshness);
  if (ready.length) {
    const names = ready
      .slice(0, 2)
      .map((s) => s.label)
      .join("/");
    return {
      empty: false,
      message: `${names} prontos para estímulo.`,
      ctaLabel: express ? "Começar Express" : "Treinar agora",
      preferExpress: express,
    };
  }

  const fatiguedAll = snaps.filter((s) => s.muscle !== "cardio" && s.status === "fatigued");
  if (fatiguedAll.length >= 3) {
    return {
      empty: false,
      message: "Vários grupos fatigados — volume leve ou rest faz sentido.",
      ctaLabel: express ? "Começar Express" : "Treinar leve",
      preferExpress: true,
    };
  }

  return {
    empty: false,
    message: "Volume e carga dos últimos 7 dias influenciam a recuperação.",
    ctaLabel: express ? "Começar Express" : "Treinar agora",
    preferExpress: express,
  };
}

/** Compact home teaser: "3 grupos prontos · pernas em recuperação" */
export function muscleRecoveryTeaser(snaps: MuscleRecoverySnapshot[]): string | null {
  if (isMuscleRecoveryEmpty(snaps)) {
    return "Mapa muscular sem carga ainda — treine para calibrar";
  }
  const relevant = snaps.filter((s) => s.muscle !== "cardio");
  const fresh = relevant.filter((s) => s.status === "fresh");
  const fatigued = relevant.filter((s) => s.status === "fatigued");

  const parts: string[] = [];
  if (fresh.length) {
    parts.push(`${fresh.length} grupo${fresh.length === 1 ? "" : "s"} pronto${fresh.length === 1 ? "" : "s"}`);
  }
  if (fatigued.length) {
    const top = fatigued.sort((a, b) => a.freshness - b.freshness)[0]!;
    parts.push(`${top.label.toLowerCase()} em recuperação`);
  }
  if (!parts.length) {
    const ok = relevant.filter((s) => s.status === "ok").length;
    if (ok) return `${ok} grupos em ritmo normal`;
    return null;
  }
  return parts.join(" · ");
}

export function trainNowLabel(opts: {
  express: boolean;
  recoveryScore?: number;
  trainingMode?: string | null;
}): string {
  if (opts.trainingMode === "rest") return "Ver plano de hoje";
  if (opts.express || opts.trainingMode === "express") return "Começar Express";
  if (opts.recoveryScore != null && opts.recoveryScore < 35) return "Treinar leve";
  return "Treinar agora";
}
