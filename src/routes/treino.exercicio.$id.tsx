import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { exerciseById } from "@/data/exercises";
import { summarizeExercise, hitsForExercise } from "@/lib/engine/exercise-history";
import { detectExercisePrs } from "@/lib/training/prs";
import { best1RM } from "@/lib/training/one-rm";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/treino/exercicio/$id")({
  head: () => ({
    meta: [{ title: "Exercício — Soldiers Training" }],
  }),
  component: ExerciseHistoryPage,
});

function ExerciseHistoryPage() {
  const { id } = Route.useParams();
  const { state } = useStore();
  const ex = exerciseById(id);
  const summary = summarizeExercise(id, state.sessions);
  const prs = detectExercisePrs(id, state.sessions).slice(-5).reverse();
  const orm = best1RM(hitsForExercise(id, state.sessions));

  return (
    <AppShell title={ex?.name ?? id} subtitle={ex ? `${ex.group} · ${ex.equipment}` : "Histórico"}>
      {!summary.hits.length ? (
        <EmptyState
          variant="treino"
          title="Sem histórico"
          description="Complete uma sessão com este exercício para ver PRs e tendência."
          action={
            <Link to="/treino" className="block">
              <Button className="w-full">Voltar ao plano</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          <section className="surface-card grid grid-cols-3 gap-2 p-4 text-center">
            <Stat label="PR carga" value={summary.prWeightKg ? `${summary.prWeightKg} kg` : "—"} />
            <Stat label="1RM est." value={orm ? `${orm.value} kg` : "—"} />
            <Stat label="Tendência" value={summary.trend === "up" ? "Alta" : summary.trend === "down" ? "Queda" : "Estável"} />
          </section>
          {prs.length ? (
            <section className="surface-card space-y-2 p-4">
              <h2 className="text-sm font-semibold">Recordes</h2>
              {prs.map((p) => (
                <p key={p.id} className="text-xs text-muted-foreground">
                  {new Date(p.achievedAt).toLocaleDateString("pt-BR")} · {p.label}
                </p>
              ))}
            </section>
          ) : null}
          <section className="surface-card space-y-2 p-4">
            <h2 className="text-sm font-semibold">Sessões</h2>
            <ul className="space-y-2">
              {summary.hits.slice(0, 12).map((h) => (
                <li key={h.sessionId}>
                  <Link
                    to="/treino/historico/$sessionId"
                    params={{ sessionId: h.sessionId }}
                    className="flex justify-between text-sm"
                  >
                    <span>{new Date(h.date).toLocaleDateString("pt-BR")}</span>
                    <span className="text-muted-foreground">
                      {h.maxWeightKg > 0 ? `${h.maxWeightKg} kg` : `${Math.round(h.avgReps)} reps`} · {h.setsDone}/
                      {h.setsTotal}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <Link to="/treino">
            <Button variant="secondary" className="w-full">
              Usar no plano
            </Button>
          </Link>
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-display text-sm text-primary">{value}</p>
      <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
