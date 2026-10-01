import { ArrowDownRight, ArrowUpRight, Minus, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { AppShell, EmptyState } from "@/components/app-shell";
import { MetricRing } from "@/components/metric-ring";
import { PeriodShareCard, ShareCardPicker } from "@/components/progress/share-card";
import { ProofCard } from "@/components/social/proof-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NumberTicker } from "@/components/ui/number-ticker";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import { formatDateKeyPtBr, formatDayMonth } from "@/lib/format/date-pt";
import { exerciseById } from "@/data/exercises";
import { PRODUCTS } from "@/data/products";
import { seedCoachQuestion } from "@/lib/coach/seed";
import { decisionContextForUi } from "@/lib/engine/assemble-decision-context";
import { selectPrimaryAction } from "@/lib/engine/decision-context-snapshot";
import {
  adherenceScore,
  frequencyHeatmap,
  performanceDimensions,
  performanceScore,
  primaryBlockerDimension,
  prsInCurrentWeek,
  streak,
  weekOverWeek,
  weeklyVolumeSeries,
} from "@/lib/engine/dimensions";
import {
  listExercisesWithHistory,
  type ExerciseHistorySummary,
} from "@/lib/engine/exercise-history";
import { best1RM } from "@/lib/training/one-rm";
import { hitsForExercise } from "@/lib/engine/exercise-history";
import { currentPersonalRecords } from "@/lib/training/prs";
import { computeMuscleLoad } from "@/lib/training/muscle-load";
import { computeStrengthScore } from "@/lib/training/strength-score";
import { buildProofOfPerformance } from "@/lib/engine/proof-of-performance";
import { livingPlanForDate } from "@/lib/engine/living-plan";
import { nutritionGoals, weeklyNutritionSeries } from "@/lib/engine/nutrition";
import { weeklySupplementAdherence } from "@/lib/engine/supplements";
import { publishProofEvent } from "@/lib/social";
import { shouldPublishEvent } from "@/lib/social/visibility";
import { PeriodReviewCard } from "@/components/progress/period-review-card";
import { periodReview } from "@/lib/engine/period-review";
import {
  goalProgressCard,
  resolveProgressNextAction,
  weightDeltaRecent,
} from "@/lib/progress/next-action";
import { datesForPose } from "@/lib/progress/body";
import { useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";
import { todayKey, type TrafficLight } from "@/lib/types";
import { cn } from "@/lib/utils";

const PERF_DIM_KEYS = [
  { key: "forca", label: "Treinamento", color: "var(--chart-1)" },
  { key: "resistencia", label: "Condicionamento", color: "var(--chart-2)" },
  { key: "consistencia", label: "Consistência", color: "var(--chart-3)" },
  { key: "recuperacao", label: "Recuperação", color: "var(--chart-4)" },
  { key: "sono", label: "Sono", color: "var(--chart-5)" },
] as const;

const ADHERE_DIM_KEYS = [
  { key: "nutricao", label: "Nutrição", color: "var(--chart-1)" },
  { key: "suplementacao", label: "Suplementos", color: "var(--chart-2)" },
  { key: "habitos", label: "Hábitos", color: "var(--chart-3)" },
] as const;

const TRAFFIC_LABEL: Record<TrafficLight, string> = {
  green: "verde",
  yellow: "âmbar",
  red: "vermelho",
};

const HEAT_LEVEL: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-muted",
  1: "bg-primary/25",
  2: "bg-primary/45",
  3: "bg-primary/70",
  4: "bg-primary",
};

const chartTooltip = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--foreground)",
};

export function ProgressPage() {
  const { state, hydrated } = useStore();
  const [historyExId, setHistoryExId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [proofSharing, setProofSharing] = useState(false);

  const latestSession = useMemo(() => {
    if (!state.sessions.length) return null;
    return [...state.sessions].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  }, [state.sessions]);

  const proof = useMemo(() => buildProofOfPerformance(state, 21), [state]);
  const exerciseHistory = useMemo(
    () => listExercisesWithHistory(state.sessions, 20),
    [state.sessions],
  );
  const typedPrs = useMemo(() => currentPersonalRecords(state.sessions).slice(0, 8), [state.sessions]);
  const muscleLoads = useMemo(
    () => computeMuscleLoad(state.sessions).filter((m) => m.muscle !== "cardio"),
    [state.sessions],
  );

  const progressDerived = useMemo(() => {
    if (!state.profile) return null;
    const dims = performanceDimensions(state, state.profile);
    const score = performanceScore(dims);
    const adhere = adherenceScore(dims);
    const blocker = primaryBlockerDimension(state, state.profile);
    const strength = computeStrengthScore(state.sessions, state.profile);
    const volume = weeklyVolumeSeries(state.sessions);
    const wow = weekOverWeek(state.sessions);
    const heat = frequencyHeatmap(state.sessions, 12);
    const weekPrs = prsInCurrentWeek(state.sessions);
    const weekReview = periodReview(state, "week");
    const living = livingPlanForDate(state);
    const decisionCtx = decisionContextForUi(state, todayKey());
    const livingPrimary = decisionCtx ? selectPrimaryAction(decisionCtx) : null;
    const currentStreak = streak(state.sessions);
    return {
      dims,
      score,
      adhere,
      blocker,
      strength,
      volume,
      wow,
      heat,
      weekPrs,
      weekReview,
      living,
      decisionCtx,
      livingPrimary,
      currentStreak,
    };
  }, [state]);

  if (!hydrated || !state.profile || !progressDerived) {
    return (
      <AppShell title="Progresso">
        <div className="surface-glass h-40 animate-pulse" />
      </AppShell>
    );
  }

  const {
    dims,
    score,
    adhere,
    blocker,
    strength,
    volume,
    wow,
    heat,
    weekPrs,
    weekReview,
    living,
    decisionCtx,
    livingPrimary,
    currentStreak,
  } = progressDerived;
  const dow = new Date().getDay();
  const isRitualDay = dow === 0 || dow === 1 || weekReview.isSundayRitual;
  const hasComparePose = (["front", "side", "back"] as const).some(
    (pose) => datesForPose(state.progressPhotos ?? [], pose).length >= 2,
  );
  const nextAction = resolveProgressNextAction({
    blocker,
    livingPrimary,
    coachLine: weekReview.coachLine,
    score,
    hasBodyPhotos: hasComparePose || (state.progressPhotos?.length ?? 0) > 0,
    isRitualDay,
  });
  const selectedHistory: ExerciseHistorySummary | null =
    exerciseHistory.find((h) => h.exerciseId === historyExId) ?? exerciseHistory[0] ?? null;
  const historyChart =
    selectedHistory?.hits
      .slice(0, 12)
      .reverse()
      .map((h) => ({
        label: formatDateKeyPtBr(h.date),
        carga: h.maxWeightKg,
        volume: h.volumeKg,
        reps: h.avgReps,
      })) ?? [];

  const weightData = state.weights.map((w) => ({
    label: formatDayMonth(w.date),
    peso: w.weightKg,
  }));

  const dimSeries = state.dimensionSnapshots.map((snap) => ({
    label: new Date(snap.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    ...snap.scores,
  }));

  const goals = nutritionGoals(state.profile);
  const nutritionWeek = weeklyNutritionSeries(state.meals ?? []);
  const proteinHitDays = nutritionWeek.filter((d) => d.proteinG >= goals.proteinG * 0.9).length;
  const sleepVals = Object.values(state.dayCheckIns ?? {})
    .map((c) => c.sleepHours)
    .filter((h): h is number => typeof h === "number");
  const sleepAvg7d =
    sleepVals.length > 0
      ? sleepVals.slice(-7).reduce((s, h) => s + h, 0) / Math.min(7, sleepVals.length)
      : null;
  const goalCard = goalProgressCard({
    goal: state.profile.goal,
    weightDelta7d: weightDeltaRecent(state.weights, 14),
    strengthDelta28d: strength.delta28d,
    prCountWeek: weekPrs.length,
    proteinHitDays7d: proteinHitDays,
    sleepAvg7d,
  });
  const recoveryTraffic = living?.traffic.recovery ?? null;
  const routineIds = state.supplementRoutine.length
    ? state.supplementRoutine
    : PRODUCTS.filter((p) => p.goals.includes(state.profile!.goal))
        .slice(0, 3)
        .map((p) => p.id);
  const suppWeek = weeklySupplementAdherence(state.supplementLogs, routineIds);
  const nutritionChart = nutritionWeek.map((n, i) => ({
    ...n,
    aderencia: suppWeek[i]?.pct ?? 0,
  }));
  const perfDims = dims.filter((d) => PERF_DIM_KEYS.some((k) => k.key === d.key));
  const adhereDims = dims.filter((d) => ADHERE_DIM_KEYS.some((k) => k.key === d.key));

  const heatCols = 12;
  const heatByCol: (typeof heat)[] = Array.from({ length: heatCols }, () => []);
  heat.forEach((cell, i) => {
    const col = Math.floor(i / 7);
    if (col < heatCols) heatByCol[col]!.push(cell);
  });

  if (state.sessions.length === 0) {
    const lastWeight = state.weights[state.weights.length - 1];
    return (
      <AppShell title="Progresso" subtitle="Semana · força · corpo">
        <ProofCard className="mb-4" proof={proof} name={state.profile.name} empty />
        {lastWeight ? (
          <p className="mb-3 rounded-xl border border-white/10 px-3 py-2 text-sm">
            Peso atual {lastWeight.weightKg} kg — registre de novo em Hoje; circunferências em Corpo.
          </p>
        ) : (
          <p className="mb-3 text-sm text-muted-foreground">
            Peso em Hoje · medidas e fotos em Progresso/Corpo.
          </p>
        )}
        <EmptyState
          variant="progresso"
          title="Seu 1º treino destrava o progresso"
          description="Volume, heatmap e recordes aparecem depois da primeira sessão salva."
          action={
            <Link to="/treino" className="block">
              <Button className="h-11 w-full font-bold uppercase tracking-wide">Iniciar treino</Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Progresso" subtitle="Semana · força · corpo">
      <section className="surface-glass mb-4 border-primary/30 p-5">
        <p className="eyebrow">Próxima ação</p>
        <h2 className="mt-1 text-display text-xl">{nextAction.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{nextAction.reason}</p>
        <Link
          to={nextAction.to}
          {...(nextAction.search ? { search: nextAction.search as never } : {})}
          className="mt-4 block"
        >
          <Button className="h-11 w-full font-bold uppercase tracking-wide">
            {nextAction.ctaLabel}
          </Button>
        </Link>
      </section>

      {isRitualDay ? (
        <section className="surface-glass mb-4 space-y-3 p-4">
          <p className="eyebrow">{weekReview.isSundayRitual ? "Ritual de domingo" : "Revisão da semana"}</p>
          <h2 className="text-display text-xl">{weekReview.label}</h2>
          {weekReview.wins.length ? (
            <ul className="space-y-0.5 text-xs text-primary">
              {weekReview.wins.slice(0, 3).map((w) => (
                <li key={w}>· {w}</li>
              ))}
            </ul>
          ) : null}
          {weekReview.nextBlock && weekReview.nextBlock.days.length > 0 ? (
            <div className="rounded-xl border border-white/10 px-3 py-2">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                {weekReview.nextBlock.label}
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {weekReview.nextBlock.days.slice(0, 3).map((d) => (
                  <li key={d.title}>
                    {d.title} · {d.exerciseCount} ex.
                  </li>
                ))}
              </ul>
              <Link to="/treino" className="mt-2 inline-block text-xs font-semibold text-primary">
                Ver treino →
              </Link>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link to="/progresso/corpo">
              <Button size="sm" variant="secondary">
                {hasComparePose ? "Ver antes/agora" : "Registrar corpo"}
              </Button>
            </Link>
            <Link to="/progresso/resumo" search={{ period: "week" }}>
              <Button size="sm" variant="outline">
                Resumo completo
              </Button>
            </Link>
          </div>
          <PeriodShareCard
            athleteName={state.profile.name}
            title={weekReview.label}
            sessions={weekReview.sessions}
            volumeKg={weekReview.volumeKg}
            prCount={weekReview.prCount}
            consistencyPct={weekReview.consistencyPct}
          />
        </section>
      ) : null}

      {!isRitualDay ? <PeriodReviewCard review={weekReview} /> : null}
      <p className="mb-3 text-right">
        <Link
          to="/progresso/resumo"
          search={{ period: "month" }}
          className="text-xs font-semibold text-primary"
        >
          Ver resumo do mês →
        </Link>
      </p>

      <section className="surface-glass mb-4 p-4">
        <p className="eyebrow">Objetivo</p>
        <h2 className="mt-1 text-display text-lg">{goalCard.title}</h2>
        <p className="mt-1 text-sm text-foreground">{goalCard.line}</p>
        <p className="mt-1 text-xs text-muted-foreground">{goalCard.hint}</p>
      </section>

      <ProofCard
        className="mb-4"
        proof={proof}
        name={state.profile.name}
        sharing={proofSharing}
        state={state}
        onShare={() => {
          if (!shouldPublishEvent(state.socialPrivacy, "proof", { cardKind: "pr" })) {
            toast.error("Ative PRs visíveis no Perfil para compartilhar");
            return;
          }
          setProofSharing(true);
          void publishProofEvent(getDeviceId(), state.profile!.name, {
            title: "Prova de desempenho",
            narrative: proof.narrative,
            scoreDelta: proof.scoreDelta,
            volumeDeltaPct: proof.volumeDeltaPct,
            periodDays: proof.periodDays,
            proofStatus: proof.status,
            proofSource: proof.source,
          })
            .then(() => toast.success("Prova publicada no feed"))
            .catch(() => toast.error("Não foi possível publicar"))
            .finally(() => setProofSharing(false));
        }}
      />

      <section className="surface-glass relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-primary/20 blur-3xl" />
        <p className="eyebrow">Semana</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-display text-glow text-5xl leading-none text-primary">
              <NumberTicker value={score} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Score / 100 · streak {currentStreak}d</p>
          </div>
          <MetricRing value={score} max={100} label="Score" size="lg" />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <WowStat
            label="Volume"
            value={`${wow.thisWeek.volume.toLocaleString("pt-BR")} kg`}
            delta={
              wow.volumeDeltaPct == null
                ? null
                : `${wow.volumeDeltaPct > 0 ? "+" : ""}${wow.volumeDeltaPct}%`
            }
            up={wow.volumeDeltaPct != null ? wow.volumeDeltaPct >= 0 : null}
          />
          <WowStat
            label="Treinos"
            value={`${wow.thisWeek.treinos}`}
            delta={wow.treinosDelta === 0 ? "0" : `${wow.treinosDelta > 0 ? "+" : ""}${wow.treinosDelta}`}
            up={wow.treinosDelta >= 0}
          />
          <WowStat
            label="Anterior"
            value={`${wow.prevWeek.volume.toLocaleString("pt-BR")} kg`}
            delta={`${wow.prevWeek.treinos} treinos`}
            up={null}
          />
        </div>

        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="text-sm font-semibold">Frequência · 12 semanas</p>
          <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
            {heatByCol.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-1">
                {col.map((cell) => (
                  <div
                    key={cell.date}
                    title={`${cell.date}: ${cell.count} treino(s) · ${cell.volumeKg} kg`}
                    className={cn("size-2.5 rounded-sm sm:size-3", HEAT_LEVEL[cell.level])}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bloco 2 — Força */}
      <section className="surface-glass mt-4 space-y-6 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Força</p>
            <h2 className="mt-1 text-display text-2xl">Strength Score</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {strength.coldStart
                ? "Estimativa inicial — registre compounds para afiná-lo"
                : `${strength.evidenceCount} lifts · 1RM / peso corporal`}
            </p>
          </div>
          <div className="text-right">
            <MetricRing value={strength.score} max={100} label="Força" size="md" />
            {strength.delta28d != null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {strength.delta28d > 0 ? "+" : ""}
                {strength.delta28d} em 28d
              </p>
            ) : null}
          </div>
        </div>
        {strength.lifts.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {strength.lifts.map((lift) => (
              <li
                key={lift.exerciseId}
                className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-semibold">{lift.name}</span>
                  <span className="mt-0.5 block text-[0.65rem] uppercase text-muted-foreground">
                    {lift.pillar} · {lift.relativeBw}× BW
                  </span>
                </span>
                <span className="text-display text-primary">{lift.score}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div>
          <h3 className="text-sm font-semibold">Volume e carga</h3>
        </div>

        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volume}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} />
              <Tooltip contentStyle={chartTooltip} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="volume" name="Volume kg" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="treinos" name="Treinos" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border-t border-white/10 pt-4">
          <h3 className="text-sm font-semibold">Histórico por exercício</h3>
          {exerciseHistory.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Complete séries em pelo menos um treino para ver o histórico.
            </p>
          ) : (
            <>
              <select
                className="mt-3 w-full rounded-xl border border-white/10 bg-background/60 px-3 py-2 text-sm backdrop-blur"
                value={selectedHistory?.exerciseId ?? ""}
                onChange={(e) => setHistoryExId(e.target.value)}
              >
                {exerciseHistory.map((h) => (
                  <option key={h.exerciseId} value={h.exerciseId}>
                    {h.name}
                    {h.plateau ? " · plateau" : ""}
                    {h.trend === "up" ? " · ↑" : h.trend === "down" ? " · ↓" : ""}
                  </option>
                ))}
              </select>

              {selectedHistory ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">
                    PR {selectedHistory.prWeightKg} kg × {selectedHistory.prReps}
                  </Badge>
                  {(() => {
                    const orm = best1RM(hitsForExercise(selectedHistory.exerciseId, state.sessions));
                    return orm ? (
                      <Badge variant="outline" className="text-xs">
                        1RM est. {orm.value} kg
                      </Badge>
                    ) : null;
                  })()}
                  <Badge variant="outline" className="text-xs capitalize">
                    tendência {selectedHistory.trend === "unknown" ? "—" : selectedHistory.trend}
                  </Badge>
                  {selectedHistory.plateau ? (
                    <Link
                      to="/coach"
                      onClick={() =>
                        seedCoachQuestion(
                          `Estou em plateau em ${selectedHistory.name}. Como ajustar a progressão sem forçar carga?`,
                        )
                      }
                    >
                      <Badge
                        variant="outline"
                        className="border-chart-4/50 text-xs text-chart-4 hover:bg-chart-4/10"
                      >
                        Plateau · pedir ajuste no Coach
                      </Badge>
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {historyChart.length > 1 ? (
                <div className="mt-4 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyChart}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={chartTooltip} />
                      <Line
                        type="monotone"
                        dataKey="carga"
                        name="Carga máx (kg)"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        dot
                      />
                      <Line
                        type="monotone"
                        dataKey="volume"
                        name="Volume"
                        stroke="var(--chart-2)"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Precisa de pelo menos 2 sessões deste exercício.
                </p>
              )}

              {selectedHistory && selectedHistory.hits.length > 0 ? (
                <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full min-w-[320px] text-left text-xs">
                    <thead className="border-b border-white/10 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Data</th>
                        <th className="px-3 py-2 font-medium">Carga</th>
                        <th className="px-3 py-2 font-medium">Reps</th>
                        <th className="px-3 py-2 font-medium">Volume</th>
                        <th className="px-3 py-2 font-medium">RPE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedHistory.hits.slice(0, 8).map((h) => (
                        <tr key={h.sessionId + h.date} className="border-b border-white/5 last:border-0">
                          <td className="px-3 py-2">
                            {new Date(h.date + "T12:00:00").toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                            })}
                          </td>
                          <td className="px-3 py-2 text-display text-primary">{h.maxWeightKg || "—"}</td>
                          <td className="px-3 py-2">{h.avgReps}</td>
                          <td className="px-3 py-2">{h.volumeKg}</td>
                          <td className="px-3 py-2 capitalize text-muted-foreground">{h.rpe ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="border-t border-white/10 pt-4">
          <h3 className="text-sm font-semibold">PRs</h3>
          {weekPrs.length === 0 && typedPrs.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Bata cargas e volumes para registrar PRs tipados e da semana.
            </p>
          ) : (
            <div className="mt-2 space-y-3">
              {weekPrs.length > 0 ? (
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                    Esta semana
                  </p>
                  <ul className="mt-1 space-y-1.5">
                    {weekPrs.map((r) => (
                      <li key={r.exerciseId} className="flex justify-between text-sm">
                        <span>{exerciseById(r.exerciseId)?.name ?? r.exerciseId}</span>
                        <span className="text-display text-primary">
                          {r.weightKg} kg × {r.reps}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {typedPrs.length > 0 ? (
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    Tipados recentes
                  </p>
                  <ul className="mt-1 space-y-1.5">
                    {typedPrs.map((pr) => (
                      <li key={pr.id} className="text-sm text-muted-foreground">
                        <span className="text-foreground">{pr.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 pt-4">
          <h3 className="text-sm font-semibold">Carga muscular · 7d</h3>
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {muscleLoads.map((m) => (
              <li key={m.muscle} className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
                <p className="font-semibold capitalize">{m.muscle}</p>
                <p className="text-muted-foreground">
                  {m.rolling_7d} sets · {m.load_trend}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {latestSession ? (
          <Button className="h-11 w-full" variant="secondary" onClick={() => setShareOpen(true)}>
            <Share2 className="size-4" /> Compartilhar card
          </Button>
        ) : null}
      </section>

      {/* Bloco 3 — Corpo */}
      <section className="surface-glass mt-4 space-y-6 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Corpo</p>
            <h2 className="mt-1 text-display text-2xl">Dimensões e nutrição</h2>
          </div>
          <Link to="/progresso/corpo">
            <Button size="sm" variant="secondary">
              {hasComparePose ? "Antes/agora" : "Registrar"}
            </Button>
          </Link>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Performance</p>
            <span className="text-display text-primary">{score}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {perfDims.map((d) => (
              <div key={d.key} className="relative">
                <MetricRing value={d.score} max={100} label={d.label} size="lg" />
                {d.key === "recuperacao" && recoveryTraffic ? (
                  <p
                    className={cn(
                      "mt-1 text-center text-[0.6rem] font-semibold uppercase tracking-wide",
                      recoveryTraffic === "green" && "text-primary",
                      recoveryTraffic === "yellow" && "text-chart-4",
                      recoveryTraffic === "red" && "text-destructive",
                    )}
                  >
                    Plano {TRAFFIC_LABEL[recoveryTraffic] ?? recoveryTraffic}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Aderência</p>
            <span className="text-display text-primary">{adhere}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {adhereDims.map((d) => (
              <MetricRing key={d.key} value={d.score} max={100} label={d.label} size="lg" />
            ))}
          </div>
        </div>

        {dimSeries.length > 1 ? (
          <div className="h-44 border-t border-white/10 pt-4">
            <p className="mb-2 text-sm font-semibold">Evolução · performance</p>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={dimSeries}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {PERF_DIM_KEYS.map((d) => (
                  <Line key={d.key} type="monotone" dataKey={d.key} name={d.label} stroke={d.color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        <div className="border-t border-white/10 pt-4">
          <p className="text-sm font-semibold">Nutrição · 7 dias</p>
          <p className="text-xs text-muted-foreground">
            Meta {goals.proteinG} g · hit {proteinHitDays}/7d
          </p>
          <div className="mt-3 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nutritionChart}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="proteinG" name="Proteína" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="meals" name="Refeições" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="aderencia" name="Suplementos %" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="text-sm font-semibold">Peso</p>
          <Link to="/progresso/corpo" className="mt-1 inline-block text-xs font-semibold text-primary">
            Medidas e fotos →
          </Link>
          {weightData.length > 1 ? (
            <div className="mt-3 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weightData}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={chartTooltip} />
                  <Area dataKey="peso" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Registre seu peso na tela Hoje por alguns dias para ver a curva.
            </p>
          )}
        </div>
      </section>

      {shareOpen ? (
        <SoldiersOverlay
          open
          onClose={() => setShareOpen(false)}
          title="Share card"
          description="Treino, PR, streak, desafio ou evolução — publicar no feed é opcional"
        >
          <ShareCardPicker state={state} session={latestSession} score={score} />
        </SoldiersOverlay>
      ) : null}
    </AppShell>
  );
}

function WowStat({
  label,
  value,
  delta,
  up,
}: {
  label: string;
  value: string;
  delta: string | null;
  up: boolean | null;
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-display text-lg">{value}</p>
      {delta != null ? (
        <p
          className={cn(
            "mt-1 flex items-center gap-0.5 text-xs",
            up === true && "text-primary",
            up === false && "text-destructive",
            up === null && "text-muted-foreground",
          )}
        >
          {up === true ? <ArrowUpRight className="size-3.5" /> : null}
          {up === false ? <ArrowDownRight className="size-3.5" /> : null}
          {up === null ? <Minus className="size-3.5" /> : null}
          {delta}
        </p>
      ) : null}
    </div>
  );
}
