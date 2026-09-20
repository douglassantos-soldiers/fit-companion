import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { NumberInput, Modal } from "@mantine/core";
import { Chip } from "@heroui/react";
import {
  ChevronDown,
  ChevronUp,
  Droplets,
  Flame,
  Pill,
  Plus,
  Scale,
  TrendingUp,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { MealPickerSheet } from "@/components/meal-picker-sheet";
import { SoldiersMediaThumb } from "@/components/soldiers-media-frame";
import { MetricRing } from "@/components/metric-ring";
import { Spinner } from "@/components/kibo-ui/spinner";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityFeed } from "@/components/social/activity-feed";
import { DailyQuestsCard, XpBar } from "@/components/today/engagement-cards";
import { LivingPlanHero, type LivingPlanEatAction, type LivingPlanPrimaryAction } from "@/components/today/living-plan-hero";
import { AccessWindowBanner } from "@/components/today/access-window-banner";
import { WeekPath } from "@/components/today/week-path";
import { PRODUCTS } from "@/data/products";
import { resolveProductMedia } from "@/lib/soldiers-media";
import {
  getStorefrontBaseUrl,
  primaryReorderProductId,
  primaryReorderUrl,
  reorderUrlForProduct,
} from "@/data/shopify-product-map";
import { trackAppEvent } from "@/lib/shopify.functions";
import { isQuestComplete, questById } from "@/data/daily-quests";
import type { MealPreset } from "@/data/meal-presets";
import { performanceDimensions, performanceScore, adherenceScore, streak } from "@/lib/engine/dimensions";
import { computeLearningInsights, topLearningInsight, learningWeekHint } from "@/lib/engine/learning";
import { buildUserContext } from "@/lib/engine/context";
import { buildLivingPlanWithDecisions } from "@/lib/engine/living-plan";
import { evaluateSafety } from "@/lib/engine/safety";
import { rankRecommendations } from "@/lib/engine/recommendation";
import { runBehaviorLoop } from "@/lib/engine/behavior";
import { trackOutcome } from "@/lib/outcome";
import {
  buildDailyMealPlan,
  dayNutritionTotalsFromState,
  nextSuggestedMeal,
  nutritionGoals,
  addMealFromPreset,
  suggestSlot,
} from "@/lib/engine/nutrition";
import { clampServings, copyMealToSlot, lastMealForSlot, nutritionProofLine, proteinGapLine } from "@/lib/nutrition/log-loop";
import { mealPlanOptsFromState } from "@/lib/nutrition/plan-opts";
import { buildExpressSession, buildWeeklyPlan, planDayForToday } from "@/lib/engine/plan";
import { daySummary, nextOnboardingTip, streakAtRisk, weekPathStates } from "@/lib/engine/retention";
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
import { useClubSocialFeed } from "@/hooks/use-club-social-feed";
import { todayMetrics, todaySupplements, useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";
import { trainingProofLine } from "@/lib/training/proof";
import { DAILY_XP_GOAL, todayKey, type MealQuality, type MealSlot } from "@/lib/types";
import { PeriodReviewCard } from "@/components/progress/period-review-card";
import { brandLevel } from "@/lib/engine/brand-level";
import { homePersona } from "@/lib/engine/home-persona";
import { periodReview } from "@/lib/engine/period-review";
import { resolvedAvailableMin } from "@/lib/engine/session-time";
import { weekOverWeek } from "@/lib/engine/dimensions";
import { prsInCurrentWeek } from "@/lib/engine/dimensions";
import { orderHomeBlocks, type HomeBlockId } from "@/lib/engine/home-layout";
import { coachNudgeFromState } from "@/lib/engine/coach-nudge";
import { accessDaysRemaining, accessUrgencyLevel } from "@/lib/access-window";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hoje — Soldiers Training" },
      {
        name: "description",
        content: "Uma ação óbvia: iniciar o treino ou registrar a refeição.",
      },
      { property: "og:title", content: "Soldiers Training" },
      { property: "og:description", content: "Treino personalizado, progresso e desafios sem burocracia." },
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
  } = useStore();
  const [mealSlot, setMealSlot] = useState<MealSlot | null>(null);
  const [eatServings, setEatServings] = useState<number | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightKg, setWeightKg] = useState<number | string>("");
  const [leagueMe, setLeagueMe] = useState<LeagueRow | null>(null);
  const [friendQuest, setFriendQuest] = useState<FriendQuest | null>(null);
  const [stories, setStories] = useState<ClubStory[]>([]);
  const [maisAberto, setMaisAberto] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
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
    if (!state.livingPlans?.[todayKey()]) refreshLivingPlan();
  }, [hydrated, state.profile, state.livingPlans, refreshLivingPlan]);

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
          fetchClubStories(club.id),
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
  const insights = computeLearningInsights(state);
  const userCtx = buildUserContext(state, state.userId);
  const insightLine = userCtx.headline ?? topLearningInsight(state);
  const plan = buildWeeklyPlan(profile, state.sessions, learningWeekHint(state), {
    likedExerciseIds: state.likedExerciseIds ?? [],
    dislikedExerciseIds: state.dislikedExerciseIds ?? [],
  });
  const day = planDayForToday(plan);
  const expressDay = day ? buildExpressSession(day) : null;
  const doneToday = state.sessions.some((s) => s.date.slice(0, 10) === todayKey());
  const metrics = todayMetrics(state);
  const taken = todaySupplements(state);
  const dims = performanceDimensions(state, profile);
  const score = performanceScore(dims);
  const adhere = adherenceScore(dims);
  const st = streak(state.sessions, { freezeUsedDates: state.freezeUsedDates });
  const persona = homePersona(state);
  const brand = brandLevel(state);
  const weekReview = persona === "consistente" || persona === "avancado" ? periodReview(state, "week") : null;
  const wow = persona === "avancado" ? weekOverWeek(state.sessions) : null;
  const weekPrs = persona === "consistente" || persona === "avancado" ? prsInCurrentWeek(state.sessions) : [];
  const showLeague = persona !== "novo" && persona !== "inativo";
  const needsRecovery = !profile.typicalSleepHours || !profile.primaryBlocker;
  const bodyIncomplete = !(profile.age >= 16 && profile.heightCm >= 130 && profile.weightKg >= 35);
  const profileIncomplete = bodyIncomplete || needsRecovery || profile.onboardingComplete === false;
  const livingBundle = buildLivingPlanWithDecisions(state, todayKey());
  const engine = mealPlanOptsFromState(state, todayKey(), livingBundle?.decisions);
  const goals = nutritionGoals(profile, insights, engine);
  const nutrition = dayNutritionTotalsFromState(state);
  const mealPlan = buildDailyMealPlan(profile, state, todayKey(), insights, engine);
  const nextMeal = nextSuggestedMeal(mealPlan);
  const xp = dailyXp(state);
  const gap = proteinGapLine(nutrition.proteinG, goals.proteinG, nextMeal?.slot);
  const nutProof = nutritionProofLine(state.meals ?? [], goals.proteinG);
  const lastSameSlot = nextMeal ? lastMealForSlot(state.meals ?? [], nextMeal.slot) : null;
  const servingsNow = clampServings(eatServings ?? nextMeal?.suggestedServings ?? 1);

  const goalProducts = PRODUCTS.filter((p) => p.goals.includes(profile.goal));
  const routine = state.supplementRoutine.length
    ? PRODUCTS.filter((p) => state.supplementRoutine.includes(p.id))
    : goalProducts.slice(0, 3);

  const nowSuggestion = suggestSupplementNow(state.supplementRoutine, goalProducts.slice(0, 3), taken);
  const pathStates = weekPathStates(state, days);

  const onPickMeal = (preset: MealPreset, servings = 1) => {
    const slot = mealSlot ?? suggestSlot();
    addMealEntry(addMealFromPreset(preset, slot, servings));
    setMealSlot(null);
    toast.success(`${preset.label} registrado`);
  };

  const onPickMealCustom = (meal: {
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
  };

  const applySuggestedMeal = (servings = servingsNow) => {
    if (!nextMeal?.preset) return;
    addMealEntry(addMealFromPreset(nextMeal.preset, nextMeal.slot, servings));
    setEatServings(null);
    toast.success(`${nextMeal.preset.label} registrado`);
  };

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

  const atRisk = streakAtRisk(state.sessions, new Date(), state.freezeUsedDates ?? []) && !doneToday;
  const summary = daySummary(state);
  const tip = nextOnboardingTip(profile, state);
  const questsDone = (state.dailyQuestIds ?? []).filter((id) => {
    const q = questById(id);
    return q ? isQuestComplete(state, q) : false;
  }).length;

  const living = livingBundle?.plan ?? state.livingPlans?.[todayKey()] ?? null;
  const todayCheckIn = state.dayCheckIns?.[todayKey()];
  const safety = evaluateSafety(state);
  const behaviorLoop = livingBundle?.behavior ?? runBehaviorLoop(state);
  const topRec = living
    ? rankRecommendations({
        livingPlan: living,
        safety,
        context: userCtx,
        decisions: livingBundle?.decisions ?? null,
        goal: profile.goal,
        purchaseProductIds: state.purchaseProductIds ?? [],
        behavior: behaviorLoop,
        weekday: new Date().getDay(),
      })[0]
    : null;

  const homeBlocks = orderHomeBlocks(state, behaviorLoop.profile, {
    hasClub: Boolean(club),
    followingCount: 0,
    level: profile.level,
  });
  const nudge = coachNudgeFromState(state);
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

  useEffect(() => {
    if (!hydrated || !nudge.show) return;
    setNudgeOpen(true);
    markCoachNudgeShown();
  }, [hydrated, nudge.show, markCoachNudgeShown]);

  return (
    <AppShell
      title={`Bom treino, ${profile.name.split(" ")[0]}`}
      subtitle={`Score ${score}/100 · streak ${st}d · ${xp}/${DAILY_XP_GOAL} XP`}
      headerBadge={`${st}d`}
      headerAccessDays={urgency ? daysLeft : null}
      hideTitle
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Olá, <span className="font-semibold text-foreground">{profile.name.split(" ")[0]}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {brand.label} · Nv. {brand.level} · streak {st}d
            {showLeague && leagueMe ? ` · Liga #${leagueMe.rank}` : ""}
            {daysLeft != null && daysLeft <= 7 ? ` · acesso ${daysLeft}d` : ""}
          </p>
        </div>
        <Link to="/progresso" className="flex items-center gap-1 text-xs font-semibold text-primary">
          <TrendingUp className="size-3.5" /> Progresso
        </Link>
      </div>

      {urgency && daysLeft != null && windowReorderUrl ? (
        <AccessWindowBanner
          daysRemaining={daysLeft}
          urgency={urgency}
          reorderUrl={windowReorderUrl}
          productName={windowProductName}
        />
      ) : null}

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

      {profileIncomplete ? (
        <button
          type="button"
          className="mb-3 w-full rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-left"
          onClick={() => setProfileOpen(true)}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Completar perfil</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {bodyIncomplete
              ? "Idade, altura e peso calibram proteína e cargas — 30 segundos."
              : "Sono e o que mais te impede — o plano fica mais preciso."}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-1.5 rounded-full bg-primary"
              style={{ width: bodyIncomplete ? "40%" : "75%" }}
            />
          </div>
        </button>
      ) : null}

      {persona === "inativo" && day && !doneToday ? (
        <div className="surface-glass mb-4 border-primary/30 p-4">
          <p className="eyebrow">Retomar</p>
          <p className="mt-1 text-sm font-semibold">Volte com pouca fricção — Express protege o hábito.</p>
          <Link to="/treino/sessao/$id" params={{ id: day.id }} search={{ express: true, from: "hoje" }}>
            <Button className="mt-3 h-11 w-full font-bold uppercase">Retomar treino</Button>
          </Link>
        </div>
      ) : null}

      {living ? (
        <LivingPlanHero
          plan={living}
          doneToday={doneToday}
          checkIn={todayCheckIn}
          defaultAvailableMin={resolvedAvailableMin(todayCheckIn, profile)}
          feedback={state.livingPlanFeedback?.[todayKey()] ?? null}
          onFeedback={(vote, reason) => {
            saveLivingPlanFeedback(todayKey(), vote, reason);
            void trackOutcome(getDeviceId(), vote === "up" ? "living_plan_followed" : "living_plan_skipped", {
              reason: reason ?? null,
            });
            toast.success(vote === "up" ? "Obrigado — o plano segue" : "Anotado — vamos ajustar");
          }}
          onSaveCheckIn={(c) => {
            saveDayCheckIn(c);
            toast.success("Plano de hoje atualizado");
          }}
          primaryAction={(() => {
            if (!topRec) return null;
            const action: LivingPlanPrimaryAction = {
              id: topRec.id,
              title: topRec.title,
              reason: topRec.reason,
            };
            if (topRec.href) action.href = topRec.href;
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
              hint: gap ?? (nextMeal?.preset ? `${nextMeal.preset.proteinG} g proteína` : "Slots do dia preenchidos"),
              servings: servingsNow,
              onServings: (n) => setEatServings(clampServings(n)),
              onApply: () => {
                if (nextMeal?.preset) applySuggestedMeal(servingsNow);
                else setMealSlot(suggestSlot());
              },
              onRegister: () => setMealSlot(nextMeal?.slot ?? suggestSlot()),
            };
            if (lastSameSlot) {
              eat.onRepeatLast = () => {
                addMealEntry(copyMealToSlot(lastSameSlot, nextMeal?.slot ?? lastSameSlot.slot));
                toast.success("Igual ontem");
              };
              eat.repeatLabel = "Igual ontem";
            }
            return eat;
          })()}
        />
      ) : null}

      {persona !== "inativo" ? (
        <div className="mb-4 space-y-3">
          <XpBar xp={xp} />
          <DailyQuestsCard state={state} />
        </div>
      ) : null}

      {atRisk ? (
        <div className="surface-glass mb-4 flex flex-col gap-3 border-primary/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <Flame className="size-5 shrink-0 text-primary text-glow" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Não perca o streak de {st}d</p>
              <p className="text-xs text-muted-foreground">Treine, faça Express ou use um freeze.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {day ? (
              <Link to="/treino/sessao/$id" params={{ id: day.id }} search={{ express: false, from: "hoje" }}>
                <Button size="sm">Treinar</Button>
              </Link>
            ) : null}
            {(state.streakFreezes ?? 0) > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (useStreakFreeze()) toast.success("Freeze usado — streak salvo");
                  else toast.error("Não foi possível usar o freeze");
                }}
              >
                Freeze ({state.streakFreezes})
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {restockSoon ? (
        <div className="surface-glass mb-4 border-primary/25 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Estoque estimado</p>
          <div className="mt-2 flex items-center gap-3">
            <SoldiersMediaThumb
              media={resolveProductMedia(restockSoon.product.id)}
              alt={restockSoon.product.name}
              className="size-12 rounded-xl"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Pedir de novo {restockSoon.product.name}</p>
              <p className="text-xs text-muted-foreground">
                ~{Math.max(0, restockSoon.soon.days)} dia{restockSoon.soon.days === 1 ? "" : "s"} restantes
                (estimativa)
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

      {homeBlocks.map((blockId: HomeBlockId) => {
        if (blockId === "wow" && persona === "avancado" && wow) {
          return (
            <div key="wow" className="mb-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 px-3 py-2 text-center">
                <p className="text-display text-lg text-primary">
                  {wow.volumeDeltaPct != null ? `${wow.volumeDeltaPct > 0 ? "+" : ""}${wow.volumeDeltaPct}%` : "—"}
                </p>
                <p className="text-[0.65rem] uppercase text-muted-foreground">Volume</p>
              </div>
              <div className="rounded-xl border border-white/10 px-3 py-2 text-center">
                <p className="text-display text-lg text-primary">{living?.traffic.recovery ?? "—"}</p>
                <p className="text-[0.65rem] uppercase text-muted-foreground">Recuperação</p>
              </div>
              <div className="rounded-xl border border-white/10 px-3 py-2 text-center">
                <p className="text-display text-lg text-primary">{weekPrs.length}</p>
                <p className="text-[0.65rem] uppercase text-muted-foreground">PRs sem.</p>
              </div>
            </div>
          );
        }
        if (blockId === "weekPrs" && persona === "consistente" && weekPrs.length) {
          return (
            <p key="weekPrs" className="mb-3 text-sm font-semibold text-primary">
              {weekPrs.length} PR{weekPrs.length === 1 ? "" : "s"} esta semana
            </p>
          );
        }
        if (blockId === "periodReview" && weekReview && weekReview.sessions > 0) {
          return <PeriodReviewCard key="periodReview" review={weekReview} />;
        }
        if (blockId === "streakRisk") return null;
        if (blockId === "nutritionProof" && nutProof) {
          return (
            <Link
              key="nutritionProof"
              to="/nutricao"
              className="mb-3 block rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
            >
              {nutProof}
            </Link>
          );
        }
        if (blockId === "registerMeal") {
          if (living) return null;
          return (
            <div key="registerMeal" className="mb-4 space-y-2">
              {gap ? (
                <p className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                  {gap}
                </p>
              ) : null}
              <Button variant="secondary" className="h-11 w-full" onClick={() => setMealSlot(nextMeal?.slot ?? suggestSlot())}>
                <Utensils className="size-4" /> Registrar refeição
              </Button>
            </div>
          );
        }
        if (blockId === "supplement" && nowSuggestion) {
          return (
            <section key="supplement" className="surface-glass mb-4 space-y-3 p-4">
              <p className="eyebrow">Suplemento</p>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <SoldiersMediaThumb
                    media={resolveProductMedia(nowSuggestion.id)}
                    alt={nowSuggestion.name}
                    className="size-12 rounded-xl"
                  />
                  <div>
                    <p className="text-sm font-semibold">{nowSuggestion.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {nowSuggestion.timing} · {nowSuggestion.serving}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!taken.includes(nowSuggestion.id)) toggleSupplement(nowSuggestion.id);
                    toast.success(`${nowSuggestion.name} marcado`);
                  }}
                >
                  <Pill className="size-3.5" />
                  {taken.includes(nowSuggestion.id) ? "Tomado" : "Marcar"}
                </Button>
              </div>
            </section>
          );
        }
        if (blockId === "insights") {
          if (!insightLine && userCtx.why.length <= 1) return null;
          return (
            <div key="insights">
              {insightLine ? (
                <p className="mb-3 px-1 text-xs text-muted-foreground">{insightLine}</p>
              ) : null}
              {userCtx.why.length > 1 ? (
                <p className="mb-3 px-1 text-[11px] text-muted-foreground/80">
                  {userCtx.why.slice(1, 3).join(" · ")}
                  {adhere > 0 ? ` · Aderência ${adhere}` : ""}
                </p>
              ) : null}
            </div>
          );
        }
        if (blockId === "habitTip" && persona === "novo" && tip) {
          return (
            <div key="habitTip" className="surface-glass mb-4 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="eyebrow">Hábito</p>
                  <p className="mt-1 text-sm font-semibold">{tip.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{tip.body}</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label="Dispensar"
                  onClick={() => markTipSeen(tip.id)}
                >
                  <X className="size-4" />
                </button>
              </div>
              <Link to={tip.ctaTo} className="mt-3 block">
                <Button size="sm" className="w-full" onClick={() => markTipSeen(tip.id)}>
                  {tip.ctaLabel}
                </Button>
              </Link>
            </div>
          );
        }
        if (blockId === "socialTeaser" && showLeague) {
          return (
            <Link
              key="socialTeaser"
              to="/social"
              search={{ tab: "feed" }}
              className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2"
            >
              <Users className="size-4 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{club ? `Clube · ${club.name}` : "Para você"}</p>
                <p className="text-[0.65rem] text-muted-foreground">Feed, desafios e pressão saudável</p>
              </div>
            </Link>
          );
        }
        return null;
      })}

      <div className="mt-4">
        <button
          type="button"
          className="flex w-full items-center justify-between px-1 py-2 text-left"
          onClick={() => setMaisAberto((v) => !v)}
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
          <div className="space-y-4">
            <WeekPath days={days} states={pathStates} />

            {showLeague && friendQuest ? (
              <section className="surface-glass p-4">
                <p className="eyebrow">Missão em dupla</p>
                <p className="mt-1 text-sm font-semibold">
                  {friendQuest.nameA} + {friendQuest.nameB}
                </p>
                <p className="text-xs text-muted-foreground">
                  {friendQuest.progressA + friendQuest.progressB}/{friendQuest.target} treinos esta semana
                </p>
              </section>
            ) : null}

            {showLeague && stories.length ? (
              <Link to="/social" search={{ tab: "clubes" }} className="mb-0 flex gap-2 overflow-x-auto pb-1">
                {stories.map((s) => (
                  <div key={s.id} className="shrink-0 text-center">
                    <img
                      src={s.imageUrl}
                      alt={s.displayName}
                      className="size-14 rounded-full border-2 border-primary object-cover"
                    />
                    <p className="mt-1 max-w-14 truncate text-[0.6rem] text-muted-foreground">{s.displayName}</p>
                  </div>
                ))}
              </Link>
            ) : null}

            {showLeague ? (
            <section>
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-sm font-semibold">{club ? `Clube · ${club.name}` : "Clube"}</p>
                <Link to="/social" search={{ tab: "feed" }} className="text-xs text-primary">
                  Ver mais
                </Link>
              </div>
              {club ? (
                <ActivityFeed
                  events={clubFeed}
                  deviceId={deviceId}
                  kudosGiven={kudosGiven}
                  compact
                  onKudos={(id) => {
                    setClubFeed((prev) =>
                      prev.map((x) => (x.id === id ? { ...x, kudosCount: x.kudosCount + 1 } : x)),
                    );
                    setKudosGiven((g) => ({ ...g, [id]: true }));
                  }}
                  onKudosQuest={markQuestKudos}
                />
              ) : (
                <Link to="/social" search={{ tab: "clubes" }} className="surface-glass flex items-center gap-3 p-4">
                  <Users className="size-5 text-primary" />
                  <div>
                    <p className="text-sm font-bold">Entre num clube</p>
                    <p className="text-xs text-muted-foreground">Feed, liga e pressão saudável</p>
                  </div>
                </Link>
              )}
            </section>
            ) : null}

            {persona !== "novo" && tip ? (
              <div className="surface-glass p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="eyebrow">Dica</p>
                    <p className="mt-1 text-sm font-semibold">{tip.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{tip.body}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                    aria-label="Dispensar"
                    onClick={() => markTipSeen(tip.id)}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link to={tip.ctaTo} className="flex-1">
                    <Button size="sm" className="w-full" onClick={() => markTipSeen(tip.id)}>
                      {tip.ctaLabel}
                    </Button>
                  </Link>
                  <Button size="sm" variant="secondary" onClick={() => markTipSeen(tip.id)}>
                    Entendi
                  </Button>
                </div>
              </div>
            ) : null}

            <Tabs defaultValue="status">
              <TabsList className="w-full rounded-full bg-muted/40 p-1">
                <TabsTrigger value="status" className="flex-1 rounded-full">
                  Status
                </TabsTrigger>
                <TabsTrigger value="rotina" className="flex-1 rounded-full">
                  Rotina
                </TabsTrigger>
              </TabsList>

              <TabsContent value="status" className="mt-4 space-y-4">
                <section className="surface-glass p-4">
                  <p className="eyebrow">Resumo do dia</p>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-display text-lg text-primary text-glow">{summary.trained ? "OK" : "—"}</p>
                      <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">Treino</p>
                    </div>
                    <div>
                      <p className="text-display text-lg text-primary">{summary.proteinPct}%</p>
                      <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">Proteína</p>
                    </div>
                    <div>
                      <p className="text-display text-lg text-primary">{summary.waterPct}%</p>
                      <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">Água</p>
                    </div>
                    <div>
                      <p className="text-display text-lg text-primary">{questsDone}/3</p>
                      <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">Missões</p>
                    </div>
                  </div>
                </section>

                <div className="flex items-baseline justify-between px-1">
                  <span className="text-sm text-muted-foreground">Score</span>
                  <span className="text-display text-2xl text-primary text-glow">
                    <NumberTicker value={score} />
                    <span className="ml-1 text-sm text-muted-foreground">/ 100</span>
                  </span>
                </div>

                <section className="surface-glass grid grid-cols-4 gap-1 p-4">
                  <MetricRing value={metrics.waterMl} max={goals.waterMl} label="Água" unit="ml" />
                  <MetricRing value={nutrition.proteinG} max={goals.proteinG} label="Proteína" unit="g" />
                  <MetricRing value={taken.length} max={Math.max(1, routine.length)} label="Suplementos" />
                  <MetricRing value={doneToday ? 1 : 0} max={1} label="Treino" />
                </section>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => {
                      addWater(500);
                      toast.success("Hidratação registrada");
                    }}
                  >
                    <Droplets className="size-4" /> Água
                  </Button>
                  <Button variant="outline" className="h-11" onClick={() => setMealSlot(suggestSlot())}>
                    <Utensils className="size-4" /> Refeição
                  </Button>
                  <Button variant="outline" className="h-11" onClick={openWeight}>
                    <Scale className="size-4" /> Peso
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="rotina" className="mt-4">
                <ul className="space-y-2">
                  {routine.map((p) => {
                    const done = taken.includes(p.id);
                    const highlight = nowSuggestion?.id === p.id;
                    return (
                      <li
                        key={p.id}
                        className={`surface-glass flex items-center justify-between gap-3 px-3 py-3 ${
                          highlight ? "border-primary/40" : ""
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <SoldiersMediaThumb
                            media={resolveProductMedia(p.id)}
                            alt={p.name}
                            className="size-10 rounded-lg"
                          />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{p.name}</p>
                            {highlight ? (
                              <Chip color="accent" size="sm" variant="soft" className="text-primary">
                                <Chip.Label>Agora</Chip.Label>
                              </Chip>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {p.timing} · {p.serving}
                          </p>
                        </div>
                        </div>
                        <Button size="sm" variant={done ? "default" : "secondary"} onClick={() => toggleSupplement(p.id)}>
                          {done ? "Tomado" : "Marcar"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </div>

      {mealSlot ? (
        <MealPickerSheet
          slot={mealSlot}
          onClose={() => setMealSlot(null)}
          onPick={onPickMeal}
          onPickCustom={onPickMealCustom}
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

