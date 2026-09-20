import { PRODUCTS, productById } from "@/data/products";
import { activeHubForState } from "@/data/hubs";
import { lessonForToday } from "@/data/habit-lessons";
import {
  performanceDimensions,
  performanceScore,
  primaryBlockerDimension,
  trafficForScore,
} from "@/lib/engine/dimensions";
import { buildContextSnapshot } from "@/lib/engine/context-snapshot";
import { buildUserContext } from "@/lib/engine/context";
import { computeDecisions, type DecisionBundle } from "@/lib/engine/decision";
import { computeLearningInsights, learningWeekHint } from "@/lib/engine/learning";
import { runBehaviorLoop } from "@/lib/engine/behavior";
import { nutritionGoals } from "@/lib/engine/nutrition";
import { buildExpressSession, buildWeeklyPlanDetailed, planDayForToday } from "@/lib/engine/plan";
import { evaluateSafety } from "@/lib/engine/safety";
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

export type LivingPlanBuildResult = {
  plan: LivingPlanSnapshot;
  decisions: DecisionBundle;
  behavior?: import("@/lib/engine/behavior").BehaviorLoopResult;
};

/** Build integrated living plan for a given date (defaults to today). */
export function buildLivingPlan(state: AppState, date = todayKey()): LivingPlanSnapshot | null {
  return buildLivingPlanWithDecisions(state, date)?.plan ?? null;
}

/** Living Plan + Decision Engine bundle (FASE 4). */
export function buildLivingPlanWithDecisions(
  state: AppState,
  date = todayKey(),
): LivingPlanBuildResult | null {
  const profile = state.profile;
  if (!profile) return null;

  const insights = computeLearningInsights(state);
  const dims = performanceDimensions(state, profile);
  const score = performanceScore(dims);
  const blockerDim = primaryBlockerDimension(state, profile);
  const checkIn = state.dayCheckIns?.[date];
  const sleepH = sleepHoursForDay(state, profile, date);
  const energy = checkIn?.energy ?? "ok";
  const noEquipment = checkIn?.noEquipment === true;
  const equipment =
    checkIn?.equipment ?? (noEquipment ? ("casa" as const) : profile.equipment);

  const weekHint = learningWeekHint(state);
  const prefs = {
    likedExerciseIds: state.likedExerciseIds ?? [],
    dislikedExerciseIds: state.dislikedExerciseIds ?? [],
    exercisePreferences: state.exercisePreferences,
  };
  const { days: plan, weekMode } = buildWeeklyPlanDetailed(
    profile,
    state.sessions,
    equipment,
    weekHint,
    prefs,
  );
  const day = planDayForToday(plan, new Date(`${date}T12:00:00`));

  const snapshot = buildContextSnapshot(state, date, state.userId);
  if (!snapshot) return null;

  const safety = evaluateSafety(state, { date });
  const bundle = computeDecisions(snapshot, safety, {
    plannedMinutes: day?.estimatedMin ?? 0,
    hasTrainingDay: Boolean(day),
  });

  const mode = bundle.trainingMode;
  const volumeFactor = bundle.trainingVolume;
  let estimatedMin = bundle.sessionDuration;
  let title = day?.title ?? "Descanso ativo";

  if (mode === "rest") {
    title = "Descanso ativo";
    estimatedMin = 0;
  } else if (mode === "deload" && day) {
    title = `${day.title} (leve)`;
    estimatedMin = Math.round(day.estimatedMin * volumeFactor);
  } else if (mode === "express" && day) {
    const express = buildExpressSession(day);
    estimatedMin = express?.estimatedMin ?? Math.min(35, snapshot.availableTimeMin ?? 35);
    title = express?.title ?? `${day.title} express`;
  }

  const goals = nutritionGoals(profile, insights);
  let kcal = goals.kcal + bundle.calorieDelta;
  let proteinG = goals.proteinG;
  if (bundle.proteinBias === "up") {
    proteinG = Math.round(proteinG * 1.05);
  }
  kcal = Math.max(1400, Math.round(kcal));
  // FASE 7: skipBreakfast / activeSlots redistribute via buildDailyMealPlan — daily totals unchanged.

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

  const sleepStress = sleepH < 6 || energy === "baixa";
  const filteredSupplements =
    mode === "rest" || sleepStress || bundle.blockStims || safety.blockStims
      ? supplements.filter((s) => {
          const id = s.id.toLowerCase();
          if (
            (sleepStress || bundle.blockStims || safety.blockStims) &&
            (id.includes("pre") || id.includes("termo") || id.includes("cafe"))
          ) {
            return false;
          }
          return true;
        })
      : supplements;

  // WHY from Decision Engine explanations (structured), plus light extras
  const why: string[] = [];
  for (const d of bundle.decisions) {
    if (
      d.decisionType === "training_mode" ||
      d.decisionType === "training_volume" ||
      d.decisionType === "primary_action" ||
      d.decisionType === "block_stims" ||
      (d.decisionType === "nutrition_calorie_delta" && Number(d.decisionValue) !== 0) ||
      (d.decisionType === "nutrition_protein_bias" && d.decisionValue === "up")
    ) {
      if (!why.includes(d.explanation)) why.push(d.explanation);
    }
  }
  if (profile.primaryBlocker) {
    why.push(`Bloqueio declarado: ${BLOCKER_LABEL[profile.primaryBlocker]}.`);
  }
  const activeSlots = profile.nutritionProfile?.activeSlots;
  const skipsCafe =
    profile.skipBreakfast === true ||
    (Array.isArray(activeSlots) && !activeSlots.includes("cafe"));
  if (skipsCafe) {
    const n =
      (activeSlots?.length && activeSlots.length > 0
        ? activeSlots.length
        : profile.skipBreakfast
          ? 3
          : 4) || 3;
    why.push(`Sem café — meta redistribuída em ${n} refeições.`);
  }
  if (blockerDim && blockerDim.score < 55) {
    why.push(`Eixo mais fraco agora: ${blockerDim.label} (${blockerDim.score}/100).`);
  }
  const activeHub = activeHubForState(state.joinedHubIds);
  if (activeHub) {
    why.push(`Hub ativo: ${activeHub.name} (${activeHub.creatorName}).`);
  }

  const ctxWhy = buildUserContext(state, state.userId).why;
  let added = 0;
  for (const line of ctxWhy) {
    if (added >= 2) break;
    const dup = why.some(
      (w) => w === line || w.includes(line.slice(0, 24)) || line.includes(w.slice(0, 24)),
    );
    if (dup) continue;
    why.push(line);
    added += 1;
  }

  if (!why.length) why.push("Sem sinais de alerta — plano padrão do dia.");

  if (safety.escalateCare) {
    why.unshift(
      safety.reasons.find((r) => r.includes("profissional") || r.includes("atenção")) ??
        "Há um sinal que merece atenção — priorizei recuperação, não adaptação de volume.",
    );
  }

  const trainingScore =
    dims.find((d) => d.key === "forca")?.score ??
    dims.find((d) => d.key === "consistencia")?.score ??
    50;
  const nutritionScore = dims.find((d) => d.key === "nutricao")?.score ?? 50;
  const recoveryScore =
    dims.find((d) => d.key === "recuperacao")?.score ??
    dims.find((d) => d.key === "sono")?.score ??
    50;
  const consistencyScore = dims.find((d) => d.key === "consistencia")?.score ?? 50;

  const behaviorLoop = runBehaviorLoop(state);
  const habit = lessonForToday(
    new Date(`${date}T12:00:00`),
    {
      triggers: behaviorLoop.triggers,
      patterns: behaviorLoop.patterns,
      profile: behaviorLoop.profile,
      weekday: new Date(`${date}T12:00:00`).getDay(),
    },
    state.profile ? { goal: state.profile.goal, level: state.profile.level } : null,
  );

  const whyByChange: LivingPlanSnapshot["whyByChange"] = [];
  const modeDecision = bundle.decisions.find((d) => d.decisionType === "training_mode");
  const volDecision = bundle.decisions.find((d) => d.decisionType === "training_volume");
  const kcalDecision = bundle.decisions.find((d) => d.decisionType === "nutrition_calorie_delta");
  const proteinDecision = bundle.decisions.find((d) => d.decisionType === "nutrition_protein_bias");
  const stimDecision = bundle.decisions.find((d) => d.decisionType === "block_stims");
  const primaryDecision = bundle.decisions.find((d) => d.decisionType === "primary_action");

  if (modeDecision && (modeDecision.decisionValue !== "full" || safety.escalateCare)) {
    whyByChange.push({
      key: "training",
      label: "Treino",
      reason: modeDecision.explanation,
    });
  } else if (volDecision && Number(volDecision.decisionValue) < 1) {
    whyByChange.push({
      key: "training",
      label: "Volume",
      reason: volDecision.explanation,
    });
  }
  if (kcalDecision && Number(kcalDecision.decisionValue) !== 0) {
    whyByChange.push({
      key: "calories",
      label: "Calorias",
      reason: kcalDecision.explanation,
    });
  }
  if (proteinDecision && proteinDecision.decisionValue === "up") {
    whyByChange.push({
      key: "protein",
      label: "Proteína",
      reason: proteinDecision.explanation,
    });
  }
  if (stimDecision && stimDecision.decisionValue === true) {
    whyByChange.push({
      key: "stims",
      label: "Suplementação",
      reason: stimDecision.explanation,
    });
  }
  if (
    primaryDecision &&
    (primaryDecision.decisionValue === "rest" || primaryDecision.decisionValue === "sleep")
  ) {
    whyByChange.push({
      key: "recovery",
      label: "Recuperação",
      reason: primaryDecision.explanation,
    });
  }

  const hubSuffix = activeHub ? ` Hub: ${activeHub.name}.` : "";
  const narrative = safety.escalateCare
    ? `Hoje o foco é cuidado e recuperação — não estímulo intenso. ${blockerDim?.label ? `Freio monitorado: ${blockerDim.label}.` : ""}${hubSuffix}`
    : mode === "rest"
      ? `Hoje é recuperação ativa. Seu maior freio agora é ${blockerDim?.label ?? "consistência"} — use o dia para sono e proteína.${hubSuffix}`
      : sleepStress
        ? `Você não está recuperado o bastante para ir pesado. Mantive o estímulo de ${title}, mas com volume ~${Math.round(volumeFactor * 100)}%.${hubSuffix}`
        : `Hoje você está bem para treinar. Foco: ${title}. Bloqueio monitorado: ${blockerDim?.label ?? "nenhum"}.${hubSuffix}`;

  const sleepTargetHours = sleepH < 7 ? 8 : Math.max(7.5, profile.typicalSleepHours ?? 7.5);

  const primaryConf =
    primaryDecision?.confidence ??
    modeDecision?.confidence ??
    snapshot.confidenceBase;
  const confidenceLabel: LivingPlanSnapshot["confidenceLabel"] =
    primaryConf >= 0.72 ? "alta" : primaryConf >= 0.5 ? "media" : "baixa";
  const howParts = [
    mode === "rest"
      ? "Descanso ativo"
      : mode === "express"
        ? `Express ~${estimatedMin} min`
        : mode === "deload"
          ? `Deload · ${title}`
          : `Treino ${title}`,
    mode !== "rest" ? `volume ${Math.round(volumeFactor * 100)}%` : null,
    `proteína ${proteinG}g`,
  ].filter(Boolean);

  const livingSnapshot: LivingPlanSnapshot = {
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
      consistency: trafficForScore(consistencyScore),
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
    habits: {
      title: habit.title,
      tip: habit.tip,
      ...(habit.id.startsWith("cms:") ? { contentId: habit.id.slice(4) } : {}),
    },
    narrative,
    why: why.slice(0, 8),
    whyByChange,
    diffFromYesterday: [],
    how: howParts.join(" · "),
    confidence: Math.round(primaryConf * 100) / 100,
    confidenceLabel,
  };

  const prev = state.livingPlans?.[yesterdayKey(date)];
  if (prev) {
    const diffs: string[] = [];
    if (prev.workout.mode !== livingSnapshot.workout.mode) {
      diffs.push(`Treino: ${prev.workout.mode} → ${livingSnapshot.workout.mode}`);
    }
    if (Math.abs(prev.nutrition.kcal - livingSnapshot.nutrition.kcal) >= 50) {
      diffs.push(`Kcal: ${prev.nutrition.kcal} → ${livingSnapshot.nutrition.kcal}`);
    }
    if (Math.abs(prev.workout.volumeFactor - livingSnapshot.workout.volumeFactor) >= 0.05) {
      diffs.push(
        `Volume: ${Math.round(prev.workout.volumeFactor * 100)}% → ${Math.round(livingSnapshot.workout.volumeFactor * 100)}%`,
      );
    }
    if (prev.blocker?.key !== livingSnapshot.blocker?.key) {
      diffs.push(`Bloqueio: ${prev.blocker?.label ?? "—"} → ${livingSnapshot.blocker?.label ?? "—"}`);
    }
    livingSnapshot.diffFromYesterday = diffs;
  }

  return { plan: livingSnapshot, decisions: bundle, behavior: behaviorLoop };
}

export function livingPlanForDate(state: AppState, date = todayKey()): LivingPlanSnapshot | null {
  return state.livingPlans?.[date] ?? buildLivingPlan(state, date);
}
