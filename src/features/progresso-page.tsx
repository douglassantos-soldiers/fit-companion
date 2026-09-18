import { Link } from "@tanstack/react-router";
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
import { ArrowDownRight, ArrowUpRight, Minus, Share2 } from "lucide-react";
import { AppShell, EmptyState } from "@/components/app-shell";
import { MetricRing } from "@/components/metric-ring";
import { ShareCardActions } from "@/components/progress/share-card";
import { Button } from "@/components/ui/button";
import { NumberTicker } from "@/components/ui/number-ticker";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import { exerciseById } from "@/data/exercises";
import { PRODUCTS } from "@/data/products";
import {
  exerciseLoadSeries,
  frequencyHeatmap,
  performanceDimensions,
  performanceScore,
  personalRecords,
  prsInCurrentWeek,
  streak,
  topExercisesBySessions,
  weekOverWeek,
  weeklyVolumeSeries,
} from "@/lib/engine/dimensions";
import { nutritionGoals, weeklyNutritionSeries } from "@/lib/engine/nutrition";
import { weeklySupplementAdherence } from "@/lib/engine/supplements";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const DIM_KEYS = [
  { key: "forca", label: "Força", color: "var(--chart-1)" },
  { key: "resistencia", label: "Resistência", color: "var(--chart-2)" },
  { key: "consistencia", label: "Consistência", color: "var(--chart-3)" },
  { key: "recuperacao", label: "Recuperação", color: "var(--chart-4)" },
  { key: "nutricao", label: "Nutrição", color: "var(--chart-5)" },
] as const;

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
  const [loadExId, setLoadExId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const latestSession = useMemo(() => {
    if (!state.sessions.length) return null;
    return [...state.sessions].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  }, [state.sessions]);

  if (!hydrated || !state.profile) {
    return (
      <AppShell title="Progresso">
        <div className="surface-glass h-40 animate-pulse" />
      </AppShell>
    );
  }

  const dims = performanceDimensions(state, state.profile);
  const score = performanceScore(dims);
  const volume = weeklyVolumeSeries(state.sessions);
  const records = personalRecords(state.sessions);
  const wow = weekOverWeek(state.sessions);
  const heat = frequencyHeatmap(state.sessions, 12);
  const weekPrs = prsInCurrentWeek(state.sessions);
  const topEx = topExercisesBySessions(state.sessions, 8);
  const selectedEx = loadExId && topEx.includes(loadExId) ? loadExId : (topEx[0] ?? null);
  const loadSeries = selectedEx ? exerciseLoadSeries(state.sessions, selectedEx) : [];
  const currentStreak = streak(state.sessions);

  const weightData = state.weights.map((w) => ({
    label: new Date(w.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    peso: w.weightKg,
  }));

  const dimSeries = state.dimensionSnapshots.map((snap) => ({
    label: new Date(snap.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    ...snap.scores,
  }));

  const goals = nutritionGoals(state.profile);
  const nutritionWeek = weeklyNutritionSeries(state.meals ?? []);
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

  const heatCols = 12;
  const heatByCol: (typeof heat)[] = Array.from({ length: heatCols }, () => []);
  heat.forEach((cell, i) => {
    const col = Math.floor(i / 7);
    if (col < heatCols) heatByCol[col]!.push(cell);
  });

  return (
    <AppShell title="Progresso" subtitle="Semana · força · corpo">
      {score < 40 ? (
        <section className="surface-glass mb-4 border-primary/30 p-5">
          <p className="eyebrow">Próxima ação</p>
          <h2 className="mt-1 text-display text-xl">Score baixo — feche o gap hoje</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Treine ou feche a proteína para subir consistência e nutrição.
          </p>
          <div className="mt-4 flex gap-2">
            <Link to="/treino" className="flex-1">
              <Button className="h-11 w-full font-bold uppercase tracking-wide">Treinar</Button>
            </Link>
            <Link to="/nutricao" className="flex-1">
              <Button variant="secondary" className="h-11 w-full font-bold uppercase tracking-wide">
                Proteína
              </Button>
            </Link>
          </div>
        </section>
      ) : null}

      {state.sessions.length === 0 ? (
        <EmptyState
          variant="progresso"
          title="Sem dados ainda"
          description="Complete sua primeira sessão para ver volume, heatmap e recordes."
          action={
            <Link to="/treino" className="block">
              <Button className="h-11 w-full font-bold uppercase tracking-wide">Iniciar treino</Button>
            </Link>
          }
        />
      ) : null}

      {/* Bloco 1 — Semana */}
      <section className="surface-glass relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-primary/20 blur-3xl" />
        <p className="eyebrow">Semana</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-display text-glow text-5xl leading-none text-primary">
              <NumberTicker value={score} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Score / 100 · streak {currentStreak}d</p>
          </div>
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
        <div>
          <p className="eyebrow">Força</p>
          <h2 className="mt-1 text-display text-2xl">Volume e carga</h2>
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
          <h3 className="text-sm font-semibold">Carga por exercício</h3>
          {topEx.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Complete séries em pelo menos dois treinos.</p>
          ) : (
            <>
              <select
                className="mt-3 w-full rounded-xl border border-white/10 bg-background/60 px-3 py-2 text-sm backdrop-blur"
                value={selectedEx ?? ""}
                onChange={(e) => setLoadExId(e.target.value)}
              >
                {topEx.map((id) => (
                  <option key={id} value={id}>
                    {exerciseById(id)?.name ?? id}
                  </option>
                ))}
              </select>
              {loadSeries.length > 1 ? (
                <div className="mt-4 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={loadSeries}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={chartTooltip} />
                      <Line
                        type="monotone"
                        dataKey="maxWeightKg"
                        name="Carga máx (kg)"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        dot
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Precisa de pelo menos 2 sessões deste exercício.</p>
              )}
            </>
          )}
        </div>

        <div className="border-t border-white/10 pt-4">
          <h3 className="text-sm font-semibold">PRs desta semana</h3>
          {weekPrs.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Bata um recorde de carga em qualquer exercício.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {weekPrs.map((r) => (
                <li key={r.exerciseId} className="flex justify-between text-sm">
                  <span>{exerciseById(r.exerciseId)?.name ?? r.exerciseId}</span>
                  <span className="text-display text-primary">
                    {r.weightKg} kg × {r.reps}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-white/10 pt-4">
          <h3 className="text-sm font-semibold">Recordes pessoais</h3>
          {records.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Conclua séries para registrar PRs.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {records.slice(0, 8).map((r) => (
                <li key={r.exerciseId} className="flex items-center justify-between text-sm">
                  <span>{exerciseById(r.exerciseId)?.name ?? r.exerciseId}</span>
                  <span className="text-display text-primary">
                    {r.weightKg} kg × {r.reps}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {latestSession ? (
          <Button className="h-11 w-full" variant="secondary" onClick={() => setShareOpen(true)}>
            <Share2 className="size-4" /> Compartilhar último treino
          </Button>
        ) : null}
      </section>

      {/* Bloco 3 — Corpo */}
      <section className="surface-glass mt-4 space-y-6 p-6">
        <div>
          <p className="eyebrow">Corpo</p>
          <h2 className="mt-1 text-display text-2xl">Dimensões e nutrição</h2>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {dims.map((d) => (
            <MetricRing key={d.key} value={d.score} max={100} label={d.label} size="lg" />
          ))}
        </div>

        {dimSeries.length > 1 ? (
          <div className="h-44 border-t border-white/10 pt-4">
            <p className="mb-2 text-sm font-semibold">Evolução</p>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={dimSeries}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {DIM_KEYS.map((d) => (
                  <Line key={d.key} type="monotone" dataKey={d.key} name={d.label} stroke={d.color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        <div className="border-t border-white/10 pt-4">
          <p className="text-sm font-semibold">Nutrição · 7 dias</p>
          <p className="text-xs text-muted-foreground">Meta {goals.proteinG} g proteína</p>
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

      {shareOpen && latestSession ? (
        <SoldiersOverlay
          open
          onClose={() => setShareOpen(false)}
          title="Share card"
          description="Baixe ou compartilhe a imagem do último treino"
        >
          <ShareCardActions
            athleteName={state.profile.name}
            session={latestSession}
            streak={currentStreak}
            score={score}
          />
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
