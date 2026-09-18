import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { NumberInput, Modal } from "@mantine/core";
import { Chip } from "@heroui/react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Droplets,
  Flame,
  Pill,
  Play,
  Plus,
  Scale,
  TrendingUp,
  Users,
  Utensils,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { MealPickerSheet } from "@/components/meal-picker-sheet";
import { MealPresetThumb } from "@/components/meal-preset-thumb";
import { MetricRing } from "@/components/metric-ring";
import { Spinner } from "@/components/kibo-ui/spinner";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityFeed } from "@/components/social/activity-feed";
import { DailyQuestsCard, XpBar } from "@/components/today/engagement-cards";
import { WeekPath } from "@/components/today/week-path";
import { PRODUCTS } from "@/data/products";
import { reorderUrlForProduct } from "@/data/shopify-product-map";
import { trackAppEvent } from "@/lib/shopify.functions";
import { isQuestComplete, questById } from "@/data/daily-quests";
import type { MealPreset } from "@/data/meal-presets";
import { performanceDimensions, performanceScore, streak } from "@/lib/engine/dimensions";
import { computeLearningInsights, topLearningInsight, learningWeekHint } from "@/lib/engine/learning";
import {
  buildDailyMealPlan,
  dayNutritionTotals,
  nextSuggestedMeal,
  nutritionGoals,
  addMealFromPreset,
  suggestSlot,
} from "@/lib/engine/nutrition";
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
import { DAILY_XP_GOAL, MEAL_SLOT_LABEL, todayKey, type MealSlot } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hoje — Soldiers Performance OS" },
      {
        name: "description",
        content: "Uma ação óbvia: iniciar o treino ou registrar a refeição.",
      },
      { property: "og:title", content: "Soldiers Performance OS" },
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
  } = useStore();
  const [mealSlot, setMealSlot] = useState<MealSlot | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightKg, setWeightKg] = useState<number | string>("");
  const [leagueMe, setLeagueMe] = useState<LeagueRow | null>(null);
  const [friendQuest, setFriendQuest] = useState<FriendQuest | null>(null);
  const [stories, setStories] = useState<ClubStory[]>([]);
  const [maisAberto, setMaisAberto] = useState(false);
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
  const insightLine = topLearningInsight(state);
  const plan = buildWeeklyPlan(profile, state.sessions, learningWeekHint(state));
  const day = planDayForToday(plan);
  const expressDay = day ? buildExpressSession(day) : null;
  const doneToday = state.sessions.some((s) => s.date.slice(0, 10) === todayKey());
  const metrics = todayMetrics(state);
  const taken = todaySupplements(state);
  const dims = performanceDimensions(state, profile);
  const score = performanceScore(dims);
  const st = streak(state.sessions, { freezeUsedDates: state.freezeUsedDates });
  const goals = nutritionGoals(profile, insights);
  const nutrition = dayNutritionTotals(state.meals ?? []);
  const mealPlan = buildDailyMealPlan(profile, state, todayKey(), insights);
  const nextMeal = nextSuggestedMeal(mealPlan);
  const xp = dailyXp(state);

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

  const applySuggestedMeal = () => {
    if (!nextMeal?.preset) return;
    addMealEntry(addMealFromPreset(nextMeal.preset, nextMeal.slot, 1));
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

  return (
    <AppShell
      title={`Bom treino, ${profile.name.split(" ")[0]}`}
      subtitle={`Score ${score}/100 · streak ${st}d · ${xp}/${DAILY_XP_GOAL} XP`}
      headerBadge={`${st}d`}
      hideTitle
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Olá, <span className="font-semibold text-foreground">{profile.name.split(" ")[0]}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Score {score}/100 · streak {st}d
            {leagueMe ? ` · Liga #${leagueMe.rank}` : ""}
          </p>
        </div>
        <Link to="/progresso" className="flex items-center gap-1 text-xs font-semibold text-primary">
          <TrendingUp className="size-3.5" /> Progresso
        </Link>
      </div>

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
              <Link to="/treino/sessao/$id" params={{ id: day.id }} search={{ express: false }}>
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

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="surface-glass relative overflow-hidden"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative space-y-4 p-5">
          <p className="eyebrow">Plano de hoje</p>
          <div>
            {doneToday ? (
              <>
                <h2 className="text-display text-3xl leading-none">Treino concluído</h2>
                <p className="mt-2 text-sm text-muted-foreground">Recuperação: água, proteína e sono.</p>
                <Link to="/progresso" className="mt-4 block">
                  <Button size="lg" className="h-12 w-full glow-primary font-bold uppercase tracking-wide">
                    Ver progresso
                  </Button>
                </Link>
              </>
            ) : day ? (
              <>
                <h2 className="text-display text-3xl leading-none">{day.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {day.focus} · {day.exercises.length} exercícios · ~{day.estimatedMin} min
                </p>
                <Link to="/treino/sessao/$id" params={{ id: day.id }} search={{ express: false }} className="mt-4 block">
                  <Button size="lg" className="h-12 w-full glow-primary font-bold uppercase tracking-wide">
                    <Play className="size-4" /> Iniciar treino
                  </Button>
                </Link>
                {expressDay ? (
                  <Link
                    to="/treino/sessao/$id"
                    params={{ id: day.id }}
                    search={{ express: true }}
                    className="mt-2 block"
                  >
                    <Button size="lg" variant="secondary" className="h-11 w-full font-bold uppercase tracking-wide">
                      <Zap className="size-4" /> Express (~{expressDay.estimatedMin} min)
                    </Button>
                  </Link>
                ) : null}
              </>
            ) : (
              <>
                <h2 className="text-display text-3xl leading-none">Descanso ativo</h2>
                <p className="mt-2 text-sm text-muted-foreground">20–30 min de caminhada e mobilidade.</p>
                <Link to="/treino" className="mt-4 block">
                  <Button size="lg" variant="secondary" className="h-12 w-full font-bold uppercase tracking-wide">
                    Ver semana
                  </Button>
                </Link>
              </>
            )}
          </div>

          <div className="border-t border-white/10 pt-3">
            <p className="eyebrow">Comida</p>
            {nextMeal?.preset ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <MealPresetThumb preset={nextMeal.preset} className="size-11" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {MEAL_SLOT_LABEL[nextMeal.slot]} · {nextMeal.preset.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {nextMeal.preset.proteinG} g · {nutrition.proteinG}/{goals.proteinG} g hoje
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={applySuggestedMeal}>
                    <Check className="size-3.5" /> Aplicar
                  </Button>
                  <Link to="/nutricao">
                    <Button size="sm" variant="secondary">
                      Plano
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Slots do dia preenchidos.</p>
                <Link to="/nutricao">
                  <Button size="sm" variant="secondary">
                    Ver
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {nowSuggestion ? (
            <div className="border-t border-white/10 pt-3">
              <p className="eyebrow">Suplemento</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{nowSuggestion.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {nowSuggestion.timing} · {nowSuggestion.serving}
                  </p>
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
            </div>
          ) : null}

          {insightLine ? (
            <div className="border-t border-white/10 pt-3">
              <p className="eyebrow">Aprendizado</p>
              <p className="mt-1 text-sm text-muted-foreground">{insightLine}</p>
            </div>
          ) : null}
        </div>
      </motion.section>

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
            <XpBar xp={xp} />

            {(() => {
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
              return (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="surface-glass block border-primary/25 px-4 py-3"
                  onClick={() => {
                    const id = getDeviceId();
                    if (!id) return;
                    void trackAppEvent({
                      data: {
                        deviceId: id,
                        kind: "restock_cta_click",
                        payload: { source: "home", productId: soon.productId },
                      },
                    });
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Reposição</p>
                  <p className="mt-1 text-sm font-semibold">
                    {product.name} acaba em ~{Math.max(0, soon.days)} dia{soon.days === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-muted-foreground">Toque para reordenar na Soldiers</p>
                </a>
              );
            })()}

            <WeekPath days={days} states={pathStates} />

            <DailyQuestsCard state={state} />

            {friendQuest ? (
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

            {stories.length ? (
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

            {tip ? (
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

      {mealSlot ? <MealPickerSheet slot={mealSlot} onClose={() => setMealSlot(null)} onPick={onPickMeal} /> : null}

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
    </AppShell>
  );
}

