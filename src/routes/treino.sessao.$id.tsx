import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Camera, Check, PartyPopper, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import { ShareCardActions } from "@/components/progress/share-card";
import { ExerciseStage } from "@/components/session/exercise-stage";
import { RestTimer } from "@/components/session/rest-timer";
import { fxExerciseDone, fxRestEnd, fxSetDone } from "@/components/session/session-fx";
import { SessionCelebration } from "@/components/today/engagement-cards";
import { alternativesFor, exerciseById } from "@/data/exercises";
import { isQuestComplete, questById } from "@/data/daily-quests";
import { performanceDimensions, performanceScore, streak } from "@/lib/engine/dimensions";
import { buildExpressSession, buildWeeklyPlan, sessionVolume, type PlannedExercise } from "@/lib/engine/plan";
import { learningWeekHint } from "@/lib/engine/learning";
import { progressionForExercise, weekModifier } from "@/lib/engine/progression";
import { dailyXp, XP } from "@/lib/engine/xp";
import { listMyClubs, publishClubStory, uploadCheckinImage } from "@/lib/social";
import { getDeviceId } from "@/lib/sync";
import { SOLDIERS_BORDER, SOLDIERS_YELLOW } from "@/lib/ui-theme";
import { useStore } from "@/lib/store";
import { suggestPostWorkoutUpsell } from "@/data/shopify-product-map";
import { trackAppEvent } from "@/lib/shopify.functions";
import { useServerFn } from "@tanstack/react-start";
import { todayKey, type ExerciseLog, type SessionLog, type SessionRpe, type SetLog } from "@/lib/types";

export const Route = createFileRoute("/treino/sessao/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    express: search["express"] === true || search["express"] === "true" ? true : false,
  }),
  head: () => ({
    meta: [
      { title: "Sessão de treino — Soldiers Performance OS" },
      {
        name: "description",
        content: "Execute o treino com séries, cargas sugeridas e cronômetro de descanso.",
      },
      { property: "og:title", content: "Sessão de treino" },
      { property: "og:description", content: "Marque cada série e registre o volume da sessão." },
    ],
  }),
  component: SessionPage,
});

const RPE_OPTIONS: Array<{ id: SessionRpe; label: string; hint: string }> = [
  { id: "facil", label: "Fácil", hint: "Sobrou energia" },
  { id: "ok", label: "Ok", hint: "No ponto" },
  { id: "dificil", label: "Difícil", hint: "No limite" },
];

type CelebrateKind = "set" | "exercise" | null;

type RestState = { seconds: number; paused: boolean } | null;

function SessionPage() {
  const { id } = useParams({ from: "/treino/sessao/$id" });
  const { express } = Route.useSearch();
  const navigate = useNavigate();
  const { state, hydrated, addSession, markUpsellShown } = useStore();
  const track = useServerFn(trackAppEvent);
  const fxOn = state.sessionFx !== false;

  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [planned, setPlanned] = useState<PlannedExercise[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [activeExIdx, setActiveExIdx] = useState(0);
  const [rest, setRest] = useState<RestState>(null);
  const [celebrate, setCelebrate] = useState<CelebrateKind>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryBurst, setSummaryBurst] = useState(false);
  const [sharePanel, setSharePanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [checkinFile, setCheckinFile] = useState<File | null>(null);
  const [ritualOpen, setRitualOpen] = useState(false);
  const [ritual, setRitual] = useState({
    xpGained: 0,
    xpTotal: 0,
    streak: 0,
    questsDone: 0,
    questsTotal: 0,
  });

  const upsell =
    ritualOpen && state.upsellShownDate !== todayKey()
      ? suggestPostWorkoutUpsell(state.supplementRoutine)
      : null;
  const day = useMemo(() => {
    if (!state.profile) return null;
    const base =
      buildWeeklyPlan(state.profile, state.sessions, learningWeekHint(state)).find((d) => d.id === id) ?? null;
    if (!base) return null;
    return express ? buildExpressSession(base) : base;
  }, [state, id, express]);

  useEffect(() => {
    if (!day) return;
    setPlanned(day.exercises);
    setLogs(
      day.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        sets: Array.from({ length: ex.sets }, () => ({
          reps: Number((ex.reps.split("-")[0] ?? "10").replace(/\D/g, "")) || 10,
          weightKg: ex.suggestedLoad,
          done: false,
        })),
      })),
    );
    setActiveExIdx(0);
  }, [day?.id]);

  useEffect(() => {
    if (!rest || rest.paused) return;
    if (rest.seconds <= 0) {
      fxRestEnd(fxOn);
      setRest(null);
      return;
    }
    const t = setTimeout(() => {
      setRest((r) => (r === null || r.paused ? r : { ...r, seconds: r.seconds - 1 }));
    }, 1000);
    return () => clearTimeout(t);
  }, [rest, fxOn]);

  useEffect(() => {
    if (!celebrate) return;
    const ms = celebrate === "exercise" ? 900 : 700;
    const t = setTimeout(() => setCelebrate(null), ms);
    return () => clearTimeout(t);
  }, [celebrate]);

  if (!hydrated || !state.profile || !day) {
    return (
      <div className="mx-auto w-full max-w-md space-y-3 p-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const profile = state.profile;
  const totalSets = logs.reduce((s, l) => s + l.sets.length, 0);
  const doneSets = logs.reduce((s, l) => s + l.sets.filter((x) => x.done).length, 0);
  const volume = Math.round(sessionVolume(logs));
  const durationMin = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
  const progressPct = totalSets ? (doneSets / totalSets) * 100 : 0;
  const draftSession: SessionLog = {
    id: `draft-${day.id}`,
    dayId: day.id,
    title: day.title,
    date: new Date().toISOString(),
    durationMin,
    exercises: logs,
    volumeKg: volume,
  };
  const dims = performanceDimensions(state, profile);
  const score = performanceScore(dims);
  const currentStreak = streak(state.sessions, { freezeUsedDates: state.freezeUsedDates });

  const safeExIdx = Math.min(activeExIdx, Math.max(0, planned.length - 1));
  const activePlanned = planned[safeExIdx];
  const activeLog = logs[safeExIdx];
  const activeExercise = activePlanned ? exerciseById(activePlanned.exerciseId) : undefined;
  const currentSetIdx = activeLog?.sets.findIndex((s) => !s.done) ?? -1;
  const workingSetIdx = currentSetIdx >= 0 ? currentSetIdx : Math.max(0, (activeLog?.sets.length ?? 1) - 1);
  const workingSet = activeLog?.sets[workingSetIdx];

  const nextLabel = (() => {
    if (!activePlanned || !activeLog) return "Próxima série";
    const remainingInEx = activeLog.sets.filter((s) => !s.done).length;
    if (remainingInEx > 0) return `${activePlanned.name} · série ${workingSetIdx + 1}`;
    const next = planned[safeExIdx + 1];
    return next ? next.name : "Fim do treino";
  })();

  const updateSet = (exIdx: number, setIdx: number, patch: Partial<SetLog>) =>
    setLogs((prev) =>
      prev.map((l, i) =>
        i !== exIdx ? l : { ...l, sets: l.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...patch })) },
      ),
    );

  const swapExercise = (exIdx: number, newId: string) => {
    const alt = exerciseById(newId);
    if (!alt) return;
    const current = planned[exIdx];
    const prog = progressionForExercise(
      alt,
      alt.baseLoad,
      current?.sets ?? 3,
      current?.reps ?? "8-10",
      current?.restSec ?? 90,
      profile.goal,
      state.sessions,
      weekModifier(state.sessions, 7, learningWeekHint(state)),
    );
    setPlanned((prev) =>
      prev.map((p, i) =>
        i !== exIdx
          ? p
          : {
              ...p,
              exerciseId: alt.id,
              name: alt.name,
              unit: alt.unit,
              sets: alt.unit === "min" || alt.group === "cardio" ? 1 : prog.sets,
              reps: prog.reps,
              suggestedLoad: prog.load,
              reason: `Trocado · ${prog.reason}`,
            },
      ),
    );
    setLogs((prev) =>
      prev.map((l, i) =>
        i !== exIdx
          ? l
          : {
              exerciseId: alt.id,
              sets: Array.from({ length: alt.unit === "min" || alt.group === "cardio" ? 1 : prog.sets }, () => ({
                reps: Number((prog.reps.split("-")[0] ?? "10").replace(/\D/g, "")) || 10,
                weightKg: prog.load,
                done: false,
              })),
            },
      ),
    );
    setSwapOpen(false);
    toast.success(`Trocado para ${alt.name}`);
  };

  const save = async (rpe: SessionRpe) => {
    if (saving) return;
    setSaving(true);
    const deviceId = getDeviceId();
    let imageUrl: string | undefined;
    if (checkinFile) {
      try {
        imageUrl = (await uploadCheckinImage(deviceId, checkinFile)) ?? undefined;
        if (imageUrl) {
          const clubs = await listMyClubs(deviceId);
          const club = clubs[0];
          if (club) await publishClubStory(club.id, deviceId, imageUrl);
        }
      } catch {
        toast.error("Não foi possível publicar a foto do check-in");
      }
    }
    const session: SessionLog = {
      id: `${Date.now()}`,
      dayId: day.id.replace(/-express$/, ""),
      title: day.title,
      date: new Date().toISOString(),
      durationMin,
      exercises: logs,
      volumeKg: volume,
      rpe,
      ...(express ? { express: true as const } : {}),
    };
    addSession(session, imageUrl ? { imageUrl } : {});
    if (deviceId) {
      void track({
        data: {
          deviceId,
          kind: "workout_completed",
          payload: { sessionId: session.id, express: !!express, volumeKg: volume },
        },
      });
    }

    const xpGained = express ? XP.express : XP.session;
    const xpTotal = dailyXp(state) + xpGained;
    const nextSessions = [session, ...state.sessions];
    const nextState = {
      ...state,
      sessions: nextSessions,
      xpByDate: { ...state.xpByDate, [session.date.slice(0, 10)]: xpTotal },
    };
    const questIds = state.dailyQuestIds ?? [];
    const questsDone = questIds.filter((qid) => {
      const q = questById(qid);
      return q ? isQuestComplete(nextState, q) : false;
    }).length;

    setRitual({
      xpGained,
      xpTotal,
      streak: streak(nextSessions, { freezeUsedDates: state.freezeUsedDates }),
      questsDone,
      questsTotal: questIds.length,
    });
    setSummaryOpen(false);
    setRitualOpen(true);
    toast.success(`Treino salvo · ${volume.toLocaleString("pt-BR")} kg de volume`);
    setSaving(false);
  };

  const completeSet = () => {
    if (!activePlanned || !activeLog || !workingSet || workingSet.done) return;
    const exIdx = safeExIdx;
    const setIdx = workingSetIdx;

    const nextLogs = logs.map((l, i) =>
      i !== exIdx
        ? l
        : { ...l, sets: l.sets.map((s, j) => (j !== setIdx ? s : { ...s, done: true })) },
    );
    setLogs(nextLogs);

    const setsAfter = nextLogs[exIdx]!.sets;
    const exerciseDone = setsAfter.every((s) => s.done);
    const allDone = nextLogs.every((l) => l.sets.every((s) => s.done));

    fxSetDone(fxOn);
    setCelebrate(exerciseDone ? "exercise" : "set");
    if (exerciseDone) fxExerciseDone(fxOn);

    const restSec = activePlanned.restSec;
    window.setTimeout(() => {
      if (allDone) {
        setSummaryOpen(true);
        setSummaryBurst(true);
        return;
      }
      if (exerciseDone) {
        setActiveExIdx((i) => Math.min(i + 1, planned.length - 1));
      }
      if (restSec > 0) {
        setRest({ seconds: exerciseDone ? Math.min(restSec, 45) : restSec, paused: false });
      }
    }, exerciseDone ? 850 : 650);
  };

  const openSummary = () => {
    setSummaryOpen(true);
    setSummaryBurst(true);
  };

  const swapOptions = activeLog
    ? alternativesFor(activeLog.exerciseId, profile.equipment, profile.restrictions)
    : [];

  return (
    <div className="relative flex min-h-screen flex-col bg-background pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-background/70 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center gap-3">
          <button type="button" onClick={() => navigate({ to: "/treino" })} aria-label="Voltar">
            <ArrowLeft className="size-5 text-muted-foreground" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg">{day.title}</h1>
            <p className="text-xs text-muted-foreground">
              Ex {safeExIdx + 1}/{planned.length} · {doneSets}/{totalSets} séries
            </p>
          </div>
          <AnimatedCircularProgressBar
            value={progressPct}
            max={100}
            min={0}
            gaugePrimaryColor={SOLDIERS_YELLOW}
            gaugeSecondaryColor={SOLDIERS_BORDER}
            className="size-11 shrink-0 text-[0.65rem] text-primary"
          />
        </div>
        <div className="mx-auto mt-3 w-full max-w-md">
          <Progress value={progressPct} className="h-1.5" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-4">
        {activePlanned && activeLog && workingSet ? (
          <ExerciseStage
            planned={activePlanned}
            exercise={activeExercise}
            setLog={workingSet}
            setIndex={workingSetIdx}
            totalSets={activeLog.sets.length}
            exIndex={safeExIdx}
            totalExercises={planned.length}
            onChangeSet={(patch) => updateSet(safeExIdx, workingSetIdx, patch)}
            onCompleteSet={completeSet}
            onSwap={() => setSwapOpen(true)}
            onPrevExercise={() => setActiveExIdx((i) => Math.max(0, i - 1))}
            onNextExercise={() => setActiveExIdx((i) => Math.min(planned.length - 1, i + 1))}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
            <p className="text-display text-2xl text-primary">Sessão pronta</p>
            <Button className="h-12 w-full font-bold uppercase" onClick={openSummary}>
              Finalizar e salvar
            </Button>
          </div>
        )}

        {doneSets > 0 && doneSets === totalSets ? (
          <Button className="mt-4 h-12 w-full font-bold uppercase tracking-wide" onClick={openSummary}>
            Finalizar treino
          </Button>
        ) : null}
      </div>

      <AnimatePresence>
        {celebrate ? (
          <motion.div
            key={celebrate}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          >
            <div className="surface-card flex flex-col items-center gap-2 px-10 py-8 text-center">
              <Check className="size-12 text-primary" />
              <p className="text-display text-2xl text-primary">
                {celebrate === "exercise" ? "Exercício concluído" : "Série feita"}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {rest ? (
        <RestTimer
          seconds={rest.seconds}
          paused={rest.paused}
          nextLabel={nextLabel}
          onTogglePause={() => setRest((r) => (r ? { ...r, paused: !r.paused } : r))}
          onAdd30={() => setRest((r) => (r ? { ...r, seconds: r.seconds + 30 } : r))}
          onSkip={() => {
            fxRestEnd(fxOn);
            setRest(null);
          }}
        />
      ) : null}

      <SoldiersOverlay
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        title="Trocar exercício"
        description="Alternativas compatíveis com seu equipamento e restrições"
      >
        {swapOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alternativa disponível agora.</p>
        ) : (
          <ul className="space-y-2">
            {swapOptions.map((alt) => (
              <li key={alt.id}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-between rounded-xl px-4 py-3 text-left font-normal"
                  onClick={() => swapExercise(safeExIdx, alt.id)}
                >
                  <span>
                    <span className="block text-sm font-semibold">{alt.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {alt.group} · {alt.equipment}
                    </span>
                  </span>
                  <RefreshCw className="size-4 text-primary" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SoldiersOverlay>

      <SoldiersOverlay
        open={summaryOpen}
        onClose={() => {
          if (!saving) setSummaryOpen(false);
        }}
        title="Treino concluído"
        description={day.title}
        panelClassName="max-h-none relative overflow-hidden"
      >
        {summaryBurst ? <ConfettiBurst /> : null}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="-mt-2 grid grid-cols-3 gap-2 text-center"
        >
          <SummaryStat label="Volume" value={`${volume.toLocaleString("pt-BR")} kg`} />
          <SummaryStat label="Séries" value={`${doneSets}/${totalSets}`} />
          <SummaryStat label="Tempo" value={`${durationMin} min`} />
        </motion.div>

        {sharePanel ? (
          <div className="mt-4">
            <ShareCardActions
              athleteName={profile.name}
              session={draftSession}
              streak={currentStreak}
              score={score}
            />
            <Button
              variant="secondary"
              className="mt-2 h-9 w-full"
              onClick={() => setSharePanel(false)}
            >
              Voltar
            </Button>
          </div>
        ) : (
          <>
            <Button
              variant="secondary"
              className="mt-4 h-11 w-full"
              onClick={() => setSharePanel(true)}
            >
              <Share2 className="size-4" /> Compartilhar
            </Button>
            <label className="mt-3 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-white/10 bg-muted/40 text-sm font-medium transition hover:bg-muted/60">
              <Camera className="size-4 text-primary" />
              {checkinFile ? checkinFile.name : "Foto de check-in (opcional)"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={saving}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setCheckinFile(file);
                }}
              />
            </label>
            <p className="mt-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <PartyPopper className="size-4" /> Como foi?
            </p>
            <ToggleButtonGroup
              exclusive
              fullWidth
              disabled={saving}
              className="mt-3"
              onChange={(_e, value: SessionRpe | null) => {
                if (value) save(value);
              }}
              aria-label="RPE da sessão"
            >
              {RPE_OPTIONS.map((opt) => (
                <ToggleButton key={opt.id} value={opt.id} className="flex flex-col gap-0.5 py-3 normal-case">
                  <span className="text-display text-sm">{opt.label}</span>
                  <span className="text-[0.65rem] opacity-70">{opt.hint}</span>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Button
              variant="secondary"
              className="mt-4 h-11 w-full"
              onClick={() => setSummaryOpen(false)}
              disabled={saving}
            >
              Continuar treino
            </Button>
          </>
        )}
      </SoldiersOverlay>

      <SessionCelebration
        open={ritualOpen}
        onClose={() => {
          if (upsell) markUpsellShown();
          setRitualOpen(false);
          navigate({ to: "/" });
        }}
        xpGained={ritual.xpGained}
        xpTotal={ritual.xpTotal}
        streak={ritual.streak}
        questsDone={ritual.questsDone}
        questsTotal={ritual.questsTotal}
        upsell={upsell}
        onUpsellClick={() => {
          markUpsellShown();
          const deviceId = getDeviceId();
          if (deviceId && upsell) {
            void track({
              data: {
                deviceId,
                kind: "restock_cta_click",
                payload: { source: "post_workout", productId: upsell.productId },
              },
            });
          }
        }}
        onUpsellDismiss={() => markUpsellShown()}
      />
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-2 py-3">
      <p className="text-display text-sm text-primary">{value}</p>
      <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function ConfettiBurst() {
  const bits = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bits.map((i) => (
        <span
          key={i}
          className="absolute top-0 h-2 w-2 rounded-sm bg-primary"
          style={{
            left: `${8 + ((i * 7) % 84)}%`,
            animation: `soldiers-confetti 900ms ease-out ${i * 40}ms both`,
            opacity: 0.85,
            transform: `rotate(${i * 24}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes soldiers-confetti {
          0% { transform: translateY(-8px) scale(1); opacity: 1; }
          100% { transform: translateY(140px) scale(0.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
