import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { exerciseById } from "@/data/exercises";
import {
  last7Dates,
  performanceDimensions,
  performanceScore,
  personalRecords,
  weeklyVolumeSeries,
} from "@/lib/engine/dimensions";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/progresso")({
  head: () => ({
    meta: [
      { title: "Progresso — Soldiers Performance OS" },
      {
        name: "description",
        content: "Peso, volume semanal, consistência, recordes pessoais e dimensões de performance.",
      },
      { property: "og:title", content: "Seu progresso" },
      { property: "og:description", content: "Gráficos de peso, volume, consistência e recordes." },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const { state, hydrated } = useStore();

  if (!hydrated || !state.profile) {
    return (
      <AppShell title="Progresso">
        <div className="surface-card h-40 animate-pulse" />
      </AppShell>
    );
  }

  const dims = performanceDimensions(state, state.profile);
  const score = performanceScore(dims);
  const volume = weeklyVolumeSeries(state.sessions);
  const records = personalRecords(state.sessions);
  const week = last7Dates();
  const trainedDates = new Set(state.sessions.map((s) => s.date.slice(0, 10)));
  const weightData = state.weights.map((w) => ({
    label: new Date(w.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    peso: w.weightKg,
  }));

  return (
    <AppShell title="Progresso" subtitle={`Score de performance ${score}/100`}>
      <section className="surface-card p-5">
        <h2 className="text-lg">Dimensões de performance</h2>
        <ul className="mt-4 space-y-3">
          {dims.map((d) => (
            <li key={d.key}>
              <div className="flex justify-between text-sm">
                <span>{d.label}</span>
                <span className="text-muted-foreground">{d.score}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${d.score}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-card mt-4 p-5">
        <h2 className="text-lg">Volume por semana</h2>
        <p className="text-xs text-muted-foreground">Carga total levantada (kg)</p>
        <div className="mt-4 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volume}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--foreground)",
                }}
              />
              <Bar dataKey="volume" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="surface-card mt-4 p-5">
        <h2 className="text-lg">Peso corporal</h2>
        {weightData.length > 1 ? (
          <div className="mt-4 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weightData}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--foreground)",
                  }}
                />
                <Area dataKey="peso" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Registre seu peso na tela Hoje por alguns dias para ver a curva de evolução.
          </p>
        )}
      </section>

      <section className="surface-card mt-4 p-5">
        <h2 className="text-lg">Consistência (7 dias)</h2>
        <div className="mt-4 flex justify-between gap-2">
          {week.map((d) => {
            const active = trainedDates.has(d);
            return (
              <div key={d} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className={`flex aspect-square w-full items-center justify-center rounded-lg text-xs font-bold ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {new Date(d).getDate()}
                </div>
                <span className="text-[0.6rem] uppercase text-muted-foreground">
                  {new Date(d).toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="surface-card mt-4 p-5">
        <h2 className="text-lg">Recordes pessoais</h2>
        {records.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Conclua séries em uma sessão para começar a registrar recordes.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {records.map((r) => (
              <li key={r.exerciseId} className="flex items-center justify-between text-sm">
                <span>{exerciseById(r.exerciseId)?.name ?? r.exerciseId}</span>
                <span className="text-display text-primary">
                  {r.weightKg} kg × {r.reps}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
