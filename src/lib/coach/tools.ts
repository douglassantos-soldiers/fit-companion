/**
 * Coach tools — server-side allowlist. Always use trusted session userId; ignore forged args.userId.
 */
import { buildTypedCoachContextFromState } from "@/lib/coach/context.server";
import type { CoachToolName } from "@/lib/coach/types";
import { consecutiveHardRpeStreak, muscleRecoveryMap } from "@/lib/engine/recovery";
import { plateauExerciseIds } from "@/lib/engine/exercise-history";
import { currentPersonalRecords } from "@/lib/training/prs";
import { estimated1RM } from "@/lib/training/one-rm";
import { hitsForExercise, listExercisesWithHistory } from "@/lib/engine/exercise-history";
import { buildNutritionContext } from "@/lib/nutrition/nutrition-context";
import { nutritionGoals } from "@/lib/engine/nutrition";
import {
  computeLearningInsights,
  extractUserPatterns,
  patternInsights,
} from "@/lib/engine/learning";
import { runBehaviorLoop } from "@/lib/engine/behavior";
import { todayKey, type AppState } from "@/lib/types";
import { libraryById, resolvedLibrary } from "@/data/exercise-library";
import { PRODUCTS, productById } from "@/data/products";
import { resolveExerciseMedia, resolveHowtoMedia, resolveProductMedia } from "@/lib/soldiers-media";

export const COACH_TOOL_NAMES: CoachToolName[] = [
  "get_profile",
  "get_training_history",
  "get_exercise_history",
  "get_prs",
  "get_1rm",
  "get_muscle_recovery",
  "get_nutrition_context",
  "get_recovery_context",
  "get_behavior_patterns",
  "get_active_triggers",
  "get_recent_interventions",
  "get_experiment_status",
  "get_recent_decisions",
  "get_today_plan",
  "get_exercise_guide",
  "get_howto",
];

export type CoachToolArgs = {
  /** Ignored if present — only trustedUserId is used */
  userId?: string;
  exerciseId?: string;
  query?: string;
  howtoId?: string;
  productId?: string;
  limit?: number;
  date?: string;
};

async function loadState(trustedUserId: string): Promise<AppState> {
  const { getOrBuildDecisionContext } = await import("@/lib/engine/decision-context.server");
  const built = await getOrBuildDecisionContext(trustedUserId);
  if (built?.state) return { ...built.state, userId: trustedUserId };
  const { hydrateAppStateFromDb } = await import("@/lib/customer360/hydrate.server");
  const state = await hydrateAppStateFromDb(trustedUserId);
  return { ...state, userId: trustedUserId };
}

/**
 * Execute a coach tool. `trustedUserId` MUST come from session identity — never from client args.
 */
export async function runCoachTool(
  trustedUserId: string,
  name: CoachToolName,
  args: CoachToolArgs = {},
): Promise<unknown> {
  if (!trustedUserId) throw new Error("unauthorized_tool");
  // Hard reject forged identity
  if (args.userId && args.userId !== trustedUserId) {
    throw new Error("forged_user_context");
  }

  const state = await loadState(trustedUserId);
  const date = args.date ?? todayKey();
  const ctx = buildTypedCoachContextFromState(state, { date });
  const limit = Math.min(40, Math.max(1, args.limit ?? 10));

  switch (name) {
    case "get_profile":
      return { profile: ctx.profile, goals: ctx.goals };

    case "get_training_history":
      return {
        sessions: (state.sessions ?? [])
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, limit)
          .map((s) => ({
            id: s.id,
            date: s.date,
            title: s.title,
            durationMin: s.durationMin,
            volumeKg: s.volumeKg,
            rpe: s.rpe ?? null,
            express: s.express ?? false,
          })),
        streak: ctx.training.streak,
        sessions7d: ctx.training.sessions7d,
      };

    case "get_exercise_history": {
      if (args.exerciseId) {
        const hits = hitsForExercise(args.exerciseId, state.sessions ?? []).slice(0, limit);
        return { exerciseId: args.exerciseId, hits };
      }
      return {
        exercises: listExercisesWithHistory(state.sessions ?? [], limit).map((s) => ({
          exerciseId: s.exerciseId,
          hits: s.hits.length,
          lastDate: s.hits[0]?.date ?? null,
          plateau: s.plateau,
        })),
        plateaus: plateauExerciseIds(state.sessions ?? []).slice(0, 10),
      };
    }

    case "get_prs":
      return {
        prs: currentPersonalRecords(state.sessions ?? [])
          .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))
          .slice(0, limit)
          .map((p) => ({
            label: p.label,
            type: p.prType,
            value: p.value,
            date: p.achievedAt,
            exerciseId: p.exerciseId,
          })),
      };

    case "get_1rm": {
      if (args.exerciseId) {
        const hits = hitsForExercise(args.exerciseId, state.sessions ?? []);
        const latest = hits[0];
        if (!latest || latest.maxWeightKg <= 0)
          return { exerciseId: args.exerciseId, estimated1rm: null };
        return {
          exerciseId: args.exerciseId,
          estimated1rm:
            Math.round(
              estimated1RM(latest.maxWeightKg, Math.max(1, Math.round(latest.avgReps))) * 10,
            ) / 10,
          at: latest.date,
        };
      }
      return { top: ctx.exercisePerformance.top1rm };
    }

    case "get_muscle_recovery": {
      const check = state.dayCheckIns?.[date];
      return {
        recovery: muscleRecoveryMap(state.sessions ?? [], new Date(), {
          ...(check?.sleepHours != null ? { sleepHours: check.sleepHours } : {}),
          ...(check?.energy ? { energy: check.energy } : {}),
          sessionRpeHardStreak: consecutiveHardRpeStreak(state.sessions ?? []),
        }),
      };
    }

    case "get_nutrition_context": {
      if (!state.profile) return { error: "no_profile" };
      const insights = computeLearningInsights(state);
      const goals = nutritionGoals(state.profile, insights);
      return buildNutritionContext(state.meals ?? [], goals, date);
    }

    case "get_recovery_context": {
      return {
        recovery: ctx.recovery,
        safety: ctx.safety,
        checkIn: state.dayCheckIns?.[date] ?? null,
        readiness: ctx.recovery.readiness ?? ctx.recovery.level ?? "unknown",
        score: ctx.recovery.score,
        disclaimer: "Recuperação não é diagnóstico médico.",
      };
    }

    case "get_behavior_patterns": {
      const legacy = extractUserPatterns(state);
      const loop =
        state.decisionContextByDate?.[date]?.behavior ?? runBehaviorLoop(state, { date });
      return {
        patterns: loop.patterns.map((p) => ({
          key: p.key,
          description: p.description,
          confidence: p.confidence,
          supportCount: p.supportCount,
          status: p.status,
        })),
        legacyInsights: patternInsights(legacy),
        legacy,
        behavior: ctx.behavior,
        disclaimer: "Padrões comportamentais observados — não são diagnósticos psicológicos.",
      };
    }

    case "get_active_triggers": {
      const loop =
        state.decisionContextByDate?.[date]?.behavior ?? runBehaviorLoop(state, { date });
      return {
        triggers: loop.triggers
          .filter((t) => t.active)
          .map((t) => ({
            key: t.key,
            description: t.description,
            supportCount: t.supportCount,
            confidence: t.confidence,
          })),
        disclaimer: "Triggers exigem ≥2 evidências — não diagnosticam psicologia.",
      };
    }

    case "get_recent_interventions": {
      const loop =
        state.decisionContextByDate?.[date]?.behavior ?? runBehaviorLoop(state, { date });
      let fromDb: unknown[] = [];
      try {
        const { loadRecentInterventions } = await import("@/lib/engine/behavior/persist.server");
        fromDb = await loadRecentInterventions(trustedUserId, limit);
      } catch {
        fromDb = [];
      }
      return {
        suggested: loop.interventions,
        recent: fromDb,
        lapses: loop.lapses.map((l) => ({
          reason: l.reason,
          nextAction: l.nextAction,
          interventionType: l.intervention.type,
        })),
      };
    }

    case "get_experiment_status": {
      const loop =
        state.decisionContextByDate?.[date]?.behavior ?? runBehaviorLoop(state, { date });
      let fromDb: unknown[] = [];
      try {
        const { loadBehaviorExperiments } = await import("@/lib/engine/behavior/persist.server");
        fromDb = await loadBehaviorExperiments(trustedUserId);
      } catch {
        fromDb = [];
      }
      return {
        proposed: loop.experiments,
        stored: fromDb,
      };
    }

    case "get_recent_decisions":
      return {
        today: ctx.todayDecisions,
        fromLog: await loadRecentDecisionLog(trustedUserId, limit),
        outcomes: ctx.recentOutcomes ?? [],
        decisionSource: ctx.todayDecisions[0]?.source ?? "server_snapshot",
      };

    case "get_today_plan": {
      const snap = state.decisionContextByDate?.[date] ?? null;
      const recs = snap?.recommendations ?? [];
      return {
        living: snap?.livingPlan
          ? {
              mode: snap.livingPlan.workout.mode,
              title: snap.livingPlan.workout.title,
              volumeFactor: snap.livingPlan.workout.volumeFactor,
              proteinG: snap.livingPlan.nutrition.proteinG,
              kcal: snap.livingPlan.nutrition.kcal,
              sleepTargetHours: snap.livingPlan.sleepTargetHours,
              narrative: snap.livingPlan.narrative,
              why: snap.livingPlan.why,
            }
          : null,
        decisions: ctx.todayDecisions,
        recommendations: recs.slice(0, 5).map((r) => ({
          id: r.id,
          kind: r.kind,
          title: r.title,
          reason: r.reason,
        })),
      };
    }

    case "get_exercise_guide": {
      const found = findLibraryExercise(args.exerciseId, args.query);
      if (!found) return { error: "exercise_not_found" };
      const media = resolveExerciseMedia(found.id);
      const hits = hitsForExercise(found.id, state.sessions ?? []);
      const latest = hits[0];
      const lastSet = latest
        ? {
            date: latest.date,
            weightKg: latest.maxWeightKg,
            reps: Math.round(latest.avgReps),
          }
        : null;
      return {
        exerciseId: found.id,
        name: found.name,
        group: found.group,
        equipment: found.equipment,
        instructions: found.instructions,
        media: {
          posterUrl: media.posterUrl ?? null,
          webmUrl: media.webmUrl ?? null,
          mp4Url: media.mp4Url ?? null,
          source: media.source,
        },
        lastSession: lastSet,
      };
    }

    case "get_howto": {
      const howtoId = args.howtoId?.trim();
      const product = args.productId ? productById(args.productId) : matchProduct(args.query);
      if (howtoId) {
        const media = resolveHowtoMedia(howtoId);
        return {
          kind: "howto",
          id: howtoId,
          media: {
            posterUrl: media.posterUrl ?? null,
            webmUrl: media.webmUrl ?? null,
            mp4Url: media.mp4Url ?? null,
            source: media.source,
          },
        };
      }
      if (product) {
        const media = resolveProductMedia(product.id);
        return {
          kind: "product",
          id: product.id,
          name: product.name,
          use: product.use,
          timing: product.timing,
          serving: product.serving,
          media: {
            posterUrl: media.posterUrl ?? null,
            source: media.source,
          },
        };
      }
      return { error: "howto_not_found" };
    }

    default:
      throw new Error("unknown_tool");
  }
}

function normalizeQuery(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function findLibraryExercise(exerciseId?: string, query?: string) {
  if (exerciseId) {
    const direct = libraryById(exerciseId);
    if (direct) return direct;
  }
  const q = query ? normalizeQuery(query) : "";
  if (!q) return undefined;
  return resolvedLibrary().find((e) => {
    const hay = [
      e.id,
      e.name,
      e.canonicalName,
      e.displayNamePt,
      e.displayNameEn ?? "",
      ...(e.aliases ?? []),
      ...(e.searchTerms ?? []),
    ]
      .map(normalizeQuery)
      .filter(Boolean);
    return hay.some((h) => h === q || h.includes(q) || q.includes(h));
  });
}

function matchProduct(query?: string) {
  const q = query ? normalizeQuery(query) : "";
  if (!q) return undefined;
  return PRODUCTS.find((p) => normalizeQuery(p.id) === q || normalizeQuery(p.name).includes(q));
}

async function loadRecentDecisionLog(userId: string, limit: number) {
  try {
    const { adminDbLoose } = await import("@/lib/db-admin");
    const db = await adminDbLoose();
    if (!db) return [];
    const { data } = await db
      .from("recommendation_decisions")
      .select("date, decision_type, decision_value, reason_codes, confidence")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
}

/** Prefetch tools for explainability based on turn kind / text. */
export async function prefetchToolsForTurn(
  trustedUserId: string,
  text: string,
): Promise<Record<string, unknown>> {
  const lower = text.toLowerCase();
  const tools: CoachToolName[] = ["get_today_plan", "get_recovery_context"];
  if (/prote[ií]n|kcal|refei|nutri|comida|macro/i.test(lower)) {
    tools.push("get_nutrition_context");
  }
  if (/pr\b|recorde|1\s*rm|carga|exerc[ií]cio/i.test(lower)) {
    tools.push("get_prs", "get_1rm");
  }
  if (/por\s*que|leve|volume|descans|plano|padr[aã]o|h[aá]bito|trigger/i.test(lower)) {
    tools.push(
      "get_recent_decisions",
      "get_behavior_patterns",
      "get_active_triggers",
      "get_recent_interventions",
    );
  }
  if (/experimento|teste\s*de\s*7/i.test(lower)) {
    tools.push("get_experiment_status");
  }
  if (/treino|sess[aã]o|hist[oó]rico/i.test(lower)) {
    tools.push("get_training_history");
  }

  const out: Record<string, unknown> = {};
  for (const name of [...new Set(tools)]) {
    try {
      out[name] = await runCoachTool(trustedUserId, name, {});
    } catch (e) {
      out[name] = { error: String(e) };
    }
  }
  return out;
}

export function coachToolSchemas(): Array<{ name: CoachToolName; description: string }> {
  return [
    { name: "get_profile", description: "Perfil e metas" },
    { name: "get_training_history", description: "Histórico de sessões" },
    { name: "get_exercise_history", description: "Histórico por exercício" },
    { name: "get_prs", description: "Personal records" },
    { name: "get_1rm", description: "Estimativa de 1RM" },
    { name: "get_muscle_recovery", description: "Recuperação muscular" },
    { name: "get_nutrition_context", description: "Contexto nutricional do dia" },
    { name: "get_recovery_context", description: "Sono, energia, safety" },
    { name: "get_behavior_patterns", description: "Padrões comportamentais (não clínicos)" },
    { name: "get_active_triggers", description: "Triggers ativos (≥2 evidências)" },
    { name: "get_recent_interventions", description: "Micro-intervenções recentes" },
    { name: "get_experiment_status", description: "Status de micro-experimentos" },
    { name: "get_recent_decisions", description: "Decisões do Decision Engine" },
    { name: "get_today_plan", description: "Plano vivo de hoje" },
    {
      name: "get_exercise_guide",
      description: "Como executar um exercício: instruções, mídia Soldiers e último treino",
    },
    {
      name: "get_howto",
      description: "How-to de produto (logar refeição, misturar whey) ou pack shot",
    },
  ];
}
