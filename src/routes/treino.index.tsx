import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, History, Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildWeeklyPlan } from "@/lib/engine/plan";
import { useStore } from "@/lib/store";
import { GOAL_LABEL } from "@/lib/types";

export const Route = createFileRoute("/treino/")({
  head: () => ({
    meta: [
      { title: "Treino — Soldiers Performance OS" },
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

  if (!hydrated || !state.profile) {
    return (
      <AppShell title="Treino">
        <div className="surface-card h-40 animate-pulse" />
      </AppShell>
    );
  }

  const profile = state.profile;
  const plan = buildWeeklyPlan(profile, state.sessions);

  return (
    <AppShell
      title="Seu plano"
      subtitle={`${plan.length}x por semana · ${GOAL_LABEL[profile.goal].toLowerCase()} · ${profile.equipment}`}
    >
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
            <Link key={day.id} to="/treino/sessao/$id" params={{ id: day.id }} className="block">
              <article className="surface-card p-5 transition-colors hover:border-primary">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-primary">
                      {WEEKDAYS[day.weekday]}
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
            <p className="surface-card p-6 text-center text-sm text-muted-foreground">
              Nenhum treino registrado ainda. Sua primeira sessão aparece aqui.
            </p>
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
                </p>
              </article>
            ))
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
