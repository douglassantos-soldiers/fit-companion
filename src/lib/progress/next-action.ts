import type { Dimension } from "@/lib/engine/dimensions";
import type { Goal } from "@/lib/types";

export type ProgressNextActionTo =
  | "/"
  | "/treino"
  | "/nutricao"
  | "/progresso/corpo"
  | "/coach";

export type ProgressNextAction = {
  title: string;
  reason: string;
  ctaLabel: string;
  to: ProgressNextActionTo;
  search?: { tab?: string };
};

/**
 * One actionable CTA for /progresso hub — blocker + Living Plan primary + coachLine.
 */
export function resolveProgressNextAction(opts: {
  blocker: Dimension | null;
  livingPrimary?: "train" | "rest" | "sleep" | "meal" | string | null;
  coachLine?: string | null;
  score: number;
  hasBodyPhotos?: boolean;
  isRitualDay?: boolean;
}): ProgressNextAction {
  const reasonFallback = opts.coachLine?.trim() || "Feche o gap do dia para subir o score.";
  const primary = opts.livingPrimary ?? null;
  const key = opts.blocker?.key ?? "";

  if (primary === "meal" || key === "nutricao") {
    return {
      title: "Feche a proteína hoje",
      reason: opts.blocker?.label
        ? `${opts.blocker.label} fraca · ${reasonFallback}`
        : reasonFallback,
      ctaLabel: "Abrir Nutrição",
      to: "/nutricao",
    };
  }

  if (primary === "sleep" || key === "sono") {
    return {
      title: "Priorize sono e check-in",
      reason: reasonFallback,
      ctaLabel: "Fazer check-in",
      to: "/",
    };
  }

  if (primary === "rest" || key === "recuperacao") {
    return {
      title: "Recuperação em foco",
      reason: reasonFallback,
      ctaLabel: "Ver plano de hoje",
      to: "/",
    };
  }

  if (opts.isRitualDay && !opts.hasBodyPhotos) {
    return {
      title: "Registre o corpo na revisão",
      reason: "Medidas ou fotos fecham o ritual semanal.",
      ctaLabel: "Abrir Corpo",
      to: "/progresso/corpo",
    };
  }

  if (key === "consistencia" || key === "habitos" || opts.score < 40) {
    return {
      title: "Treine hoje e proteja o streak",
      reason: reasonFallback,
      ctaLabel: "Ir treinar",
      to: "/treino",
    };
  }

  return {
    title: opts.blocker ? `Eleve ${opts.blocker.label}` : "Continue a progressão",
    reason: reasonFallback,
    ctaLabel: primary === "train" || !primary ? "Ir treinar" : "Ver plano de hoje",
    to: primary === "train" || !primary ? "/treino" : "/",
  };
}

export type GoalProgressCard = {
  title: string;
  line: string;
  hint: string;
};

/** Lightweight goal narrative — no medical claims. */
export function goalProgressCard(opts: {
  goal: Goal;
  weightDelta7d: number | null;
  strengthDelta28d: number | null;
  prCountWeek: number;
  proteinHitDays7d: number;
  sleepAvg7d: number | null;
}): GoalProgressCard {
  const { goal } = opts;
  if (goal === "massa" || goal === "gordura") {
    const delta = opts.weightDelta7d;
    const line =
      delta == null
        ? "Registre o peso alguns dias para ver a tendência."
        : delta === 0
          ? "Peso estável nos últimos registros."
          : `Peso ${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg na janela recente.`;
    return {
      title: goal === "massa" ? "Objetivo: ganhar massa" : "Objetivo: perder gordura",
      line,
      hint: "Use Corpo para medidas e fotos — tendência, não diagnóstico.",
    };
  }
  if (goal === "performance") {
    const bits: string[] = [];
    if (opts.strengthDelta28d != null) {
      bits.push(`Strength ${opts.strengthDelta28d > 0 ? "+" : ""}${opts.strengthDelta28d} em 28d`);
    }
    if (opts.prCountWeek > 0) bits.push(`${opts.prCountWeek} PR(s) esta semana`);
    return {
      title: "Objetivo: performance",
      line: bits.length ? bits.join(" · ") : "Bata cargas e PRs para ver evolução de força.",
      hint: "Força e volume no hub; plateau aponta ajuste no Coach.",
    };
  }
  return {
    title: "Objetivo: saúde e bem-estar",
    line: `Proteína ok ${opts.proteinHitDays7d}/7d${
      opts.sleepAvg7d != null ? ` · sono ~${opts.sleepAvg7d.toFixed(1)}h` : ""
    }`,
    hint: "Consistência de logging e recuperação importam mais que pico de carga.",
  };
}

export function weightDeltaRecent(
  weights: Array<{ date: string; weightKg: number }>,
  days = 14,
): number | null {
  if (weights.length < 2) return null;
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1]!;
  const cutoff = new Date(`${last.date}T12:00:00`);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const first = sorted.find((w) => w.date >= cutoffKey) ?? sorted[0]!;
  if (first.date === last.date) return null;
  return Math.round((last.weightKg - first.weightKg) * 10) / 10;
}
