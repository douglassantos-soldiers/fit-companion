/**
 * Server-side typed CoachContext — never send full AppState to the LLM.
 */
import { buildCustomer360FromState } from "@/lib/customer360";
import { buildCoachContextFromState } from "@/lib/engine/coach-context";
import { buildUserContext } from "@/lib/engine/context";
import { buildLivingPlanWithDecisions } from "@/lib/engine/living-plan";
import { extractUserPatterns, patternInsights, computeLearningInsights } from "@/lib/engine/learning";
import { dayNutritionTotals, nutritionGoals } from "@/lib/engine/nutrition";
import { evaluateSafetyForDate } from "@/lib/engine/safety";
import { sessionsInLastDays, streak } from "@/lib/engine/dimensions";
import { currentPersonalRecords } from "@/lib/training/prs";
import { estimated1RM } from "@/lib/training/one-rm";
import { listExercisesWithHistory, hitsForExercise } from "@/lib/engine/exercise-history";
import { buildNutritionContext } from "@/lib/nutrition/nutrition-context";
import type { CoachContext, CoachMemoryEntry } from "@/lib/coach/types";
import { GOAL_LABEL, LEVEL_LABEL, todayKey, type AppState } from "@/lib/types";

function hardRpeStreak(sessions: AppState["sessions"]): number {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  let n = 0;
  for (const s of sorted) {
    if (s.rpe === "dificil") n += 1;
    else break;
  }
  return n;
}

function top1rmEstimates(sessions: AppState["sessions"], limit = 5) {
  const summaries = listExercisesWithHistory(sessions, 20);
  const rows: Array<{ exerciseId: string; estimated1rm: number }> = [];
  for (const sum of summaries) {
    const hits = hitsForExercise(sum.exerciseId, sessions);
    const latest = hits[0];
    if (!latest || latest.maxWeightKg <= 0) continue;
    const est = estimated1RM(latest.maxWeightKg, Math.max(1, Math.round(latest.avgReps)));
    rows.push({ exerciseId: sum.exerciseId, estimated1rm: Math.round(est * 10) / 10 });
  }
  rows.sort((a, b) => b.estimated1rm - a.estimated1rm);
  return rows.slice(0, limit);
}

function recentPrLabels(sessions: AppState["sessions"]) {
  return currentPersonalRecords(sessions)
    .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))
    .slice(0, 5)
    .map((pr) => ({ label: pr.label, value: pr.value, date: pr.achievedAt }));
}

/** Build typed context from trusted AppState (already hydrated). */
export function buildTypedCoachContextFromState(
  state: AppState,
  opts?: {
    date?: string;
    memory?: CoachMemoryEntry[];
    recentDecisions?: CoachContext["recentDecisions"];
    recentOutcomes?: CoachContext["recentOutcomes"];
    loggedTodayDecisions?: CoachContext["todayDecisions"];
  },
): CoachContext {
  const date = opts?.date ?? todayKey();
  const p = state.profile;
  const insights = p ? computeLearningInsights(state) : null;
  const goals = p ? nutritionGoals(p, insights) : null;
  const safety = evaluateSafetyForDate(state, date);
  const built = p ? buildLivingPlanWithDecisions(state, date) : null;
  const living = state.livingPlans?.[date] ?? built?.plan ?? null;
  const checkIn = state.dayCheckIns?.[date];
  const totals = dayNutritionTotals(state.meals ?? [], date);
  const nutCtx = goals
    ? buildNutritionContext(state.meals ?? [], { ...goals, waterMl: goals.waterMl }, date)
    : null;
  const c360 = buildCustomer360FromState(state);
  const patterns = extractUserPatterns(state);
  const patternLines = patternInsights(patterns);
  const ctx = buildUserContext(state, state.userId);
  const prs = recentPrLabels(state.sessions ?? []);
  const sessions7 = sessionsInLastDays(state.sessions ?? [], 7);
  const sessions28 = sessionsInLastDays(state.sessions ?? [], 28);
  const last = [...(state.sessions ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];

  const recomputed =
    built?.decisions.decisions.map((d) => ({
      type: d.decisionType,
      value: String(d.decisionValue),
      reasonCodes: d.reasonCodes,
      confidence: d.confidence,
      explanation: d.explanation,
      source: "recomputed_live" as const,
    })) ?? [];

  const todayDecisions =
    opts?.loggedTodayDecisions?.length
      ? opts.loggedTodayDecisions.map((d) => ({
          ...d,
          source: d.source ?? ("decision_log" as const),
        }))
      : recomputed;

  const bundle = buildCoachContextFromState(state);

  return {
    userId: state.userId ?? "",
    date,
    profile: p
      ? {
          name: p.name,
          goal: GOAL_LABEL[p.goal],
          level: LEVEL_LABEL[p.level],
          weightKg: p.weightKg,
          daysPerWeek: p.daysPerWeek,
          equipment: p.equipment,
          restrictions: p.restrictions ?? [],
          ...(p.primaryBlocker ? { primaryBlocker: p.primaryBlocker } : {}),
        }
      : null,
    goals: goals
      ? { proteinG: goals.proteinG, kcal: goals.kcal, waterMl: goals.waterMl }
      : null,
    training: {
      streak: streak(state.sessions ?? []),
      sessions7d: sessions7.length,
      sessions28d: sessions28.length,
      todayMode: living?.workout.mode ?? null,
      todayTitle: living?.workout.title ?? null,
      volumeFactor: living?.workout.volumeFactor ?? null,
      lastSessionDate: last?.date ?? null,
      lastSessionRpe: last?.rpe ?? null,
    },
    exercisePerformance: {
      recentPrs: prs,
      top1rm: top1rmEstimates(state.sessions ?? []),
    },
    recovery: {
      level: c360.recovery.level ?? null,
      score: c360.recovery.recoveryScore,
      sleepHours: checkIn?.sleepHours ?? p?.typicalSleepHours ?? null,
      energy: checkIn?.energy ?? null,
      hardRpeStreak: hardRpeStreak(state.sessions ?? []) || (c360.performance.avgRpeHardStreak ?? 0),
    },
    nutrition: {
      proteinG: totals.proteinG,
      carbG: totals.carbG,
      fatG: totals.fatG,
      kcal: totals.kcal,
      mealsLogged: totals.count,
      proteinTarget: goals?.proteinG ?? null,
      loggingConfidence: nutCtx?.loggingConfidence ?? null,
    },
    supplements: {
      routineIds: state.supplementRoutine ?? [],
      adherence30d: c360.supplements.adherence30d,
    },
    behavior: {
      workouts7d: sessions7.length,
      meals7d: (state.meals ?? []).filter((m) => {
        const lim = new Date(`${date}T12:00:00`);
        lim.setDate(lim.getDate() - 7);
        return new Date(m.date) >= lim;
      }).length,
      coachMessages: (state.chat ?? []).length,
    },
    customer360: {
      nutritionAdherence: c360.nutrition.proteinAdherence7d,
      recoveryScore: c360.recovery.recoveryScore,
      performanceScore: c360.performance.sessions28d,
    },
    todayDecisions,
    recentDecisions: opts?.recentDecisions ?? [],
    recentOutcomes: opts?.recentOutcomes ?? [],
    userPatterns: patternLines,
    safety: {
      escalateCare: safety.escalateCare,
      blockStims: safety.blockStims,
      preferLightTraining: safety.preferLightTraining,
      flags: safety.flags,
      reasons: safety.reasons,
    },
    memory: opts?.memory ?? [],
    livingSummary: bundle.livingSummary,
    why: living?.why?.length ? living.why : ctx.why,
    reasonCodes: ctx.reasonCodes,
  };
}

/** Compact allowlisted prompt text — no secrets / raw commerce. */
export function formatCoachContextForPrompt(ctx: CoachContext): string {
  const lines: string[] = [
    "Baseie-se nos dados abaixo. Nunca invente números. Não dê diagnóstico médico.",
    "Engines calculam. Decision Engine decide. Você só explica. UI executa.",
    `Data: ${ctx.date}`,
  ];

  if (!ctx.profile) {
    lines.push("Perfil incompleto — incentive a completar o perfil.");
    return lines.join("\n");
  }

  lines.push(
    `Nome: ${ctx.profile.name}`,
    `Objetivo: ${ctx.profile.goal} | Nível: ${ctx.profile.level} | Local: ${ctx.profile.equipment}`,
    `Peso ${ctx.profile.weightKg} kg | ${ctx.profile.daysPerWeek} treinos/semana`,
    ctx.profile.restrictions.length
      ? `Restrições: ${ctx.profile.restrictions.join(", ")}`
      : "Sem restrições",
  );

  lines.push(
    `Treino: streak ${ctx.training.streak} | 7d=${ctx.training.sessions7d} | 28d=${ctx.training.sessions28d}`,
    `Hoje: mode=${ctx.training.todayMode ?? "—"} | ${ctx.training.todayTitle ?? "—"} | volume=${ctx.training.volumeFactor ?? "—"}`,
    `Última sessão: ${ctx.training.lastSessionDate ?? "—"} rpe=${ctx.training.lastSessionRpe ?? "—"}`,
  );

  if (ctx.exercisePerformance.recentPrs.length) {
    lines.push(
      `PRs recentes: ${ctx.exercisePerformance.recentPrs.map((p) => p.label).join("; ")}`,
    );
  }

  lines.push(
    `Recovery: level=${ctx.recovery.level ?? "—"} score=${ctx.recovery.score ?? "—"} sleep=${ctx.recovery.sleepHours ?? "—"}h energy=${ctx.recovery.energy ?? "—"} hardRpeStreak=${ctx.recovery.hardRpeStreak}`,
    `Nutrição hoje: P=${ctx.nutrition.proteinG}g C=${ctx.nutrition.carbG}g G=${ctx.nutrition.fatG}g kcal=${ctx.nutrition.kcal} meals=${ctx.nutrition.mealsLogged} targetP=${ctx.nutrition.proteinTarget ?? "—"}`,
    `Supps: ${ctx.supplements.routineIds.join(", ") || "nenhum"} | aderência30d=${ctx.supplements.adherence30d ?? "—"}`,
    `C360: nutritionAdherence=${ctx.customer360.nutritionAdherence ?? "—"} recovery=${ctx.customer360.recoveryScore ?? "—"} sessions28d=${ctx.customer360.performanceScore ?? "—"}`,
  );

  lines.push(
    `Safety: escalate=${ctx.safety.escalateCare} blockStims=${ctx.safety.blockStims} light=${ctx.safety.preferLightTraining} flags=${ctx.safety.flags.join(",")}`,
    ...ctx.safety.reasons.map((r) => `- ${r}`),
  );

  if (ctx.todayDecisions.length) {
    const src = ctx.todayDecisions[0]?.source === "decision_log" ? "decision_log" : "recomputed_live";
    lines.push(`Decisões de hoje (fonte=${src}; NÃO recalcule):`);
    for (const d of ctx.todayDecisions) {
      lines.push(
        `- ${d.type}=${d.value} | codes=[${d.reasonCodes.join(",")}] | conf=${d.confidence} | ${d.explanation}`,
      );
    }
  }

  if (ctx.recentOutcomes?.length) {
    lines.push(
      `Outcomes recentes: ${ctx.recentOutcomes
        .slice(0, 6)
        .map((o) => `${o.outcomeType}@${o.observedAt.slice(0, 10)}`)
        .join("; ")}`,
    );
  }

  if (ctx.recentDecisions.length) {
    lines.push(
      `Decisões recentes: ${ctx.recentDecisions
        .slice(0, 6)
        .map((d) => `${d.date}:${d.type}=${d.value}`)
        .join("; ")}`,
    );
  }

  if (ctx.userPatterns.length) {
    lines.push("Padrões:", ...ctx.userPatterns.map((p) => `- ${p}`));
  }

  if (ctx.memory.length) {
    lines.push(
      "Memória do coach (fatos/prefs):",
      ...ctx.memory.slice(0, 12).map((m) => `- [${m.kind}] ${m.key}=${JSON.stringify(m.value)}`),
    );
  }

  if (ctx.why.length) {
    lines.push("Por quê:", ...ctx.why.map((w) => `- ${w}`));
  }

  lines.push(`Living summary: ${ctx.livingSummary}`);
  if (ctx.reasonCodes.length) {
    lines.push(`Reason codes: ${ctx.reasonCodes.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Hydrate DB + build typed CoachContext for trusted userId.
 */
export async function buildCoachContext(userId: string, date?: string): Promise<{
  typed: CoachContext;
  contextText: string;
  safetyNotice?: string;
  why: string[];
  decisions: Array<{ type: string; value: string | number | boolean; explanation: string }>;
  livingSummary: string;
  state: AppState;
}> {
  const { hydrateAppStateFromDb } = await import("@/lib/customer360/hydrate.server");
  let state = await hydrateAppStateFromDb(userId);
  state = { ...state, userId };

  try {
    const { loadCustomerProfile } = await import("@/lib/customer360/recompute.server");
    const c360 = await loadCustomerProfile(userId);
    if (c360?.commerce) {
      state = {
        ...state,
        purchaseProductIds:
          state.purchaseProductIds?.length
            ? state.purchaseProductIds
            : (c360.commerce.productIds ?? state.purchaseProductIds ?? []),
      };
    }
  } catch {
    /* optional */
  }

  const day = date ?? todayKey();
  let memory: CoachMemoryEntry[] = [];
  let recentDecisions: CoachContext["recentDecisions"] = [];
  let recentOutcomes: CoachContext["recentOutcomes"] = [];
  let loggedTodayDecisions: CoachContext["todayDecisions"] = [];

  try {
    const { loadCoachMemory } = await import("@/lib/coach/memory.server");
    memory = await loadCoachMemory(userId);
  } catch {
    /* table may not exist yet */
  }

  try {
    const { loadDecisionsForDate, loadRecentOutcomes } = await import("@/lib/decision-log.server");
    const { adminDbLoose } = await import("@/lib/db-admin");
    const db = await adminDbLoose();
    if (db) {
      const todayRows = await loadDecisionsForDate({ userId, date: day });
      if (todayRows.length) {
        loggedTodayDecisions = todayRows.map((r) => ({
          type: r.decision_type,
          value: String(r.decision_value?.value ?? ""),
          reasonCodes: r.reason_codes ?? [],
          confidence: r.confidence ?? 0.5,
          explanation:
            (r.evidence?.notes?.[0] as string | undefined) ??
            `${r.decision_type}=${String(r.decision_value?.value ?? "")}`,
          source: "decision_log" as const,
        }));
      }
      recentOutcomes = (await loadRecentOutcomes({ userId, limit: 15 })).map((o) => ({
        outcomeType: o.outcome_type,
        value: o.value,
        observedAt: o.observed_at,
      }));
      const { data } = await db
        .from("recommendation_decisions")
        .select("date, decision_type, decision_value, reason_codes, outcome")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(20);
      recentDecisions = ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
        const val = r["decision_value"];
        const value =
          val && typeof val === "object" && "value" in (val as object)
            ? String((val as { value: unknown }).value)
            : String(val ?? "");
        return {
          date: String(r["date"] ?? ""),
          type: String(r["decision_type"] ?? ""),
          value,
          reasonCodes: Array.isArray(r["reason_codes"])
            ? (r["reason_codes"] as string[])
            : [],
          outcome: (r["outcome"] as string | null) ?? null,
        };
      });
    }
  } catch {
    /* optional */
  }

  const typed = buildTypedCoachContextFromState(state, {
    date: day,
    memory,
    recentDecisions,
    recentOutcomes,
    loggedTodayDecisions,
  });
  const contextText = formatCoachContextForPrompt(typed);
  const legacy = buildCoachContextFromState(state);

  const safetyNotice = typed.safety.escalateCare
    ? typed.safety.reasons.find((r) => r.includes("profissional") || r.includes("atenção")) ??
      "Há um sinal no check-in que merece atenção profissional — não trate como adaptação de treino."
    : undefined;

  return {
    typed,
    contextText,
    safetyNotice,
    why: typed.why,
    decisions: legacy.decisions,
    livingSummary: typed.livingSummary,
    state,
  };
}
