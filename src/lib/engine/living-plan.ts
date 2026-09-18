import { PRODUCTS, productById } from "@/data/products";
import { activeHubForState } from "@/data/hubs";
import {
  performanceDimensions,
  performanceScore,
  primaryBlockerDimension,
  trafficForScore,
} from "@/lib/engine/dimensions";
import { computeLearningInsights, learningWeekHint } from "@/lib/engine/learning";
import { nutritionGoals } from "@/lib/engine/nutrition";
import { buildExpressSession, buildWeeklyPlanDetailed, planDayForToday } from "@/lib/engine/plan";
import type { AppState, LivingPlanSnapshot, Profile } from "@/lib/types";
import { BLOCKER_LABEL, todayKey } from "@/lib/types";

function yesterdayKey(date = todayKey()) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

function sleepHoursForDay(state: AppState, profile: Profile, date: string): number {
  return state.dayCheckIns?.[date]?.sleepHours ?? profile.typicalSleepHours ?? 7;
}

/** Build integrated living plan for a given date (defaults to today). */
export function buildLivingPlan(state: AppState, date = todayKey()): LivingPlanSnapshot | null {
  const profile = state.profile;
  if (!profile) return null;

  const insights = computeLearningInsights(state);
  const dims = performanceDimensions(state, profile);
  const score = performanceScore(dims);
  const blockerDim = primaryBlockerDimension(state, profile);
  const checkIn = state.dayCheckIns?.[date];
  const sleepH = sleepHoursForDay(state, profile, date);
  const energy = checkIn?.energy ?? "ok";
  const availableMin = checkIn?.availableMin ?? 60;
  const noEquipment = checkIn?.noEquipment === true;
  const equipment = noEquipment ? ("casa" as const) : profile.equipment;

  const weekHint = learningWeekHint(state);
  const { days: plan, weekMode } = buildWeeklyPlanDetailed(
    profile,
    state.sessions,
    equipment,
    weekHint,
  );
  const day = planDayForToday(plan, new Date(`${date}T12:00:00`));

  const sleepStress = sleepH < 6 || energy === "baixa";
  const timeTight = availableMin < 40;
  let volumeFactor = 1;
  let mode: LivingPlanSnapshot["workout"]["mode"] = day ? "full" : "rest";
  let estimatedMin = day?.estimatedMin ?? 0;
  let title = day?.title ?? "Descanso ativo";

  if (!day) {
    mode = "rest";
  } else if (weekMode === "deload" || sleepStress) {
    mode = "deload";
    volumeFactor = sleepH < 5.5 ? 0.55 : 0.7;
    estimatedMin = Math.round(day.estimatedMin * volumeFactor);
    title = `${day.title} (leve)`;
  } else if (timeTight || availableMin < day.estimatedMin * 0.7) {
    mode = "express";
    volumeFactor = 0.65;
    const express = buildExpressSession(day);
    estimatedMin = express?.estimatedMin ?? Math.min(35, availableMin);
    title = express?.title ?? `${day.title} express`;
  }

  const goals = nutritionGoals(profile, insights);
  let kcal = goals.kcal;
  let proteinG = goals.proteinG;
  if (sleepStress) {
    // Slight protein priority, avoid aggressive deficit when recovering
    proteinG = Math.round(proteinG * 1.05);
    if (profile.goal !== "gordura") kcal = Math.round(kcal + 50);
  }
  if (profile.skipBreakfast) {
    // Redistribute: keep protein, slight kcal nudge toward later meals (informational)
    proteinG = Math.round(proteinG);
  }

  const routineIds =
    state.supplementRoutine.length > 0
      ? state.supplementRoutine
      : PRODUCTS.filter((p) => p.goals.includes(profile.goal))
          .slice(0, 3)
          .map((p) => p.id);

  const supplements = routineIds
    .map((id) => productById(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({ id: p.id, name: p.name, timing: p.timing }));

  // Prefer creatine + protein on training days; drop stim if sleep poor
  const filteredSupplements =
    mode === "rest" || sleepStress
      ? supplements.filter((s) => {
          const id = s.id.toLowerCase();
          if (sleepStress && (id.includes("pre") || id.includes("termo") || id.includes("cafe"))) {
            return false;
          }
          return true;
        })
      : supplements;

  const why: string[] = [];
  if (insights?.reasons.length) why.push(...insights.reasons);
  if (sleepH < 6) {
    why.push(`Sono de ${sleepH}h — volume de treino reduzido e stims evitados.`);
  } else if (sleepH < 7) {
    why.push(`Sono de ${sleepH}h — recuperação no radar; mantenha o plano leve se sentir fadiga.`);
  }
  if (energy === "baixa") why.push("Energia baixa no check-in — priorizei estímulo sustentável.");
  if (timeTight && day) why.push(`Só ${availableMin} min disponíveis — sessão express.`);
  if (noEquipment) why.push("Sem equipamento hoje — plano casa/peso corporal.");
  if (weekMode === "deload") why.push("Semana em modo deload (RPE recente).");
  if (weekMode === "push") why.push("Semana em modo push — RPE recentes fáceis.");
  if (profile.primaryBlocker) {
    why.push(`Bloqueio declarado: ${BLOCKER_LABEL[profile.primaryBlocker]}.`);
  }
  if (profile.skipBreakfast) why.push("Você pula o café — proteína redistribuída nas outras refeições.");
  if (blockerDim && blockerDim.score < 55) {
    why.push(`Eixo mais fraco agora: ${blockerDim.label} (${blockerDim.score}/100).`);
  }
  const activeHub = activeHubForState(state.joinedHubIds);
  if (activeHub) {
    why.push(`Hub ativo: ${activeHub.name} (${activeHub.creatorName}).`);
  }
  if (!why.length) why.push("Sem sinais de alerta — plano padrão do dia.");

  const trainingScore =
    dims.find((d) => d.key === "forca")?.score ??
    dims.find((d) => d.key === "consistencia")?.score ??
    50;
  const nutritionScore = dims.find((d) => d.key === "nutricao")?.score ?? 50;
  const recoveryScore =
    dims.find((d) => d.key === "recuperacao")?.score ??
    dims.find((d) => d.key === "sono")?.score ??
    50;

  const hubSuffix = activeHub ? ` Hub: ${activeHub.name}.` : "";
  const narrative =
    mode === "rest"
      ? `Hoje é recuperação ativa. Seu maior freio agora é ${blockerDim?.label ?? "consistência"} — use o dia para sono e proteína.${hubSuffix}`
      : sleepStress
        ? `Você não está recuperado o bastante para ir pesado. Mantive o estímulo de ${title}, mas com volume ~${Math.round(volumeFactor * 100)}%.${hubSuffix}`
        : `Hoje você está bem para treinar. Foco: ${title}. Bloqueio monitorado: ${blockerDim?.label ?? "nenhum"}.${hubSuffix}`;

  const sleepTargetHours = sleepH < 7 ? 8 : Math.max(7.5, profile.typicalSleepHours ?? 7.5);

  const snapshot: LivingPlanSnapshot = {
    date,
    generatedAt: new Date().toISOString(),
    score,
    blocker: blockerDim
      ? { key: blockerDim.key, label: blockerDim.label, score: blockerDim.score }
      : null,
    traffic: {
      training: trafficForScore(trainingScore),
      nutrition: trafficForScore(nutritionScore),
      recovery: trafficForScore(recoveryScore),
    },
    workout: {
      mode,
      title,
      estimatedMin,
      dayId: day?.id ?? null,
      volumeFactor,
    },
    nutrition: {
      proteinG,
      kcal,
      waterMl: goals.waterMl,
      skipBreakfast: profile.skipBreakfast === true,
    },
    supplements: filteredSupplements,
    sleepTargetHours,
    narrative,
    why,
    diffFromYesterday: [],
  };

  const prev = state.livingPlans?.[yesterdayKey(date)];
  if (prev) {
    const diffs: string[] = [];
    if (prev.workout.mode !== snapshot.workout.mode) {
      diffs.push(`Treino: ${prev.workout.mode} → ${snapshot.workout.mode}`);
    }
    if (Math.abs(prev.nutrition.kcal - snapshot.nutrition.kcal) >= 50) {
      diffs.push(`Kcal: ${prev.nutrition.kcal} → ${snapshot.nutrition.kcal}`);
    }
    if (Math.abs(prev.workout.volumeFactor - snapshot.workout.volumeFactor) >= 0.05) {
      diffs.push(
        `Volume: ${Math.round(prev.workout.volumeFactor * 100)}% → ${Math.round(snapshot.workout.volumeFactor * 100)}%`,
      );
    }
    if (prev.blocker?.key !== snapshot.blocker?.key) {
      diffs.push(`Bloqueio: ${prev.blocker?.label ?? "—"} → ${snapshot.blocker?.label ?? "—"}`);
    }
    snapshot.diffFromYesterday = diffs;
  }

  return snapshot;
}

export function livingPlanForDate(state: AppState, date = todayKey()): LivingPlanSnapshot | null {
  return state.livingPlans?.[date] ?? buildLivingPlan(state, date);
}
