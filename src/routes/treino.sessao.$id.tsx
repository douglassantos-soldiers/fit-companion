import { Link, createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Camera, Check, PartyPopper, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import { ConfirmOverlay } from "@/components/confirm-overlay";
import { ShareCardPicker } from "@/components/progress/share-card";
import { ExerciseStage, type SessionEffortScale } from "@/components/session/exercise-stage";
import { ExerciseSwapPicker } from "@/components/training/exercise-swap-picker";
import { RestTimer } from "@/components/session/rest-timer";
import { fxExerciseDone, fxRestEnd, fxSetDone } from "@/components/session/session-fx";
import { SessionCelebration } from "@/components/today/engagement-cards";
import { alternativesFor, exerciseById } from "@/data/exercises";
import { matchesInventory } from "@/lib/training/inventory";
import { isQuestComplete, questById } from "@/data/daily-quests";
import { performanceDimensions, performanceScore, streak } from "@/lib/engine/dimensions";
import {
  buildExpressSession,
  sessionVolume,
  type PlannedExercise,
} from "@/lib/engine/plan";
import { learningWeekHint } from "@/lib/engine/learning";
import { decisionContextForUi } from "@/lib/engine/assemble-decision-context";
import {
  isTodayPlannedDay,
  todaySessionShouldBeExpress,
} from "@/lib/engine/decision-context-snapshot";
import { enrichSessionExercises } from "@/lib/training/session";
import { detectExercisePrs } from "@/lib/training/prs";
import {
  applyLoadDrop,
  suggestLoadDrop,
  type LoadDropSuggestion,
} from "@/lib/training/intra-session";
import { logsFromPlanned, setsFromPlanned, propagateSetToFollowing, nextWorkingSetFromLast } from "@/lib/training/session-logs";
import { resolveTrainingPlanDays } from "@/lib/training/resolve-plan-days";
import { scalePlannedDayVolume } from "@/lib/training/training-block";
import { parseRepTarget } from "@/lib/training/effort";
import { progressionForExercise, weekModifier, roundLoad } from "@/lib/engine/progression";
import { clearSupersetPair, nextAfterSetComplete, partnerIndex } from "@/lib/training/superset";
import { useSessionWakeLock } from "@/lib/session/wake-lock";
import { dailyXp, XP } from "@/lib/engine/xp";
import { brandLevel } from "@/lib/engine/brand-level";
import { pendingAchievements, achievementTitles } from "@/lib/engine/achievements";
import { prsAchievedInSession } from "@/lib/engine/period-review";
import { trackOutcome } from "@/lib/outcome";
import { emitUserEvent } from "@/lib/events/emit";
import { EVENT_TAXONOMY } from "@/lib/events/taxonomy";
import { listMyClubs, publishClubStory, uploadCheckinImage } from "@/lib/social";
import { getDeviceId } from "@/lib/sync";
import { SOLDIERS_BORDER, SOLDIERS_YELLOW } from "@/lib/ui-theme";
import { CoachNudgeOverlay } from "@/components/coach-nudge-overlay";
import { coachNudgeFromState } from "@/lib/engine/coach-nudge";
import { suggestPostWorkoutUpsell } from "@/data/shopify-product-map";
import { trackAppEvent } from "@/lib/shopify.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  todayKey,
  type ExerciseLog,
  type SessionLog,
  type SessionRpe,
  type SetLog,
} from "@/lib/types";
import { useStore } from "@/lib/store";
import { requestNotificationPermission } from "@/lib/notifications";
import { registerPushWorker, subscribePush } from "@/lib/push";
import { SESSION_LEAVE_BODY, SESSION_LEAVE_TITLE } from "@/lib/ui/platform-copy";

export const Route = createFileRoute("/treino/sessao/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    express: search["express"] === true || search["express"] === "true" ? true : false,
    from: search["from"] === "hoje" || search["from"] === "treino" ? search["from"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sessão de treino — Soldiers Training" },
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

const EFFORT_KEY = "soldiers_session_effort_scale";

function readEffortScale(): SessionEffortScale {
  if (typeof window === "undefined") return "rpe";
  return window.localStorage.getItem(EFFORT_KEY) === "rir" ? "rir" : "rpe";
}

function SessionPage() {
  const { id } = useParams({ from: "/treino/sessao/$id" });
  const { express: searchExpress, from } = Route.useSearch();
  const navigate = useNavigate();
  const {
    state,
    hydrated,
    addSession,
    markUpsellShown,
    setExercisePreference,
    dismissCoachNudge,
    markCoachNudgeShown,
    setRemindersEnabled,
  } = useStore();
  const track = useServerFn(trackAppEvent);
  const fxOn = state.sessionFx !== false;
  const decisionCtx = decisionContextForUi(state);
  const expressLock = useRef<boolean | null>(null);
  if (expressLock.current == null && state.profile) {
    const todaySession = isTodayPlannedDay(id, decisionCtx);
    const accepted = state.dayCheckIns?.[todayKey()]?.acceptedTrainingMode;
    expressLock.current = todaySession
      ? todaySessionShouldBeExpress({
          snapshot: decisionCtx,
          isTodaySession: true,
          ...(accepted ? { acceptedTrainingMode: accepted } : {}),
        })
      : searchExpress === true;
  }
  const express = expressLock.current ?? searchExpress === true;

  useEffect(() => {
    if (!hydrated || !id) return;
    const deviceId = getDeviceId();
    void track({
      data: {
        deviceId,
        kind: "workout_started",
        payload: { dayId: id, express: express === true },
        entityType: "workout",
        entityId: id,
        idempotencyKey: `workout:${id}:workout_started`,
      },
    }).catch(() => undefined);
    if (express) {
      void track({
        data: {
          deviceId,
          kind: "express_chosen",
          payload: { dayId: id },
          entityType: "workout",
          entityId: id,
        },
      }).catch(() => undefined);
    }
  }, [hydrated, id, express, track]);

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
  const [swapReason, setSwapReason] = useState<"swap" | "busy_machine">("swap");
  const [checkinFile, setCheckinFile] = useState<File | null>(null);
  const [ritualOpen, setRitualOpen] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [ritual, setRitual] = useState({
    xpGained: 0,
    xpTotal: 0,
    streak: 0,
    questsDone: 0,
    questsTotal: 0,
  });
  const [prBanner, setPrBanner] = useState<string | null>(null);
  const [nextHint, setNextHint] = useState<string | null>(null);
  const [effortScale, setEffortScale] = useState<SessionEffortScale>(readEffortScale);
  const [loadDrop, setLoadDrop] = useState<LoadDropSuggestion | null>(null);
  const [loadDropDismissed, setLoadDropDismissed] = useState<number[]>([]);
  const [finishUnlocked, setFinishUnlocked] = useState<string[]>([]);
  const [finishRank, setFinishRank] = useState<string | null>(null);
  const [pushPrompt, setPushPrompt] = useState(false);
  const [firstShare, setFirstShare] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const finishStatsRef = useRef<{ prCount: number; xp: number } | null>(null);

  useSessionWakeLock(!summaryOpen && !ritualOpen);

  const upsell =
    ritualOpen && state.upsellShownDate !== todayKey()
      ? suggestPostWorkoutUpsell(state.supplementRoutine)
      : null;
  const day = useMemo(() => {
    if (!state.profile) return null;
    const weekDays = resolveTrainingPlanDays(state);
    let base = weekDays.find((d) => d.id === id) ?? null;
    if (!base) return null;
    const decisionCtx = decisionContextForUi(state);
    const mode = decisionCtx?.decisions.trainingMode;
    const vol = decisionCtx?.decisions.trainingVolume ?? 1;
    if (
      state.activeTrainingBlock &&
      (mode === "deload" || (typeof vol === "number" && vol < 0.99))
    ) {
      base = scalePlannedDayVolume(base, vol, roundLoad);
    }
    return express ? buildExpressSession(base) : base;
  }, [state, id, express]);

  useEffect(() => {
    if (!day) return;
    setPlanned(day.exercises);
    setLogs(logsFromPlanned(day.exercises));
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
    ...(express ? { express: true as const } : {}),
  };
  const livePrs = prsAchievedInSession(
    draftSession,
    state.sessions.filter((s) => s.id !== draftSession.id),
  );
  const liveXp = (express ? XP.express : XP.session) + (livePrs.length ? XP.pr : 0);
  const previewRank = brandLevel({ ...state, sessions: [draftSession, ...state.sessions] });
  if (!summaryOpen) finishStatsRef.current = null;
  else if (!finishStatsRef.current)
    finishStatsRef.current = { prCount: livePrs.length, xp: liveXp };
  const previewXp = finishStatsRef.current?.xp ?? liveXp;
  const previewPrCount = finishStatsRef.current?.prCount ?? livePrs.length;
  const dims = performanceDimensions(state, profile);
  const score = performanceScore(dims);
  const currentStreak = streak(state.sessions, { freezeUsedDates: state.freezeUsedDates });

  const safeExIdx = Math.min(activeExIdx, Math.max(0, planned.length - 1));
  const activePlanned = planned[safeExIdx];
  const activeLog = logs[safeExIdx];
  const activeExercise = activePlanned ? exerciseById(activePlanned.exerciseId) : undefined;
  const currentSetIdx = activeLog?.sets.findIndex((s) => !s.done) ?? -1;
  const workingSetIdx =
    currentSetIdx >= 0 ? currentSetIdx : Math.max(0, (activeLog?.sets.length ?? 1) - 1);
  const workingSet = activeLog?.sets[workingSetIdx];

  const partnerIdx = partnerIndex(planned, safeExIdx);
  const partner = partnerIdx >= 0 ? planned[partnerIdx] : undefined;
  const partnerDone =
    partnerIdx >= 0 ? (logs[partnerIdx]?.sets.filter((s) => s.done).length ?? 0) : 0;
  const myDoneCount = activeLog?.sets.filter((s) => s.done).length ?? 0;
  const partnerPending = partnerIdx >= 0 && (logs[partnerIdx]?.sets.some((s) => !s.done) ?? false);
  const restAfterThisSet = !(partnerPending && partnerDone < myDoneCount + 1);

  const nextLabel = activePlanned
    ? `${activePlanned.name} · série ${workingSetIdx + 1}`
    : "Próxima série";

  const updateSet = (exIdx: number, setIdx: number, patch: Partial<SetLog>) =>
    setLogs((prev) =>
      prev.map((l, i) => {
        if (i !== exIdx) return l;
        return {
          ...l,
          sets: l.sets.map((s, j) => {
            if (j !== setIdx) return s;
            const next: SetLog = { ...s, ...patch };
            if ("rpe" in patch) {
              delete next.rir;
              if (patch.rpe == null) delete next.rpe;
            }
            if ("rir" in patch) {
              delete next.rpe;
              if (patch.rir == null) delete next.rir;
            }
            return next;
          }),
        };
      }),
    );

  const skipSet = () => {
    if (!activeLog || workingSetIdx < 0) return;
    const nextLogs = logs.map((l, i) =>
      i !== safeExIdx
        ? l
        : {
            ...l,
            sets: l.sets.map((s, j) =>
              j !== workingSetIdx ? s : { ...s, done: true, skipped: true },
            ),
          },
    );
    setLogs(nextLogs);
    const stillHere = nextLogs[safeExIdx]?.sets.some((s) => !s.done);
    if (stillHere) return;
    const restSec = activePlanned?.restSec ?? 60;
    const step = nextAfterSetComplete({ planned, logs: nextLogs, exIdx: safeExIdx, restSec });
    if (step.allDone) {
      setSummaryOpen(true);
      setSummaryBurst(true);
      return;
    }
    setActiveExIdx(step.nextExIdx);
  };

  const addSet = () => {
    setLogs((prev) =>
      prev.map((l, i) => {
        if (i !== safeExIdx) return l;
        return {
          ...l,
          sets: [
            ...l.sets,
            nextWorkingSetFromLast(l.sets, {
              reps: parseRepTarget(activePlanned?.reps ?? "10"),
              weightKg: activePlanned?.suggestedLoad ?? 0,
            }),
          ],
        };
      }),
    );
  };

  const swapExercise = (exIdx: number, newId: string, reason: "swap" | "busy_machine" = "swap") => {
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
    setPlanned((prev) => {
      const cleared = clearSupersetPair(prev, exIdx);
      return cleared.map((p, i) =>
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
              lastPerformance: prog.lastPerformance,
              reasonCodes: prog.reasonCodes,
              plateau: prog.plateau,
              ...(prog.evidence.estimated1rm != null
                ? { estimated1rm: prog.evidence.estimated1rm }
                : {}),
              ...(prog.evidence.lastLoad != null ? { bestWeight: prog.evidence.lastLoad } : {}),
            },
      );
    });
    const deviceId = getDeviceId();
    if (deviceId && id) {
      void track({
        data: {
          deviceId,
          kind: "workout_modified",
          payload: {
            dayId: id,
            fromExerciseId: current?.exerciseId,
            toExerciseId: newId,
            reason,
          },
          entityType: "workout",
          entityId: id,
        },
      }).catch(() => undefined);
      void trackOutcome(deviceId, "plan_modified", {
        fromExerciseId: current?.exerciseId,
        toExerciseId: newId,
        reason,
      }).catch(() => undefined);
    }
    setLogs((prev) =>
      prev.map((l, i) => {
        const dropPair = l.supersetGroupId && l.supersetGroupId === current?.supersetGroupId;
        if (i === exIdx) {
          return {
            exerciseId: alt.id,
            sets: setsFromPlanned({
              exerciseId: alt.id,
              name: alt.name,
              sets: alt.unit === "min" || alt.group === "cardio" ? 1 : prog.sets,
              reps: prog.reps,
              restSec: prog.restSec,
              suggestedLoad: prog.load,
              unit: alt.unit,
            }),
          };
        }
        if (!dropPair) return l;
        const { supersetGroupId: _omit, ...rest } = l;
        return rest;
      }),
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
      exercises: enrichSessionExercises(logs),
      volumeKg: volume,
      rpe,
      ...(express ? { express: true as const } : {}),
    };
    const firstWorkout = state.sessions.length === 0;
    addSession(session, imageUrl ? { imageUrl } : {});
    if (deviceId) {
      void track({
        data: {
          deviceId,
          kind: "workout_completed",
          payload: {
            sessionId: session.id,
            dayId: id,
            express: !!express,
            volumeKg: volume,
            lifetimeSessionCount: state.sessions.length + 1,
          },
          entityType: "workout",
          entityId: session.id,
          idempotencyKey: `workout:${session.id}:workout_completed`,
        },
      });
    }

    const xpGained = previewXp;
    const xpTotal = dailyXp(state) + xpGained;
    const nextSessions = [session, ...state.sessions];
    const nextState = {
      ...state,
      sessions: nextSessions,
      xpByDate: { ...state.xpByDate, [session.date.slice(0, 10)]: xpTotal },
    };
    const unlocked = pendingAchievements(nextState);
    setFinishUnlocked(unlocked);
    setFinishRank(brandLevel(nextState).label);
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
    setPushPrompt(firstWorkout && state.remindersEnabled !== true);
    setFirstShare(firstWorkout);
    toast.success(`Treino salvo · ${volume.toLocaleString("pt-BR")} kg de volume`);
    setSaving(false);
    const first = session.exercises.find((e) => e.sets.some((s) => s.done && !s.skipped));
    if (first) {
      const ex = exerciseById(first.exerciseId);
      if (ex) {
        const next = progressionForExercise(
          ex,
          0,
          first.sets.filter((s) => (s.type ?? "working") !== "warmup" && !s.skipped).length || 3,
          String(first.sets.find((s) => (s.type ?? "working") !== "warmup")?.reps ?? 8),
          first.sets[0]?.restSec ?? 90,
          profile.goal,
          [session, ...state.sessions],
          weekModifier([session, ...state.sessions], 7, learningWeekHint(state)),
        );
        setNextHint(
          next.load > 0
            ? `${ex.name}: próxima vez ${next.load} kg × ${next.reps}`
            : `${ex.name}: próxima vez ${next.sets}×${next.reps}`,
        );
      }
    }
  };

  const completeSet = () => {
    if (!activePlanned || !activeLog || !workingSet || workingSet.done) return;
    const exIdx = safeExIdx;
    const setIdx = workingSetIdx;
    const restSec = workingSet.restSec ?? activePlanned.restSec;
    const completedSnapshot = {
      weightKg: workingSet.weightKg,
      reps: workingSet.reps,
    };

    const nextLogs = logs.map((l, i) => {
      if (i !== exIdx) return l;
      const marked = l.sets.map((s, j) => (j !== setIdx ? s : { ...s, done: true, restSec }));
      return {
        ...l,
        sets: propagateSetToFollowing(marked, setIdx, completedSnapshot),
      };
    });
    setLogs(nextLogs);

    emitUserEvent({
      type: EVENT_TAXONOMY.SET_COMPLETED,
      entityType: "session",
      entityId: id,
      metadata: {
        dayId: id,
        exerciseId: activePlanned.exerciseId,
        setIndex: setIdx,
        weightKg: workingSet.weightKg,
        reps: workingSet.reps,
        ...(workingSet.rir != null ? { rir: workingSet.rir } : {}),
        ...(workingSet.rpe != null ? { rpe: workingSet.rpe } : {}),
      },
      idempotencyKey: `workout:${id}:set_completed:${activePlanned.exerciseId}:${setIdx}`,
    });

    const setsAfter = nextLogs[exIdx]!.sets;
    const exerciseDone = setsAfter.every((s) => s.done || s.skipped);
    const step = nextAfterSetComplete({
      planned,
      logs: nextLogs,
      exIdx,
      restSec,
    });

    fxSetDone(fxOn);
    setCelebrate(exerciseDone ? "exercise" : "set");
    if (exerciseDone) fxExerciseDone(fxOn);
    if (exerciseDone && activePlanned) {
      const draft: SessionLog = {
        id: `draft-${day.id}`,
        dayId: day.id,
        title: day.title,
        date: new Date().toISOString(),
        durationMin,
        exercises: nextLogs,
        volumeKg: volume,
      };
      const prs = detectExercisePrs(activePlanned.exerciseId, [draft, ...state.sessions]);
      const hit = prs.find((p) => p.sessionId === draft.id);
      if (hit) setPrBanner(hit.label);
    }

    if (!loadDropDismissed.includes(exIdx)) {
      const currentGroup = exerciseById(activePlanned.exerciseId)?.group ?? null;
      const nextPlanned = planned[exIdx + 1];
      const nextGroup = nextPlanned ? (exerciseById(nextPlanned.exerciseId)?.group ?? null) : null;
      const suggestion = suggestLoadDrop({
        logs: nextLogs,
        exerciseIndex: exIdx,
        completedSetIndex: setIdx,
        targetReps: activePlanned.reps,
        currentGroup,
        nextExerciseGroup: nextGroup,
      });
      if (suggestion) setLoadDrop(suggestion);
    }

    window.setTimeout(
      () => {
        if (step.allDone) {
          setSummaryOpen(true);
          setSummaryBurst(true);
          return;
        }
        setActiveExIdx(step.nextExIdx);
        if (step.openRest) {
          setRest({
            seconds: step.betweenExercises ? Math.min(restSec, 45) : restSec,
            paused: false,
          });
        }
      },
      exerciseDone ? 850 : 650,
    );
  };

  const openSummary = () => {
    setSummaryOpen(true);
    setSummaryBurst(true);
  };

  const swapOptions = activeLog
    ? alternativesFor(activeLog.exerciseId, profile.equipment, profile.restrictions, {
        preferences: state.exercisePreferences,
        preferPublishedMedia: true,
        preferNonMachine: swapReason === "busy_machine",
      }).filter((e) => matchesInventory(e, profile.equipment, profile.equipmentInventory))
    : [];

  const openSwap = (reason: "swap" | "busy_machine") => {
    setSwapReason(reason);
    setSwapOpen(true);
  };

  const goBack = () => {
    const hasProgress = logs.some((e) => e.sets.some((s) => s.done && !s.skipped));
    if (hasProgress && !ritualOpen) {
      setLeaveOpen(true);
      return;
    }
    navigate({ to: from === "hoje" ? "/" : "/treino" });
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-background/70 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center gap-3">
          <button type="button" onClick={goBack} aria-label="Voltar">
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
        {prBanner ? (
          <div className="mb-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
            {prBanner}
          </div>
        ) : null}
        {activePlanned && activeLog && workingSet ? (
          <ExerciseStage
            planned={activePlanned}
            exercise={activeExercise}
            setLog={workingSet}
            setIndex={workingSetIdx}
            totalSets={activeLog.sets.length}
            exIndex={safeExIdx}
            totalExercises={planned.length}
            preference={
              (state.likedExerciseIds ?? []).includes(activePlanned.exerciseId)
                ? "like"
                : (state.dislikedExerciseIds ?? []).includes(activePlanned.exerciseId)
                  ? "dislike"
                  : null
            }
            effortScale={effortScale}
            {...(partner?.name ? { partnerName: partner.name } : {})}
            restAfterThisSet={restAfterThisSet}
            onChangeSet={(patch) => updateSet(safeExIdx, workingSetIdx, patch)}
            onCompleteSet={completeSet}
            onSkipSet={skipSet}
            onAddSet={addSet}
            onRepeatLastSet={() => {
              if (!activeLog || workingSetIdx <= 0) return;
              const prev = [...activeLog.sets]
                .slice(0, workingSetIdx)
                .reverse()
                .find((s) => s.done && !s.skipped);
              if (!prev) return;
              updateSet(safeExIdx, workingSetIdx, {
                weightKg: prev.weightKg,
                reps: prev.reps,
                ...(prev.rir != null ? { rir: prev.rir } : {}),
                ...(prev.rpe != null ? { rpe: prev.rpe } : {}),
              });
            }}
            onSwap={() => openSwap("swap")}
            onBusyMachine={() => openSwap("busy_machine")}
            homeBar={
              profile.equipment === "casa" ||
              (profile.equipmentInventory?.length
                ? !profile.equipmentInventory.includes("barra")
                : false)
            }
            onPrevExercise={() => setActiveExIdx((i) => Math.max(0, i - 1))}
            onNextExercise={() => setActiveExIdx((i) => Math.min(planned.length - 1, i + 1))}
            onPreference={(pref) => setExercisePreference(activePlanned.exerciseId, pref)}
            onEffortScale={(scale) => {
              setEffortScale(scale);
              if (typeof window !== "undefined") window.localStorage.setItem(EFFORT_KEY, scale);
            }}
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
          <Button
            className="mt-4 h-12 w-full font-bold uppercase tracking-wide"
            onClick={openSummary}
          >
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
        title={swapReason === "busy_machine" ? "Máquina ocupada" : "Trocar exercício"}
        description={
          swapReason === "busy_machine"
            ? "Escolha uma alternativa clara com o mesmo estímulo — preview da demo quando disponível"
            : "Alternativas compatíveis com seu equipamento e restrições"
        }
      >
        <ExerciseSwapPicker
          options={swapOptions}
          onPick={(alt) => swapExercise(safeExIdx, alt.id, swapReason)}
        />
      </SoldiersOverlay>

      <SoldiersOverlay
        open={Boolean(loadDrop)}
        onClose={() => {
          if (loadDrop) setLoadDropDismissed((d) => [...d, loadDrop.exerciseIndex]);
          setLoadDrop(null);
        }}
        title="Reduzir carga?"
        description="Seu desempenho caiu nesta série. Podemos reduzir a carga para manter a qualidade."
      >
        {loadDrop ? (
          <div className="space-y-3">
            <p className="text-sm">
              Sugerido: {loadDrop.fromKg} kg →{" "}
              <span className="font-semibold text-primary">{loadDrop.toKg} kg</span>
            </p>
            <Button
              className="h-11 w-full"
              onClick={() => {
                setLogs((prev) => applyLoadDrop(prev, loadDrop));
                setLoadDropDismissed((d) => [...d, loadDrop.exerciseIndex]);
                const deviceId = getDeviceId();
                if (deviceId) {
                  void trackOutcome(deviceId, "plan_modified", {
                    fromKg: loadDrop.fromKg,
                    toKg: loadDrop.toKg,
                    reason: loadDrop.reason,
                  });
                }
                setLoadDrop(null);
                toast.success(`Carga ajustada para ${loadDrop.toKg} kg`);
              }}
            >
              Aceitar
            </Button>
            <Button
              variant="secondary"
              className="h-11 w-full"
              onClick={() => {
                setLoadDropDismissed((d) => [...d, loadDrop.exerciseIndex]);
                setLoadDrop(null);
              }}
            >
              Manter
            </Button>
            <Button
              variant="secondary"
              className="h-11 w-full"
              onClick={() => {
                setLoadDropDismissed((d) => [...d, loadDrop.exerciseIndex]);
                setActiveExIdx(loadDrop.exerciseIndex);
                setLoadDrop(null);
                toast.message("Ajuste o kg na próxima série");
              }}
            >
              Modificar
            </Button>
          </div>
        ) : null}
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
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <SummaryStat label="PRs" value={`${previewPrCount}`} />
          <SummaryStat label="XP" value={`+${previewXp}`} />
        </div>
        {previewRank ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {previewRank.label} · Nv. {previewRank.level}
          </p>
        ) : null}
        {finishUnlocked.length ? (
          <p className="mt-1 text-center text-xs font-semibold text-primary">
            {achievementTitles(finishUnlocked).join(" · ")}
          </p>
        ) : null}

        {sharePanel ? (
          <div className="mt-4">
            <ShareCardPicker
              state={state}
              session={draftSession}
              score={score}
              xp={previewXp}
              prCount={previewPrCount}
              {...(previewRank ? { rankLabel: previewRank.label } : {})}
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
            <Link to="/progresso" className="mt-2 block">
              <Button variant="secondary" className="h-11 w-full">
                Ver meu progresso
              </Button>
            </Link>
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
                <ToggleButton
                  key={opt.id}
                  value={opt.id}
                  className="flex flex-col gap-0.5 py-3 normal-case"
                >
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
          const nudge = coachNudgeFromState(state);
          if (nudge.show) {
            setNudgeOpen(true);
            markCoachNudgeShown();
            return;
          }
          navigate({ to: from === "treino" ? "/treino" : "/" });
        }}
        xpGained={ritual.xpGained}
        xpTotal={ritual.xpTotal}
        streak={ritual.streak}
        questsDone={ritual.questsDone}
        questsTotal={ritual.questsTotal}
        nextHint={nextHint}
        unlocked={achievementTitles(finishUnlocked)}
        rankLabel={finishRank}
        upsell={upsell}
        onUpsellClick={() => {
          markUpsellShown();
          const deviceId = getDeviceId();
          if (deviceId && upsell) {
            void track({
              data: {
                deviceId,
                kind: "restock_clicked",
                payload: { source: "post_workout", productId: upsell.productId },
                entityType: "product",
                entityId: upsell.productId,
              },
            });
            void track({
              data: {
                deviceId,
                kind: "product_clicked",
                payload: { source: "post_workout", productId: upsell.productId },
                entityType: "product",
                entityId: upsell.productId,
              },
            });
          }
        }}
        onUpsellDismiss={() => markUpsellShown()}
        pushPrompt={pushPrompt}
        onEnablePush={() => {
          void requestNotificationPermission().then((perm) => {
            if (perm === "granted") {
              setRemindersEnabled(true);
              void registerPushWorker().then(() => subscribePush());
              setPushPrompt(false);
              toast.success("Lembrete ligado");
            } else if (perm === "unsupported") {
              toast.error("Notificações não suportadas neste aparelho");
            } else {
              toast.error("Permissão de notificação negada");
            }
          });
        }}
        onDismissPush={() => setPushPrompt(false)}
        shareFirst={firstShare}
        onShareFirst={() => {
          setFirstShare(false);
          setSharePanel(true);
        }}
      />
      <CoachNudgeOverlay
        open={nudgeOpen}
        volumeDeltaPct={coachNudgeFromState(state).volumeDeltaPct}
        onClose={() => {
          setNudgeOpen(false);
          dismissCoachNudge();
          navigate({ to: from === "treino" ? "/treino" : "/" });
        }}
      />
      <ConfirmOverlay
        open={leaveOpen}
        title={SESSION_LEAVE_TITLE}
        description={SESSION_LEAVE_BODY}
        confirmLabel="Sair mesmo assim"
        cancelLabel="Continuar treino"
        destructive
        onClose={() => setLeaveOpen(false)}
        onConfirm={() => navigate({ to: from === "hoje" ? "/" : "/treino" })}
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
