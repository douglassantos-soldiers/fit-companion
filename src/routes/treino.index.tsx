import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bookmark,
  CalendarDays,
  ChevronRight,
  Download,
  History,
  Play,
  Settings2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState } from "@/components/app-shell";
import { ExercisePlanRow } from "@/components/training/exercise-plan-row";
import { ExerciseSwapPicker } from "@/components/training/exercise-swap-picker";
import { MuscleHeatmap } from "@/components/session/muscle-heatmap";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import { alternativesFor } from "@/data/exercises";
import { buildWeeklyPlanDetailed } from "@/lib/engine/plan";
import { learningWeekHint } from "@/lib/engine/learning";
import { decisionContextForUi } from "@/lib/engine/assemble-decision-context";
import {
  isTodayPlannedDay,
  selectTrainingMode,
  todaySessionShouldBeExpress,
} from "@/lib/engine/decision-context-snapshot";
import {
  WEEK_MODE_LABEL,
  PROGRESSION_CODE_LABEL,
  type ProgressionReasonCode,
} from "@/lib/engine/progression";
import {
  muscleRecoveryMap,
  buildMuscleRecoverySnapshots,
  consecutiveHardRpeStreak,
} from "@/lib/engine/recovery";
import { useStore } from "@/lib/store";
import { downloadSessionsCsv } from "@/lib/training/export-sessions-csv";
import { GYM_GEAR_OPTIONS, matchesInventory } from "@/lib/training/inventory";
import { isStickyPlanActive } from "@/lib/training/saved-training-plans";
import { blockDisplayWeek } from "@/lib/training/training-block";
import { resolveTrainingPlanDays } from "@/lib/training/resolve-plan-days";
import { WEEKDAY_LABELS } from "@/lib/training/weekdays";
import {
  FOCUS_MUSCLE_LABEL,
  GYM_GEAR_LABEL,
  GOAL_LABEL,
  todayKey,
  type Equipment,
  type FocusMuscle,
  type GymGear,
} from "@/lib/types";

export const Route = createFileRoute("/treino/")({
  head: () => ({
    meta: [
      { title: "Treino — Soldiers Training" },
      {
        name: "description",
        content:
          "Plano semanal gerado pelo seu perfil, com séries, repetições e progressão de carga.",
      },
      { property: "og:title", content: "Seu plano de treino" },
      {
        property: "og:description",
        content: "Divisão semanal, cargas sugeridas e histórico de sessões.",
      },
    ],
  }),
  component: TrainingPage,
});

const FOCUS_OPTIONS = Object.keys(FOCUS_MUSCLE_LABEL) as FocusMuscle[];

function TrainingPage() {
  const {
    state,
    hydrated,
    patchProfile,
    setExercisePreference,
    saveDayCheckIn,
    forkWeeklyPlan,
    saveDayAsRoutine,
    removeTrainingPlan,
    activateTrainingPlan,
    clearActiveTrainingPlan,
    leaveTrainingBlock,
    replacePrescribedExercise,
  } = useStore();
  const todayCheck = state.dayCheckIns?.[todayKey()];
  const [equipOverride, setEquipOverride] = useState<Equipment | null>(
    todayCheck?.equipment ?? null,
  );
  const [ajustesOpen, setAjustesOpen] = useState(false);
  const [swapFor, setSwapFor] = useState<{ dayId: string; exerciseId: string } | null>(null);

  const recoveryCtx = useMemo(
    () => ({
      ...(todayCheck?.sleepHours != null ? { sleepHours: todayCheck.sleepHours } : {}),
      ...(todayCheck?.energy ? { energy: todayCheck.energy } : {}),
      sessionRpeHardStreak: consecutiveHardRpeStreak(state.sessions),
    }),
    [todayCheck?.sleepHours, todayCheck?.energy, state.sessions],
  );

  const planResult = useMemo(() => {
    if (!state.profile) return null;
    // Weekly candidates for display — today's mode comes from Decision snapshot
    return buildWeeklyPlanDetailed(
      state.profile,
      state.sessions,
      equipOverride ?? todayCheck?.equipment ?? undefined,
      learningWeekHint(state),
      {
        likedExerciseIds: state.likedExerciseIds ?? [],
        dislikedExerciseIds: state.dislikedExerciseIds ?? [],
        exercisePreferences: state.exercisePreferences,
        recoveryCtx,
      },
    );
  }, [state, equipOverride, todayCheck?.equipment, recoveryCtx]);

  const recovery = useMemo(
    () => muscleRecoveryMap(state.sessions, new Date(), recoveryCtx),
    [state.sessions, recoveryCtx],
  );
  const recoverySnaps = useMemo(
    () => buildMuscleRecoverySnapshots(state.sessions, recoveryCtx),
    [state.sessions, recoveryCtx],
  );

  if (!hydrated || !state.profile || !planResult) {
    return (
      <AppShell title="Treino">
        <div className="surface-card h-40 animate-pulse" />
      </AppShell>
    );
  }

  const profile = state.profile;
  const sticky = isStickyPlanActive(state);
  const block = state.activeTrainingBlock;
  const generatedDays = planResult.days;
  const plan = block || sticky ? resolveTrainingPlanDays(state) : generatedDays;
  const weekMode = planResult.weekMode;
  const todayWeekday = new Date().getDay();
  const todayDay = plan.find((d) => d.weekday === todayWeekday) ?? plan[0] ?? null;
  const decisionCtx = decisionContextForUi(state);
  const trainingMode = decisionCtx ? selectTrainingMode(decisionCtx) : null;
  const expressForDay = (dayId: string) => {
    // Mode SoT = Decision; acceptedTrainingMode only if already reflected in snapshot
    return todaySessionShouldBeExpress({
      snapshot: decisionCtx,
      isTodaySession: isTodayPlannedDay(dayId, decisionCtx) || dayId === todayDay?.id,
      ...(trainingMode === "express" ? { acceptedTrainingMode: "express" as const } : {}),
    });
  };
  const activeEquip = equipOverride ?? todayCheck?.equipment ?? profile.equipment;
  const weekdays = profile.trainingWeekdays ?? plan.map((d) => d.weekday);
  const swapSource = swapFor
    ? plan.flatMap((d) => d.exercises).find((e) => e.exerciseId === swapFor.exerciseId)
    : null;
  const swapOptions = swapSource
    ? alternativesFor(swapSource.exerciseId, activeEquip, profile.restrictions, {
        preferences: state.exercisePreferences,
        preferPublishedMedia: true,
      }).filter((e) => matchesInventory(e, activeEquip, profile.equipmentInventory))
    : [];

  const persistEquip = (eq: Equipment) => {
    setEquipOverride(eq);
    saveDayCheckIn({
      sleepHours: todayCheck?.sleepHours ?? profile.typicalSleepHours ?? 7,
      energy: todayCheck?.energy ?? "ok",
      availableMin: todayCheck?.availableMin ?? profile.typicalSessionMin ?? 60,
      equipment: eq,
      ...(eq === "casa" ? { noEquipment: true } : {}),
      ...(todayCheck?.soreness != null ? { soreness: todayCheck.soreness } : {}),
      ...(todayCheck?.stress != null ? { stress: todayCheck.stress } : {}),
      ...(todayCheck?.notes ? { notes: todayCheck.notes } : {}),
      ...(todayCheck?.acceptedTrainingMode
        ? { acceptedTrainingMode: todayCheck.acceptedTrainingMode }
        : {}),
    });
    toast.success(`Plano de hoje: ${eq}`);
  };

  return (
    <AppShell
      title="Seu plano"
      subtitle={`${plan.length}x por semana · ${GOAL_LABEL[profile.goal].toLowerCase()} · ${activeEquip}`}
    >
      {todayDay ? (
        <Link
          to="/treino/sessao/$id"
          params={{ id: todayDay.id }}
          search={{ express: expressForDay(todayDay.id), from: "treino" }}
          className="mb-4 block"
        >
          <Button className="glow-primary h-14 w-full font-bold uppercase tracking-wide">
            <Play className="size-4" /> Treinar agora
          </Button>
        </Link>
      ) : null}

      {block ? (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-primary">
              Bloco ativo
            </p>
            <p className="truncate text-sm font-semibold">
              {block.name} · Semana {blockDisplayWeek(block)}/{block.durationWeeks}
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
                toast.success("Saiu do bloco — plano genérico de volta");
              }}
            >
              Sair
            </Button>
          </div>
        </div>
      ) : sticky ? (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-primary">Rotina</p>
            <p className="truncate text-sm font-semibold">{sticky.name}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              clearActiveTrainingPlan();
              toast.success("Rotina sticky removida");
            }}
          >
            Sair
          </Button>
        </div>
      ) : null}

      <div className="mb-4 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setAjustesOpen(true)}>
          <Settings2 className="size-3.5" /> Ajustes
        </Button>
      </div>

      {weekMode !== "normal" ? (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
            weekMode === "deload"
              ? "border-chart-4/40 bg-chart-4/10 text-foreground"
              : "border-primary/40 bg-primary/10 text-foreground"
          }`}
        >
          <p className="text-display text-sm text-primary">{WEEK_MODE_LABEL[weekMode]}</p>
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            {weekMode === "deload"
              ? "Baseado no seu RPE recente: volume e carga reduzidos automaticamente."
              : "Treinos recentes fáceis: o motor aumentou o estímulo desta semana."}
          </p>
        </div>
      ) : null}

      <section className="surface-card mb-4 p-5">
        <h2 className="text-lg">Recuperação muscular</h2>
        <p className="text-xs text-muted-foreground">
          Heatmap por grupo — volume e carga muscular (7d) influenciam a recuperação
        </p>
        <div className="mt-4">
          <MuscleHeatmap recovery={recovery} />
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-1.5 text-[0.65rem] text-muted-foreground">
          {recoverySnaps
            .filter((s) => s.muscle !== "cardio")
            .map((s) => (
              <li key={s.muscle} className="flex justify-between gap-2">
                <span>{s.label}</span>
                <span>
                  load7d {s.load7d}
                  {s.reasonCodes.includes("excessive_muscle_load") ? " · alta" : ""}
                </span>
              </li>
            ))}
        </ul>
      </section>

      <div className="mb-4 flex gap-2">
        {(["academia", "casa"] as Equipment[]).map((eq) => (
          <button
            key={eq}
            type="button"
            onClick={() => persistEquip(eq)}
            className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold capitalize transition-colors ${
              activeEquip === eq
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            Hoje: {eq}
          </button>
        ))}
      </div>

      <Tabs defaultValue="semana">
        <TabsList className="w-full">
          <TabsTrigger value="semana" className="flex-1">
            <CalendarDays className="size-4" /> Semana
          </TabsTrigger>
          <TabsTrigger value="rotinas" className="flex-1">
            <Bookmark className="size-4" /> Rotinas
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex-1">
            <History className="size-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="semana" className="mt-4 space-y-3">
          {sticky ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
              <span className="min-w-0 truncate font-semibold text-primary">
                Rotina: {sticky.name}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  clearActiveTrainingPlan();
                  toast.success("Voltou ao plano gerado");
                }}
              >
                Plano gerado
              </Button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-10 flex-1"
              onClick={() => {
                const saved = forkWeeklyPlan(plan);
                toast.success(`Salvo: ${saved.name}`);
              }}
            >
              <Bookmark className="size-4" /> Fork da semana
            </Button>
          </div>
          {plan.map((day) => (
            <article key={day.id} className="surface-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-primary">
                    {WEEKDAY_LABELS[day.weekday]}
                    {day.recoveryScore !== undefined && day.recoveryScore < 35 ? " · leve" : ""}
                  </p>
                  <h2 className="mt-1 text-xl">{day.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {day.focus} · ~{day.estimatedMin} min
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => {
                    const saved = saveDayAsRoutine(day);
                    toast.success(`Dia salvo: ${saved.name}`);
                  }}
                >
                  <Bookmark className="size-3.5" />
                </Button>
              </div>
              <ul className="mt-3 space-y-2">
                {day.exercises.map((ex) => {
                  const pinned = state.exercisePreferences?.[ex.exerciseId] === "preferred";
                  const chips = (ex.reasonCodes ?? [])
                    .slice(0, 2)
                    .map((c) => PROGRESSION_CODE_LABEL[c as ProgressionReasonCode] ?? c);
                  return (
                    <ExercisePlanRow
                      key={ex.exerciseId}
                      exerciseId={ex.exerciseId}
                      name={ex.name}
                      sets={ex.sets}
                      reps={ex.reps}
                      suggestedLoad={ex.suggestedLoad}
                      unit={ex.unit}
                      chips={chips}
                      pinned={pinned}
                      onPin={() =>
                        setExercisePreference(ex.exerciseId, pinned ? "clear" : "preferred")
                      }
                      onSwap={() => setSwapFor({ dayId: day.id, exerciseId: ex.exerciseId })}
                      onSkip={() => {
                        setExercisePreference(ex.exerciseId, "avoided");
                        toast.success("Exercício evitado no próximo plano");
                      }}
                    />
                  );
                })}
              </ul>
              <Link
                to="/treino/sessao/$id"
                params={{ id: day.id }}
                search={{ express: expressForDay(day.id), from: "treino" }}
                className="mt-4 block"
              >
                <Button className="h-11 w-full font-bold uppercase tracking-wide">
                  <Play className="size-4" /> Treinar
                </Button>
              </Link>
            </article>
          ))}
        </TabsContent>

        <TabsContent value="rotinas" className="mt-4 space-y-3">
          <Button
            type="button"
            className="h-11 w-full font-bold uppercase tracking-wide"
            onClick={() => {
              const saved = forkWeeklyPlan(plan);
              toast.success(`Fork salvo: ${saved.name}`);
            }}
          >
            <Bookmark className="size-4" /> Fork desta semana
          </Button>
          {(state.savedTrainingPlans ?? []).length === 0 ? (
            <EmptyState
              variant="treino"
              title="Nenhuma rotina ainda"
              description="Faça fork da semana atual ou salve um dia com o ícone de marcador."
            />
          ) : (
            (state.savedTrainingPlans ?? []).map((routine) => {
              const firstDay = routine.days[0];
              const isActive = sticky?.id === routine.id;
              return (
                <article key={routine.id} className="surface-card space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                        {routine.kind === "week" ? "Semana" : "Dia"} · {routine.days.length} dia
                        {routine.days.length === 1 ? "" : "s"}
                      </p>
                      <h2 className="truncate text-lg">{routine.name}</h2>
                      {firstDay ? (
                        <p className="text-xs text-muted-foreground">
                          {firstDay.title}
                          {routine.days.length > 1 ? ` +${routine.days.length - 1}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        removeTrainingPlan(routine.id);
                        toast.success("Rotina removida");
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={isActive ? "default" : "secondary"}
                      className="h-10 flex-1"
                      onClick={() => {
                        activateTrainingPlan(routine.id);
                        toast.success("Rotina ativa nesta semana");
                      }}
                    >
                      {isActive ? "Em uso" : "Usar esta semana"}
                    </Button>
                    {firstDay ? (
                      <Link
                        to="/treino/sessao/$id"
                        params={{ id: firstDay.id }}
                        search={{ express: expressForDay(firstDay.id), from: "treino" }}
                        className="flex-1"
                        onClick={() => {
                          if (!isActive) activateTrainingPlan(routine.id);
                        }}
                      >
                        <Button type="button" className="h-10 w-full">
                          <Play className="size-4" /> Iniciar
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-4 space-y-3">
          {state.sessions.length === 0 ? (
            <EmptyState
              variant="treino"
              title="Histórico vazio"
              description="Sua primeira sessão aparece aqui depois que você treinar."
              action={
                plan[0] ? (
                  <Link
                    to="/treino/sessao/$id"
                    params={{ id: plan[0].id }}
                    search={{ express: expressForDay(plan[0].id), from: "treino" }}
                    className="block"
                  >
                    <Button className="h-11 w-full font-bold uppercase tracking-wide">
                      <Play className="size-4" /> Começar sessão
                    </Button>
                  </Link>
                ) : (
                  <Link to="/" className="block">
                    <Button className="h-11 w-full font-bold uppercase tracking-wide">
                      Ver Hoje
                    </Button>
                  </Link>
                )
              }
            />
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                className="h-10 w-full"
                onClick={() => {
                  if (!state.sessions.length) {
                    toast.message("Nenhuma sessão para exportar");
                    return;
                  }
                  downloadSessionsCsv(state.sessions);
                  toast.success("CSV baixado");
                }}
              >
                <Download className="size-4" /> Exportar CSV
              </Button>
              {state.sessions.map((s) => (
                <Link
                  key={s.id}
                  to="/treino/historico/$sessionId"
                  params={{ sessionId: s.id }}
                  className="block"
                >
                  <article className="surface-card p-4 transition-colors hover:border-primary">
                    <div className="flex justify-between">
                      <h2 className="text-base">{s.title}</h2>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(s.date).toLocaleDateString("pt-BR")} · {s.durationMin} min ·{" "}
                      {s.volumeKg.toLocaleString("pt-BR")} kg · {s.exercises.length} exercícios
                      {s.rpe ? ` · RPE ${s.rpe}` : ""}
                    </p>
                  </article>
                </Link>
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>

      <SoldiersOverlay
        open={ajustesOpen}
        onClose={() => setAjustesOpen(false)}
        title="Ajustes do plano"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dias da semana
        </p>
        <div className="mb-4 grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS.map((label, weekday) => {
            const on = weekdays.includes(weekday);
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  const next = on
                    ? weekdays.filter((d) => d !== weekday)
                    : [...weekdays, weekday].sort((a, b) => a - b);
                  if (next.length < 2) {
                    toast.error("Escolha pelo menos 2 dias");
                    return;
                  }
                  patchProfile({
                    trainingWeekdays: next.slice(0, 6),
                    daysPerWeek: Math.min(6, next.length),
                  });
                }}
                className={`rounded-xl border py-3 text-[0.65rem] font-bold uppercase ${
                  on ? "border-primary bg-primary text-primary-foreground" : "border-white/10"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Priorizar músculos
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {FOCUS_OPTIONS.map((m) => {
            const on = (profile.focusMuscles ?? []).includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  const cur = profile.focusMuscles ?? [];
                  patchProfile({
                    focusMuscles: on ? cur.filter((x) => x !== m) : [...cur, m],
                  });
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  on ? "border-primary bg-primary/15 text-primary" : "border-white/10"
                }`}
              >
                {FOCUS_MUSCLE_LABEL[m]}
              </button>
            );
          })}
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Inventário
        </p>
        <div className="flex flex-wrap gap-2">
          {GYM_GEAR_OPTIONS.map((g: GymGear) => {
            const on = (profile.equipmentInventory ?? []).includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => {
                  const cur = profile.equipmentInventory ?? [];
                  const next = on ? cur.filter((x) => x !== g) : [...cur, g];
                  patchProfile({
                    equipmentInventory: next,
                    equipment:
                      next.includes("barra") || next.includes("maquinas") ? "academia" : "casa",
                  });
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  on ? "border-primary bg-primary/15 text-primary" : "border-white/10"
                }`}
              >
                {GYM_GEAR_LABEL[g]}
              </button>
            );
          })}
        </div>
      </SoldiersOverlay>

      <SoldiersOverlay
        open={Boolean(swapFor)}
        onClose={() => setSwapFor(null)}
        title="Trocar exercício"
        description="O atual entra em evitar; o novo fica preferido. Prefira alternativas com demo publicada."
      >
        <ExerciseSwapPicker
          options={swapOptions}
          emptyLabel="Nenhuma alternativa agora."
          onPick={(alt) => {
            if (!swapFor) return;
            if (block || sticky) {
              replacePrescribedExercise(swapFor.dayId, swapFor.exerciseId, {
                exerciseId: alt.id,
                name: alt.name,
                unit: alt.unit,
              });
            } else {
              setExercisePreference(swapFor.exerciseId, "avoided");
              setExercisePreference(alt.id, "preferred");
            }
            setSwapFor(null);
            toast.success(`Trocado para ${alt.name}`);
          }}
        />
      </SoldiersOverlay>
    </AppShell>
  );
}
