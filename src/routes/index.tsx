import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Droplets, Flame, Play, Pill, Plus, Scale, Utensils } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { MetricRing } from "@/components/metric-ring";
import { Button } from "@/components/ui/button";
import { PRODUCTS } from "@/data/products";
import { performanceDimensions, performanceScore, streak } from "@/lib/engine/dimensions";
import { buildWeeklyPlan, planDayForToday } from "@/lib/engine/plan";
import { todayMetrics, todaySupplements, useStore } from "@/lib/store";
import { todayKey } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hoje — Soldiers Performance OS" },
      {
        name: "description",
        content: "Seu próximo passo do dia: treino, hidratação, suplementação e streak em uma tela.",
      },
      { property: "og:title", content: "Soldiers Performance OS" },
      { property: "og:description", content: "Treino personalizado, progresso e desafios sem burocracia." },
    ],
  }),
  component: Today,
});

function Today() {
  const navigate = useNavigate();
  const { state, hydrated, addWater, addMeal, addWeight, toggleSupplement } = useStore();

  useEffect(() => {
    if (hydrated && !state.profile) navigate({ to: "/onboarding" });
  }, [hydrated, state.profile, navigate]);

  if (!hydrated || !state.profile) {
    return (
      <AppShell title="Carregando" subtitle="Preparando seu dia">
        <div className="surface-card h-40 animate-pulse" />
      </AppShell>
    );
  }

  const profile = state.profile;
  const plan = buildWeeklyPlan(profile, state.sessions);
  const day = planDayForToday(plan);
  const doneToday = state.sessions.some((s) => s.date.slice(0, 10) === todayKey());
  const metrics = todayMetrics(state);
  const taken = todaySupplements(state);
  const dims = performanceDimensions(state, profile);
  const score = performanceScore(dims);
  const st = streak(state.sessions);

  const routine = state.supplementRoutine.length
    ? PRODUCTS.filter((p) => state.supplementRoutine.includes(p.id))
    : PRODUCTS.filter((p) => p.goals.includes(profile.goal)).slice(0, 3);

  return (
    <AppShell
      title={`Bom treino, ${profile.name.split(" ")[0]}`}
      subtitle={`Score de performance ${score}/100 · streak de ${st} dia(s)`}
    >
      <section className="surface-card overflow-hidden">
        <div className="bg-primary px-5 py-3">
          <p className="text-display text-xs tracking-[0.2em] text-primary-foreground">Próximo passo</p>
        </div>
        <div className="p-5">
          {doneToday ? (
            <>
              <h2 className="text-2xl">Treino de hoje concluído</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Foque em recuperação: água, proteína e sono. Amanhã o plano segue.
              </p>
            </>
          ) : day ? (
            <>
              <h2 className="text-2xl">{day.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {day.focus} · {day.exercises.length} exercícios · ~{day.estimatedMin} min
              </p>
              <Link to="/treino/sessao/$id" params={{ id: day.id }}>
                <Button className="mt-4 h-12 w-full font-bold uppercase tracking-wide">
                  <Play className="size-4" /> Iniciar treino
                </Button>
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-2xl">Descanso ativo</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                20 a 30 minutos de caminhada e mobilidade mantêm o ritmo sem cansar.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="surface-card mt-4 grid grid-cols-3 gap-2 p-5">
        <MetricRing value={metrics.waterMl} max={3000} label="Água" unit="ml" />
        <MetricRing value={metrics.meals} max={5} label="Refeições" />
        <MetricRing value={taken.length} max={Math.max(1, routine.length)} label="Suplementos" />
      </section>

      <section className="mt-4 grid grid-cols-3 gap-2">
        <QuickAction
          icon={Droplets}
          label="+500 ml"
          onClick={() => {
            addWater(500);
            toast.success("Hidratação registrada");
          }}
        />
        <QuickAction
          icon={Utensils}
          label="Refeição"
          onClick={() => {
            addMeal();
            toast.success("Refeição registrada");
          }}
        />
        <QuickAction
          icon={Scale}
          label="Peso"
          onClick={() => {
            const input = window.prompt("Peso de hoje em kg", String(profile.weightKg));
            const kg = Number(input?.replace(",", "."));
            if (kg > 0) {
              addWeight(kg);
              toast.success("Peso atualizado");
            }
          }}
        />
      </section>

      <section className="surface-card mt-4 p-5">
        <div className="flex items-center gap-2">
          <Pill className="size-4 text-primary" />
          <h2 className="text-lg">Suplementos de hoje</h2>
        </div>
        <ul className="mt-3 space-y-2">
          {routine.map((p) => {
            const done = taken.includes(p.id);
            return (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.timing} · {p.serving}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={done ? "default" : "secondary"}
                  onClick={() => toggleSupplement(p.id)}
                >
                  {done ? "Tomado" : "Marcar"}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="surface-card mt-4 flex items-center gap-4 p-5">
        <Flame className="size-8 text-primary" />
        <div>
          <p className="text-display text-2xl">{st} dias</p>
          <p className="text-xs text-muted-foreground">
            Sequência atual · {state.sessions.length} treinos registrados
          </p>
        </div>
      </section>
    </AppShell>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="surface-card flex flex-col items-center gap-2 p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary"
    >
      <Icon className="size-5 text-primary" />
      {label}
    </button>
  );
}
