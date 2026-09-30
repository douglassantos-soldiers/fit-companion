import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { NumberInput, Modal } from "@mantine/core";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { MealPickerSheet } from "@/components/meal-picker-sheet";
import { SoldiersMediaThumb } from "@/components/soldiers-media-frame";
import { Spinner } from "@/components/kibo-ui/spinner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DailyQuestsCard, XpBar } from "@/components/today/engagement-cards";
import {
  LivingPlanHero,
  type LivingPlanEatAction,
  type LivingPlanPrimaryAction,
} from "@/components/today/living-plan-hero";
import { CompleteProfileSheet } from "@/components/today/complete-profile-sheet";
import { CoachNudgeOverlay } from "@/components/coach-nudge-overlay";
import { AccessWindowBanner } from "@/components/today/access-window-banner";
import { WeekPath } from "@/components/today/week-path";
import { HomeProgressCard } from "@/components/today/home-progress-card";
import { HomeFallbackHero } from "@/components/today/home-fallback-hero";
import { HomeQuickHabits } from "@/components/today/home-quick-habits";
import {
  HomeActionFeedback,
  type HomeActionFeedbackData,
} from "@/components/today/home-action-feedback";
import { HomeBlocks } from "@/components/today/home-blocks";
import { HomeFriendQuestCard, HomeMaisDoDia } from "@/components/today/home-mais-do-dia";
import {
  isActivationReady,
  isNutritionReady,
  needsProfileEnrichment,
} from "@/lib/profile-readiness";
import { PRODUCTS } from "@/data/products";
import { resolveExerciseMedia, resolveProductMedia } from "@/lib/soldiers-media";
import {
  getStorefrontBaseUrl,
  primaryReorderProductId,
  primaryReorderUrl,
  reorderUrlForProduct,
} from "@/data/shopify-product-map";
import { trackAppEvent } from "@/lib/shopify.functions";
import { isQuestComplete, questById } from "@/data/daily-quests";
import type { MealPreset } from "@/data/meal-presets";
import {
  performanceDimensions,
  performanceScore,
  adherenceScore,
  streak,
  weekOverWeek,
  prsInCurrentWeek,
} from "@/lib/engine/dimensions";
import { computeLearningInsights, topLearningInsight } from "@/lib/engine/learning";
import { buildUserContext } from "@/lib/engine/context";
import { decisionContextForUi } from "@/lib/engine/assemble-decision-context";
import {
  selectNutritionOpts,
  selectPrimaryAction,
  selectTrainingMode,
  selectWhyPanel,
  shouldRefreshDecisionContextForToday,
} from "@/lib/engine/decision-context-snapshot";
import {
  consecutiveHardRpeStreak,
  buildMuscleRecoverySnapshots,
} from "@/lib/engine/recovery";
import { muscleRecoveryTeaser } from "@/lib/training/recovery-ui";
import { trackOutcome } from "@/lib/outcome";
import { trackHomeSurface } from "@/lib/home/track-home-surface";
import {
  buildDailyMealPlan,
  dayNutritionTotalsFromState,
  nextSuggestedMeal,
  nutritionGoals,
  addMealFromPreset,
  suggestSlot,
} from "@/lib/engine/nutrition";
import {
  clampServings,
  copyMealToSlot,
  lastMealForSlot,
  nutritionProofLine,
  proteinGapLine,
} from "@/lib/nutrition/log-loop";
import { planDayForToday } from "@/lib/engine/plan";
import {
  daySummary,
  nextOnboardingTip,
  streakAtRisk,
  weekPathStates,
} from "@/lib/engine/retention";
import { dailyXp } from "@/lib/engine/xp";
import { suggestSupplementNow } from "@/lib/engine/supplements";
import {
  ensureFriendQuest,
  fetchClubLeague,
  fetchClubStories,
  type ClubStory,
  type FriendQuest,
  type LeagueRow,
} from "@/lib/social";
import { listFollowingForInviteFn } from "@/lib/social/graph.functions";
import { useClubSocialFeed } from "@/hooks/use-club-social-feed";
import { todayMetrics, todaySupplements, useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";
import { trainingProofLine } from "@/lib/training/proof";
import { computeStrengthScore } from "@/lib/training/strength-score";
import { resolveTrainingPlanDays } from "@/lib/training/resolve-plan-days";
import { blockDisplayWeek } from "@/lib/training/training-block";
import { DAILY_XP_GOAL, todayKey, type MealQuality, type MealSlot } from "@/lib/types";
import { brandLevel } from "@/lib/engine/brand-level";
import { homePersona } from "@/lib/engine/home-persona";
import { periodReview } from "@/lib/engine/period-review";
import { resolvedAvailableMin } from "@/lib/engine/session-time";
import { orderHomeBlocks } from "@/lib/engine/home-layout";
import { coachNudgeFromState } from "@/lib/engine/coach-nudge";
import { accessDaysRemaining, accessUrgencyLevel } from "@/lib/access-window";
import {
  morningNarrationFromLiving,
  proposalFollowUpQuestion,
  shouldShowProposalFollowUp,
} from "@/lib/coach/proposal-followup";
import { morningCheckinCoachSeed, nutritionReviewCoachSeed, seedCoachQuestion } from "@/lib/coach/seed";
import { weekNutritionSummary } from "@/lib/nutrition/week-summary";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hoje — Soldiers Training" },
      {
        name: "description",
        content: "Uma ação óbvia: iniciar o treino ou registrar a refeição.",
      },
      { property: "og:title", content: "Soldiers Training" },
      {
        property: "og:description",
        content: "Treino personalizado, progresso e desafios sem burocracia.",
      },
    ],
  }),
  component: Today,
});

function weekDays() {
  const today = new Date();
  const start = new Date(today);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function Today() {
  const navigate = useNavigate();
  const {
    state,
    hydrated,
    addWater,
    addMealEntry,
    addWeight,
    toggleSupplement,
    markTipSeen,
    useStreakFreeze,
    markQuestKudos,
    saveDayCheckIn,
    refreshLivingPlan,
    patchProfile,
    saveLivingPlanFeedback,
    dismissCoachNudge,
    markCoachNudgeShown,
    leaveTrainingBlock,
    answerCoachProposalFollowUp,
  } = useStore();
  const [mealSlot, setMealSlot] = useState<MealSlot | null>(null);
  const [eatServings, setEatServings] = useState<number | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightKg, setWeightKg] = useState<number | string>("");
  const [leagueMe, setLeagueMe] = useState<LeagueRow | null>(null);
  const [friendQuest, setFriendQuest] = useState<FriendQuest | null>(null);
  const [stories, setStories] = useState<ClubStory[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [maisAberto, setMaisAberto] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [morningHint, setMorningHint] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<HomeActionFeedbackData | null>(null);
  const requestedServerContextFor = useRef<string | null>(null);
  const days = useMemo(() => weekDays(), []);
  const deviceId = getDeviceId();
  const {
    club,
    feed: clubFeed,
    setFeed: setClubFeed,
    kudosGiven,
    setKudosGiven,
  } = useClubSocialFeed({
    enabled: hydrated && Boolean(deviceId),
    deviceId,
    limit: 5,
    refreshKey: `${state.sessions.length}:${state.profile?.name ?? ""}`,
  });

  useEffect(() => {
    if (hydrated && !state.profile) navigate({ to: "/onboarding" });
  }, [hydrated, state.profile, navigate]);

  useEffect(() => {
    if (!hydrated || !state.profile) return;
    const today = todayKey();
    const ctx = state.decisionContextByDate?.[today];
    if (
      !shouldRefreshDecisionContextForToday({
        snapshot: ctx,
        hasLivingPlan: Boolean(state.livingPlans?.[today]),
        alreadyRequested: requestedServerContextFor.current === today,
      })
    ) {
      return;
    }
    requestedServerContextFor.current = today;
    refreshLivingPlan();
  }, [hydrated, state.profile, state.livingPlans, state.decisionContextByDate, refreshLivingPlan]);

  useEffect(() => {
    if (!hydrated || !state.profile) return;
    const id = getDeviceId();
    if (!id) return;
    void trackAppEvent({
      data: {
        deviceId: id,
        kind: "plan_viewed",
        payload: { date: todayKey() },
        entityType: "plan",
        entityId: todayKey(),
        idempotencyKey: `plan_viewed:${todayKey()}`,
      },
    }).catch(() => undefined);
  }, [hydrated, state.profile]);

  useEffect(() => {
    if (!hydrated || !state.profile) return;
    const estimates = Object.values(state.restockEstimates ?? {});
    const soon = estimates.find((e) => {
      const days = Math.ceil((new Date(e.emptyAt).getTime() - Date.now()) / 86_400_000);
      return days <= 14;
    });
    if (!soon) return;
    const id = getDeviceId();
    if (!id) return;
    void trackAppEvent({
      data: {
        deviceId: id,
        kind: "restock_shown",
        payload: { source: "home", productId: soon.productId },
        entityType: "product",
        entityId: soon.productId,
        idempotencyKey: `restock_shown:${todayKey()}:${soon.productId}`,
      },
    }).catch(() => undefined);
  }, [hydrated, state.profile, state.restockEstimates]);

  useEffect(() => {
    if (!club || !deviceId) {
      setLeagueMe(null);
      setFriendQuest(null);
      setStories([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const ids = club.members.map((m) => m.deviceId);
        const [league, fq, st] = await Promise.all([
          fetchClubLeague(club.id, ids, deviceId),
          ensureFriendQuest(deviceId, club, state.profile?.name || "Soldado"),
          fetchClubStories(club.id, deviceId),
        ]);
        if (cancelled) return;
        setLeagueMe(league?.find((r) => r.isYou) ?? null);
        setFriendQuest(fq);
        setStories(st);
      } catch (err) {
        console.warn("club extras failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [club, deviceId, state.profile?.name, state.sessions.length]);

  useEffect(() => {
    if (!hydrated || !deviceId) return;
    let cancelled = false;
    void listFollowingForInviteFn({ data: { deviceId } })
      .then((res) => {
        if (cancelled) return;
        const n = (res.people ?? []).length;
        setFollowingCount(
          n > 0 ? n : state.hasFollowedSomeone ? 1 : 0,
        );
      })
      .catch(() => {
        if (!cancelled && state.hasFollowedSomeone) setFollowingCount(1);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, deviceId, state.hasFollowedSomeone, state.sessions.length]);

  const nudge = coachNudgeFromState(state);
  useEffect(() => {
    if (!hydrated || !nudge.show) return;
    setNudgeOpen(true);
    markCoachNudgeShown();
  }, [hydrated, nudge.show, markCoachNudgeShown]);

  const todayCheckInPreview = state.dayCheckIns?.[todayKey()];
  const muscleTeaser = useMemo(() => {
    const recoveryCtx = {
      ...(todayCheckInPreview?.sleepHours != null
        ? { sleepHours: todayCheckInPreview.sleepHours }
        : {}),
      ...(todayCheckInPreview?.energy ? { energy: todayCheckInPreview.energy } : {}),
      sessionRpeHardStreak: consecutiveHardRpeStreak(state.sessions),
    };
    return muscleRecoveryTeaser(buildMuscleRecoverySnapshots(state.sessions, recoveryCtx));
  }, [state.sessions, todayCheckInPreview?.sleepHours, todayCheckInPreview?.energy]);

  if (!hydrated || !state.profile) {
    return (
      <AppShell title="Carregando" subtitle="Preparando seu dia">
        <div className="flex flex-col items-center gap-4 py-8">
          <Spinner variant="circle-filled" className="text-primary" size={32} />
          <div className="w-full space-y-3">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  const profile = state.profile;
  const decisionCtx = decisionContextForUi(state, todayKey());
  const insights = computeLearningInsights(state);
  const userCtx = buildUserContext(state, state.userId);
  const insightLine = userCtx.headline ?? topLearningInsight(state);
  // Candidates for cover / session id — mode & duration come only from Decision
  const planCandidates = resolveTrainingPlanDays(state);
  const dayCandidates = planDayForToday(planCandidates);
  const workoutDayId = decisionCtx?.livingPlan.workout.dayId ?? dayCandidates?.id ?? null;
  const workoutCoverId = dayCandidates?.exercises[0]?.exerciseId ?? null;
  const expressToday = decisionCtx ? selectTrainingMode(decisionCtx) === "express" : false;
  const primaryFromDecision = decisionCtx ? selectPrimaryAction(decisionCtx) : null;
  const whyPanel = decisionCtx ? selectWhyPanel(decisionCtx) : null;
  const doneToday = state.sessions.some((s) => s.date.slice(0, 10) === todayKey());
  const metrics = todayMetrics(state);
  const taken = todaySupplements(state);
  const dims = performanceDimensions(state, profile);
  const score = performanceScore(dims);
  const adhere = adherenceScore(dims);
  const st = streak(state.sessions, { freezeUsedDates: state.freezeUsedDates });
  const persona = homePersona(state);
  const brand = brandLevel(state);
  const weekReview =
    persona === "consistente" ||
    persona === "avancado" ||
    persona === "em_risco" ||
    new Date().getDay() === 0
      ? periodReview(state, "week")
      : null;
  const wow = persona === "avancado" ? weekOverWeek(state.sessions) : null;
  const weekPrs =
    persona === "consistente" || persona === "avancado" || persona === "em_risco"
      ? prsInCurrentWeek(state.sessions)
      : [];
  const strengthScore =
    persona === "consistente" || persona === "avancado" || persona === "em_risco"
      ? computeStrengthScore(state.sessions, profile)
      : null;
  const showLeague = persona !== "novo" && persona !== "inativo";
  const profileNeedsEnrichment = needsProfileEnrichment(profile);
  const bodyIncomplete = !isActivationReady(profile);
  const nutritionIncomplete = !isNutritionReady(profile);
  const livingBundle = decisionCtx
    ? {
        plan: decisionCtx.livingPlan,
        decisions: decisionCtx.decisions,
        behavior: decisionCtx.behavior,
      }
    : null;
  const engine = decisionCtx ? selectNutritionOpts(decisionCtx, state) : {};
  const goals = nutritionGoals(profile, insights, engine);
  const nutrition = dayNutritionTotalsFromState(state);
  const mealPlan = buildDailyMealPlan(profile, state, todayKey(), insights, engine);
  const nextMeal = nextSuggestedMeal(mealPlan);
  const xp = dailyXp(state);
  const gap = proteinGapLine(nutrition.proteinG, goals.proteinG, nextMeal?.slot);
  const nutProof = nutritionProofLine(state.meals ?? [], goals.proteinG);
  const weekNut = weekNutritionSummary(state, {
    kcalTrend: decisionCtx?.context.nutrition.kcalTrend ?? 0,
    reasonSeeds: decisionCtx?.context.reasonSeeds ?? [],
  });
  const showNutritionReview =
    Boolean(weekNut) &&
    (weekNut!.proteinHitDays < 3 || nutrition.proteinG < goals.proteinG * 0.85);
  const lastSameSlot = nextMeal ? lastMealForSlot(state.meals ?? [], nextMeal.slot) : null;
  const servingsNow = clampServings(eatServings ?? nextMeal?.suggestedServings ?? 1);

  const goalProducts = PRODUCTS.filter((p) => p.goals.includes(profile.goal));
  const routine = state.supplementRoutine.length
    ? PRODUCTS.filter((p) => state.supplementRoutine.includes(p.id))
    : goalProducts.slice(0, 3);

  const nowSuggestion = suggestSupplementNow(
    state.supplementRoutine,
    goalProducts.slice(0, 3),
    taken,
  );
  const pathStates = weekPathStates(state, days);

  const openWeight = () => {
    setWeightKg(profile.weightKg);
    setWeightOpen(true);
  };

  const saveWeight = () => {
    const kg = typeof weightKg === "number" ? weightKg : Number(String(weightKg).replace(",", "."));
    if (kg > 0) {
      addWeight(kg);
      toast.success("Peso atualizado");
      setWeightOpen(false);
    }
  };

  const atRisk =
    streakAtRisk(state.sessions, new Date(), state.freezeUsedDates ?? []) && !doneToday;
  const summary = daySummary(state);
  const tip = nextOnboardingTip(profile, state);
  const questsDone = (state.dailyQuestIds ?? []).filter((id) => {
    const q = questById(id);
    return q ? isQuestComplete(state, q) : false;
  }).length;

  const living = livingBundle?.plan ?? state.livingPlans?.[todayKey()] ?? null;
  const todayCheckIn = state.dayCheckIns?.[todayKey()];
  const behaviorLoop = livingBundle?.behavior ?? {
    profile: {
      consistency: 0.5,
      mealAdherence: 0.5,
      trainingAdherence: 0.5,
      sleepBehavior: 0.5,
      weekendPattern: 0.5,
      timeConstraintBehavior: 0.5,
      interventionResponse: {},
      confidence: 0.4,
    },
    patterns: [],
    triggers: [],
    interventions: [],
    experiments: [],
    lapses: [],
  };
  const topRec = decisionCtx?.recommendations[0] ?? null;

  const homeBlocks = orderHomeBlocks(state, behaviorLoop.profile, {
    hasClub: Boolean(club),
    followingCount,
    level: profile.level,
    isSunday: new Date().getDay() === 0,
    isMonday: new Date().getDay() === 1,
  });
  const daysLeft = accessDaysRemaining(state.accessExpiresAt);
  const urgency = accessUrgencyLevel(daysLeft);
  const windowReorderUrl = primaryReorderUrl(state.purchaseProductIds) ?? getStorefrontBaseUrl();
  const windowProductName = (() => {
    const id = primaryReorderProductId(state.purchaseProductIds);
    return id ? (PRODUCTS.find((p) => p.id === id)?.name ?? null) : null;
  })();
  const restockSoon = (() => {
    const estimates = Object.values(state.restockEstimates ?? {});
    if (!estimates.length) return null;
    const soon = estimates
      .map((e) => {
        const days = Math.ceil((new Date(e.emptyAt).getTime() - Date.now()) / 86_400_000);
        return { ...e, days };
      })
      .filter((e) => e.days <= 14)
      .sort((a, b) => a.days - b.days)[0];
    if (!soon) return null;
    const product = PRODUCTS.find((p) => p.id === soon.productId);
    const url = reorderUrlForProduct(soon.productId);
    if (!product || !url) return null;
    return { soon, product, url };
  })();

  const showWeightQuick = !state.weights.some((w) => w.date.slice(0, 10) === todayKey());
  const hasWaterQuest = (state.dailyQuestIds ?? []).some((id) => questById(id)?.kind === "water");
  const showUrgentAccess = Boolean(urgency && daysLeft != null && daysLeft <= 3 && windowReorderUrl);
  const showRetomar =
    (persona === "inativo" || persona === "em_risco") && Boolean(workoutDayId) && !doneToday;

  const showActionFeedback = (title: string, proteinDelta = 0) => {
    const proteinNow = nutrition.proteinG + proteinDelta;
    const proteinLine =
      proteinGapLine(proteinNow, goals.proteinG, nextMeal?.slot) ??
      `${Math.round(proteinNow)}/${goals.proteinG} g proteína`;
    const incomplete = (state.dailyQuestIds ?? [])
      .map((id) => questById(id))
      .filter((q): q is NonNullable<ReturnType<typeof questById>> => {
        if (!q) return false;
        return !isQuestComplete(state, q);
      });
    const nextQ = incomplete[0];
    setActionFeedback({
      title,
      proteinLine,
      streakDays: st,
      questsDone,
      questsTarget: 3,
      nextHint: nextQ
        ? `Próxima missão: ${nextQ.title}`
        : doneToday
          ? null
          : "Treine para fechar o dia",
      nextCtaLabel: nextQ
        ? nextQ.kind === "water"
          ? "+500 ml"
          : nextQ.kind === "train"
            ? "Treinar"
            : nextQ.kind === "coach"
              ? "Abrir Coach"
              : "Continuar"
        : doneToday
          ? null
          : "Treinar",
      onNext: () => {
        if (nextQ?.kind === "water") {
          addWater(500);
          toast.success("Hidratação registrada");
          return;
        }
        if (nextQ?.kind === "train" || !nextQ) {
          if (workoutDayId) {
            void navigate({
              to: "/treino/sessao/$id",
              params: { id: workoutDayId },
              search: { express: expressToday, from: "hoje" },
            });
          } else void navigate({ to: "/treino" });
          return;
        }
        if (nextQ.kind === "coach") void navigate({ to: "/coach" });
        else if (nextQ.kind === "protein80" || nextQ.kind === "meals2") setMealSlot(suggestSlot());
        else if (nextQ.kind === "supplements")
          void navigate({ to: "/nutricao", search: { tab: "doses" } });
        else if (nextQ.kind === "kudos" || nextQ.kind === "share" || nextQ.kind === "follow")
          void navigate({ to: "/social", search: { tab: "feed" } });
      },
    });
  };

  const onPickMealNow = (preset: MealPreset, servings = 1) => {
    const slot = mealSlot ?? suggestSlot();
    addMealEntry(addMealFromPreset(preset, slot, servings));
    setMealSlot(null);
    toast.success(`${preset.label} registrado`);
    showActionFeedback(`${preset.label} registrado`, preset.proteinG * servings);
  };

  const onPickMealCustomNow = (meal: {
    label: string;
    proteinG: number;
    kcal: number;
    carbG?: number;
    fatG?: number;
    fiberG?: number;
    quality: MealQuality;
    sourceKind?: "informed" | "estimated";
    confidence?: number;
    aiMode?: "photo" | "voice" | "text";
    correctedFromAi?: boolean;
    items?: import("@/lib/types").MealItemEntry[];
    foodSource?: import("@/lib/types").FoodLineageSource;
  }) => {
    const slot = mealSlot ?? suggestSlot();
    const entry: Parameters<typeof addMealEntry>[0] = {
      slot,
      label: meal.label,
      proteinG: meal.proteinG,
      kcal: meal.kcal,
      quality: meal.quality,
      sourceKind: meal.sourceKind ?? "estimated",
    };
    if (meal.carbG != null) entry.carbG = meal.carbG;
    if (meal.fatG != null) entry.fatG = meal.fatG;
    if (meal.fiberG != null) entry.fiberG = meal.fiberG;
    if (meal.confidence != null) entry.confidence = meal.confidence;
    if (meal.aiMode) entry.aiMode = meal.aiMode;
    if (meal.correctedFromAi != null) entry.correctedFromAi = meal.correctedFromAi;
    if (meal.items) entry.items = meal.items;
    if (meal.foodSource) entry.foodSource = meal.foodSource;
    addMealEntry(entry);
    setMealSlot(null);
    toast.success(`${meal.label} registrado`);
    showActionFeedback(`${meal.label} registrado`, meal.proteinG);
  };

  const applySuggestedMealNow = (servings = servingsNow) => {
    if (!nextMeal?.preset) return;
    addMealEntry(addMealFromPreset(nextMeal.preset, nextMeal.slot, servings));
    setEatServings(null);
    toast.success(`${nextMeal.preset.label} registrado`);
    showActionFeedback(
      `${nextMeal.preset.label} registrado`,
      nextMeal.preset.proteinG * servings,
    );
  };

  const onAddWaterQuick = () => {
    addWater(500);
    toast.success("Hidratação registrada");
    showActionFeedback("+500 ml de água");
  };

  return (
    <AppShell
      title={`Bom treino, ${profile.name.split(" ")[0]}`}
      subtitle={`Score ${score}/100 · streak ${st}d · ${xp}/${DAILY_XP_GOAL} XP`}
      headerBadge={`${st}d`}
      headerAccessDays={urgency ? daysLeft : null}
      hideTitle
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Olá, <span className="font-semibold text-foreground">{profile.name.split(" ")[0]}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {brand.label} · Nv. {brand.level}
            {showLeague && leagueMe ? ` · Liga #${leagueMe.rank}` : ""}
            {daysLeft != null && daysLeft <= 7 ? ` · acesso ${daysLeft}d` : ""}
          </p>
        </div>
        <Link
          to="/progresso"
          className="flex items-center gap-1 text-xs font-semibold text-primary"
        >
          <TrendingUp className="size-3.5" /> Progresso
        </Link>
      </div>

      <WeekPath days={days} states={pathStates} />

      {living ? (
        <LivingPlanHero
          plan={living}
          doneToday={doneToday}
          cover={workoutCoverId ? resolveExerciseMedia(workoutCoverId) : null}
          checkIn={todayCheckIn}
          muscleTeaser={muscleTeaser}
          defaultAvailableMin={
            decisionCtx?.context.availableTimeMin ?? resolvedAvailableMin(todayCheckIn, profile)
          }
          feedback={state.livingPlanFeedback?.[todayKey()] ?? null}
          onCheckInOpened={() => trackHomeSurface("checkin_opened")}
          onCoachClick={() => trackHomeSurface("coach_teaser_click", { source: "hero" })}
          onFeedback={(vote, reason) => {
            saveLivingPlanFeedback(todayKey(), vote, reason);
            void trackOutcome(
              getDeviceId(),
              vote === "up" ? "living_plan_followed" : "living_plan_skipped",
              { reason: reason ?? null },
            );
            toast.success(vote === "up" ? "Obrigado — o plano segue" : "Anotado — vamos ajustar");
          }}
          onSaveCheckIn={(c) => {
            saveDayCheckIn(c);
            // Refresh plan then narrate from next tick's living snapshot via current living + check-in.
            refreshLivingPlan();
            const mode =
              state.livingPlans?.[todayKey()]?.workout.mode ?? c.acceptedTrainingMode ?? null;
            const title = state.livingPlans?.[todayKey()]?.workout.title ?? null;
            const estimatedMin = state.livingPlans?.[todayKey()]?.workout.estimatedMin ?? null;
            const line = morningNarrationFromLiving({
              mode,
              title,
              estimatedMin,
              energy: c.energy,
              sleepHours: c.sleepHours,
            });
            setMorningHint(line);
            toast.success("Plano de hoje atualizado");
          }}
          primaryAction={(() => {
            if (!topRec) return null;
            const action: LivingPlanPrimaryAction = {
              id: topRec.id,
              title: topRec.title,
              reason: whyPanel?.explanations[0] ?? topRec.reason,
            };
            if (topRec.href) action.href = topRec.href;
            if (primaryFromDecision === "rest" || primaryFromDecision === "sleep") {
              action.reason = whyPanel?.reason_aliases.slice(0, 3).join(" · ") || action.reason;
            }
            return action;
          })()}
          onPrimaryAction={() => {
            if (!topRec) return;
            void trackOutcome(getDeviceId(), "living_plan_followed", {
              recommendationId: topRec.id,
              kind: topRec.kind,
            });
          }}
          eatAction={(() => {
            const eat: LivingPlanEatAction = {
              title: nextMeal?.preset?.label ?? "Registrar refeição",
              hint:
                gap ??
                (nextMeal?.preset
                  ? `${nextMeal.preset.proteinG} g proteína`
                  : "Slots do dia preenchidos"),
              servings: servingsNow,
              onServings: (n) => setEatServings(clampServings(n)),
              onApply: () => {
                if (nextMeal?.preset) applySuggestedMealNow(servingsNow);
                else setMealSlot(suggestSlot());
              },
              onRegister: () => setMealSlot(nextMeal?.slot ?? suggestSlot()),
            };
            if (lastSameSlot) {
              eat.onRepeatLast = () => {
                addMealEntry(copyMealToSlot(lastSameSlot, nextMeal?.slot ?? lastSameSlot.slot));
                toast.success("Igual ontem");
                showActionFeedback("Igual ontem", lastSameSlot.proteinG);
              };
              eat.repeatLabel = "Igual ontem";
            }
            return eat;
          })()}
        />
      ) : (
        <HomeFallbackHero
          workoutDayId={workoutDayId}
          express={expressToday || true}
          estimatedMin={dayCandidates?.estimatedMin ?? null}
          onRegisterMeal={() => setMealSlot(nextMeal?.slot ?? suggestSlot())}
        />
      )}

      <HomeQuickHabits
        showWeight={showWeightQuick || hasWaterQuest}
        waterMl={metrics.waterMl}
        waterGoalMl={goals.waterMl}
        onAddWater={onAddWaterQuick}
        onOpenWeight={openWeight}
      />

      {actionFeedback ? (
        <HomeActionFeedback data={actionFeedback} onDismiss={() => setActionFeedback(null)} />
      ) : null}

      {showUrgentAccess && daysLeft != null && windowReorderUrl ? (
        <AccessWindowBanner
          daysRemaining={daysLeft}
          urgency={urgency!}
          reorderUrl={windowReorderUrl}
          productName={windowProductName}
        />
      ) : null}

      {showRetomar ? (
        <div className="surface-glass mb-4 border-primary/30 p-4">
          <p className="eyebrow">Retomar</p>
          <p className="mt-1 text-sm font-semibold">
            {persona === "em_risco"
              ? "Ainda dá tempo esta semana — Express protege o hábito."
              : "Volte com pouca fricção — Express protege o hábito."}
          </p>
          <Link
            to="/treino/sessao/$id"
            params={{ id: workoutDayId! }}
            search={{ express: true, from: "hoje" }}
          >
            <Button className="mt-3 h-11 w-full font-bold uppercase">Retomar treino</Button>
          </Link>
        </div>
      ) : null}

      {state.activeTrainingBlock ? (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-primary">Bloco</p>
            <p className="truncate text-sm font-semibold">
              {state.activeTrainingBlock.name} · Semana{" "}
              {blockDisplayWeek(state.activeTrainingBlock)}/
              {state.activeTrainingBlock.durationWeeks}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Link to="/conteudo">
              <Button type="button" size="sm" variant="ghost">
                Trilhas
              </Button>
            </Link>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                leaveTrainingBlock();
                toast.success("Saiu do bloco");
              }}
            >
              Sair
            </Button>
          </div>
        </div>
      ) : null}

      <HomeProgressCard
        score={score}
        exerciseMin={living?.workout.estimatedMin ?? dayCandidates?.estimatedMin ?? 0}
        questsDone={questsDone}
        questsTarget={3}
        streakDays={st}
      />

      {persona !== "novo" &&
        (() => {
          const proof = trainingProofLine(state);
          if (!proof) return null;
          return proof.exerciseId ? (
            <Link
              to="/treino/exercicio/$id"
              params={{ id: proof.exerciseId }}
              className="mb-3 block rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
            >
              {proof.text}
            </Link>
          ) : (
            <p className="mb-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
              {proof.text}
            </p>
          );
        })()}

      {profileNeedsEnrichment && (bodyIncomplete || nutritionIncomplete) ? (
        <button
          type="button"
          className="mb-3 w-full rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-left"
          onClick={() => setProfileOpen(true)}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Completar perfil
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {bodyIncomplete
              ? "Idade, altura e peso calibram proteína e água — 30 segundos."
              : "Hábitos alimentares calibram as refeições do plano."}
          </p>
        </button>
      ) : null}

      {showNutritionReview && weekNut ? (
        <div className="mb-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Revisão de nutrição
          </p>
          <p className="mt-1 text-sm font-semibold">
            Proteína ok {weekNut.proteinHitDays}/{weekNut.daysWindow} dias · hoje{" "}
            {Math.round(nutrition.proteinG)}/{goals.proteinG} g
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link to="/nutricao" className="text-xs font-semibold text-primary">
              Abrir Nutri →
            </Link>
            <Link
              to="/coach"
              className="text-xs font-semibold text-muted-foreground"
              onClick={() =>
                seedCoachQuestion(
                  nutritionReviewCoachSeed({
                    proteinG: nutrition.proteinG,
                    proteinTarget: goals.proteinG,
                    adherence7d: weekNut.proteinHitDays / weekNut.daysWindow,
                  }),
                )
              }
            >
              Revisar com Coach
            </Link>
          </div>
        </div>
      ) : null}

      {shouldShowProposalFollowUp(state.coachProposalFollowUp) && state.coachProposalFollowUp ? (
        <Link
          to="/coach"
          className="mb-3 block rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5"
          onClick={() => {
            seedCoachQuestion(proposalFollowUpQuestion(state.coachProposalFollowUp!));
            answerCoachProposalFollowUp();
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Feedback do Coach
          </p>
          <p className="mt-0.5 text-sm font-semibold">
            Como foi “{state.coachProposalFollowUp.label}”? Conta pro Coach
          </p>
        </Link>
      ) : null}

      {morningHint ? (
        <div className="mb-3 rounded-xl border border-white/10 bg-card/40 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Após o check-in
          </p>
          <p className="mt-1 text-sm text-foreground">{morningHint}</p>
          <div className="mt-2 flex gap-2">
            <Link
              to="/coach"
              className="text-xs font-semibold text-primary"
              onClick={() => {
                seedCoachQuestion(morningCheckinCoachSeed(morningHint));
                setMorningHint(null);
              }}
            >
              Detalhar no Coach →
            </Link>
            <button
              type="button"
              className="text-xs text-muted-foreground"
              onClick={() => setMorningHint(null)}
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}

      {state.sessions.length > 0 || persona !== "novo" ? (
        <Link
          to="/coach"
          className="surface-glass mb-4 flex items-start gap-3 p-4 transition-colors hover:border-primary/40"
          onClick={() => trackHomeSurface("coach_teaser_click", { source: "card" })}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Coach IA</p>
            <p className="mt-1 text-sm font-semibold leading-snug">
              {living?.narrative
                ? living.narrative.slice(0, 110) + (living.narrative.length > 110 ? "…" : "")
                : "Pergunte qualquer coisa — treino, comida ou recuperação."}
            </p>
          </div>
        </Link>
      ) : null}

      {persona !== "inativo" ? (
        <div className="mb-4 space-y-3">
          <XpBar xp={xp} />
          <DailyQuestsCard state={state} onWaterQuest={onAddWaterQuick} />
        </div>
      ) : null}

      {showLeague && friendQuest ? <HomeFriendQuestCard quest={friendQuest} /> : null}

      {urgency && !showUrgentAccess && daysLeft != null && windowReorderUrl ? (
        <AccessWindowBanner
          daysRemaining={daysLeft}
          urgency={urgency}
          reorderUrl={windowReorderUrl}
          productName={windowProductName}
        />
      ) : null}

      {restockSoon ? (
        <div className="surface-glass mb-4 border-primary/25 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Estoque estimado
          </p>
          <div className="mt-2 flex items-center gap-3">
            <SoldiersMediaThumb
              media={resolveProductMedia(restockSoon.product.id)}
              alt={restockSoon.product.name}
              className="size-12 rounded-xl"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Pedir de novo {restockSoon.product.name}</p>
              <p className="text-xs text-muted-foreground">
                ~{Math.max(0, restockSoon.soon.days)} dia{restockSoon.soon.days === 1 ? "" : "s"}{" "}
                restantes (estimativa)
              </p>
            </div>
          </div>
          <a
            href={restockSoon.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block"
            onClick={() => {
              const id = getDeviceId();
              if (!id) return;
              void trackAppEvent({
                data: {
                  deviceId: id,
                  kind: "restock_clicked",
                  payload: { source: "home", productId: restockSoon.soon.productId },
                  entityType: "product",
                  entityId: restockSoon.soon.productId,
                },
              });
            }}
          >
            <Button className="h-11 w-full font-bold uppercase tracking-wide">Pedir de novo</Button>
          </a>
        </div>
      ) : null}

      <HomeBlocks
        homeBlocks={homeBlocks}
        persona={persona}
        wow={wow}
        livingRecovery={living?.traffic.recovery ?? null}
        weekPrs={weekPrs}
        strengthScore={strengthScore}
        weekReview={weekReview}
        atRisk={atRisk}
        streakDays={st}
        workoutDayId={workoutDayId}
        expressToday={expressToday}
        freezes={state.streakFreezes ?? 0}
        onFreeze={() => {
          if (useStreakFreeze()) toast.success("Freeze usado — streak salvo");
          else toast.error("Não foi possível usar o freeze");
        }}
        nutProof={nutProof}
        living={living}
        gap={gap}
        onRegisterMeal={() => setMealSlot(nextMeal?.slot ?? suggestSlot())}
        nowSuggestion={nowSuggestion}
        taken={taken}
        onToggleSupplement={toggleSupplement}
        insightLine={insightLine}
        whyExtra={userCtx.why}
        adhere={adhere}
        tip={tip}
        onMarkTipSeen={markTipSeen}
        club={club}
        followingCount={followingCount}
        leagueRank={leagueMe?.rank ?? null}
        clubFeed={clubFeed}
        deviceId={deviceId}
        kudosGiven={kudosGiven}
        onKudos={(id) => {
          setClubFeed((prev) =>
            prev.map((x) => (x.id === id ? { ...x, kudosCount: x.kudosCount + 1 } : x)),
          );
          setKudosGiven((g) => ({ ...g, [id]: true }));
        }}
        onKudosQuest={markQuestKudos}
      />

      <div className="mt-4">
        <button
          type="button"
          className="flex w-full items-center justify-between px-1 py-2 text-left"
          onClick={() => {
            setMaisAberto((v) => {
              const next = !v;
              if (next) trackHomeSurface("mais_aberto");
              return next;
            });
          }}
          aria-expanded={maisAberto}
        >
          <span className="text-sm font-semibold">Mais do dia</span>
          {maisAberto ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>

        {maisAberto ? (
          <HomeMaisDoDia
            persona={persona}
            showLeague={showLeague}
            stories={stories}
            club={club}
            clubFeed={clubFeed}
            deviceId={deviceId}
            kudosGiven={kudosGiven}
            onKudos={(id) => {
              setClubFeed((prev) =>
                prev.map((x) => (x.id === id ? { ...x, kudosCount: x.kudosCount + 1 } : x)),
              );
              setKudosGiven((g) => ({ ...g, [id]: true }));
            }}
            onKudosQuest={markQuestKudos}
            tip={tip}
            onMarkTipSeen={markTipSeen}
            summary={summary}
            questsDone={questsDone}
            score={score}
            metricsWaterMl={metrics.waterMl}
            waterGoalMl={goals.waterMl}
            proteinG={nutrition.proteinG}
            proteinGoalG={goals.proteinG}
            takenCount={taken.length}
            routineMax={routine.length}
            doneToday={doneToday}
            routine={routine}
            takenIds={taken}
            nowSuggestionId={nowSuggestion?.id ?? null}
            onToggleSupplement={toggleSupplement}
          />
        ) : null}
      </div>

      {mealSlot ? (
        <MealPickerSheet
          slot={mealSlot}
          onClose={() => setMealSlot(null)}
          onPick={onPickMealNow}
          onPickCustom={onPickMealCustomNow}
        />
      ) : null}

      <Modal
        opened={weightOpen}
        onClose={() => setWeightOpen(false)}
        title="Peso de hoje"
        centered
        radius="md"
        overlayProps={{ backgroundOpacity: 0.6 }}
      >
        <NumberInput
          label="Kg"
          value={weightKg}
          onChange={setWeightKg}
          min={30}
          max={250}
          step={0.1}
          decimalScale={1}
          allowNegative={false}
          className="mb-4"
        />
        <Button className="h-11 w-full font-bold uppercase tracking-wide" onClick={saveWeight}>
          <Plus className="size-4" /> Salvar peso
        </Button>
      </Modal>

      <CompleteProfileSheet
        open={profileOpen}
        profile={profile}
        onClose={() => setProfileOpen(false)}
        onSave={(patch) => {
          patchProfile(patch);
          toast.success("Perfil atualizado");
        }}
      />
      <CoachNudgeOverlay
        open={nudgeOpen}
        volumeDeltaPct={nudge.volumeDeltaPct}
        onClose={() => {
          setNudgeOpen(false);
          dismissCoachNudge();
        }}
      />
    </AppShell>
  );
}
