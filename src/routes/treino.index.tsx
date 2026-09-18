import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronRight, History, Play } from "lucide-react";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildWeeklyPlanDetailed } from "@/lib/engine/plan";
import { learningWeekHint } from "@/lib/engine/learning";
import { WEEK_MODE_LABEL } from "@/lib/engine/progression";
import { muscleRecoveryMap, recoveryLabel } from "@/lib/engine/recovery";
import { useStore } from "@/lib/store";
import { GOAL_LABEL, type Equipment } from "@/lib/types";

export const Route = createFileRoute("/treino/")({
  head: () => ({
    meta: [
      { title: "Treino — Soldiers Training" },
      {
        name: "description",
        content: "Plano semanal gerado pelo seu perfil, com séries, repetições e progressão de carga.",
      },
      { property: "og:title", content: "Seu plano de treino" },
      { property: "og:description", content: "Divisão semanal, cargas sugeridas e histórico de sessões." },
    ],
  }),
  component: TrainingPage,
});

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function TrainingPage() {
  const { state, hydrated } = useStore();
  const [equipOverride, setEquipOverride] = useState<Equipment | null>(null);

  const planResult = useMemo(() => {
    if (!state.profile) return null;
    return buildWeeklyPlanDetailed(
      state.profile,
      state.sessions,
      equipOverride ?? undefined,
      learningWeekHint(state),
    );
  }, [state, equipOverride]);

  const recovery = useMemo(() => muscleRecoveryMap(state.sessions), [state.sessions]);

  if (!hydrated || !state.profile || !planResult) {
    return (
      <AppShell title="Treino">
        <div className="surface-card h-40 animate-pulse" />
      </AppShell>
    );
  }

  const profile = state.profile;
  const { days: plan, weekMode } = planResult;
  const activeEquip = equipOverride ?? profile.equipment;

  return (
    <AppShell
      title="Seu plano"
      subtitle={`${plan.length}x por semana · ${GOAL_LABEL[profile.goal].toLowerCase()} · ${activeEquip}`}
    >
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
        <p className="text-xs text-muted-foreground">Frescor por grupo — influencia o plano do dia</p>
        <ul className="mt-4 space-y-2">
          {recovery
            .filter((m) => m.group !== "cardio")
            .map((m) => (
              <li key={m.group}>
                <div className="flex justify-between text-xs">
                  <span>{m.label}</span>
                  <span className="text-muted-foreground">
                    {recoveryLabel(m.freshness)} · {m.freshness}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      m.freshness >= 70 ? "bg-primary" : m.freshness >= 35 ? "bg-chart-2" : "bg-chart-4"
                    }`}
                    style={{ width: `${m.freshness}%` }}
                  />
                </div>
              </li>
            ))}
        </ul>
      </section>

      <div className="mb-4 flex gap-2">
        {(["academia", "casa"] as Equipment[]).map((eq) => (
          <button
            key={eq}
            onClick={() => setEquipOverride(eq === profile.equipment && !equipOverride ? null : eq)}
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
          <TabsTrigger value="historico" className="flex-1">
            <History className="size-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="semana" className="mt-4 space-y-3">
          {plan.map((day) => (
            <Link key={day.id} to="/treino/sessao/$id" params={{ id: day.id }} search={{ express: false }} className="block">
              <article className="surface-card p-5 transition-colors hover:border-primary">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-primary">
                      {WEEKDAYS[day.weekday]}
                      {day.recoveryScore !== undefined && day.recoveryScore < 35 ? " · leve" : ""}
                    </p>
                    <h2 className="mt-1 text-xl">{day.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {day.focus} · ~{day.estimatedMin} min
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </div>
                <ul className="mt-3 space-y-1">
                  {day.exercises.map((ex) => (
                    <li key={ex.exerciseId} className="flex justify-between text-sm">
                      <span className="text-foreground">{ex.name}</span>
                      <span className="text-muted-foreground">
                        {ex.sets}x{ex.reps}
                        {ex.suggestedLoad > 0 && ex.unit === "kg" ? ` · ${ex.suggestedLoad} kg` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-4 h-11 w-full font-bold uppercase tracking-wide">
                  <Play className="size-4" /> Treinar
                </Button>
              </article>
            </Link>
          ))}
        </TabsContent>

        <TabsContent value="historico" className="mt-4 space-y-3">
          {state.sessions.length === 0 ? (
            <EmptyState
              variant="treino"
              title="Histórico vazio"
              description="Sua primeira sessão aparece aqui depois que você treinar."
              action={
                plan[0] ? (
                  <Link to="/treino/sessao/$id" params={{ id: plan[0].id }} search={{ express: false }} className="block">
                    <Button className="h-11 w-full font-bold uppercase tracking-wide">
                      <Play className="size-4" /> Começar sessão
                    </Button>
                  </Link>
                ) : (
                  <Link to="/" className="block">
                    <Button className="h-11 w-full font-bold uppercase tracking-wide">Ver Hoje</Button>
                  </Link>
                )
              }
            />
          ) : (
            state.sessions.map((s) => (
              <article key={s.id} className="surface-card p-4">
                <div className="flex justify-between">
                  <h2 className="text-base">{s.title}</h2>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.date).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.durationMin} min · {s.volumeKg.toLocaleString("pt-BR")} kg de volume ·{" "}
                  {s.exercises.length} exercícios
                  {s.rpe ? ` · RPE ${s.rpe}` : ""}
                </p>
              </article>
            ))
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
