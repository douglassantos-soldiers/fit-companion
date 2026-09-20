import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { exerciseById } from "@/data/exercises";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/treino/historico/$sessionId")({
  head: () => ({
    meta: [{ title: "Sessão — Soldiers Training" }],
  }),
  component: SessionHistoryPage,
});

function SessionHistoryPage() {
  const { sessionId } = Route.useParams();
  const { state } = useStore();
  const session = state.sessions.find((s) => s.id === sessionId);

  if (!session) {
    return (
      <AppShell title="Sessão">
        <EmptyState
          variant="treino"
          title="Sessão não encontrada"
          description="Esse treino não está no histórico deste dispositivo."
          action={
            <Link to="/treino" className="block">
              <Button className="w-full">Voltar ao treino</Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={session.title}
      subtitle={`${new Date(session.date).toLocaleDateString("pt-BR")} · ${session.durationMin} min`}
    >
      <section className="surface-card mb-4 grid grid-cols-3 gap-2 p-4 text-center">
        <div>
          <p className="text-display text-sm text-primary">{session.volumeKg.toLocaleString("pt-BR")} kg</p>
          <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">Volume</p>
        </div>
        <div>
          <p className="text-display text-sm text-primary">{session.exercises.length}</p>
          <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">Exercícios</p>
        </div>
        <div>
          <p className="text-display text-sm text-primary">{session.rpe ?? (session.express ? "express" : "—")}</p>
          <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">RPE</p>
        </div>
      </section>
      <ul className="space-y-3">
        {session.exercises.map((ex) => {
          const meta = exerciseById(ex.exerciseId);
          return (
            <li key={ex.exerciseId} className="surface-card p-4">
              <Link to="/treino/exercicio/$id" params={{ id: ex.exerciseId }} className="font-semibold">
                {meta?.name ?? ex.exerciseId}
              </Link>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {ex.sets.map((set, i) => (
                  <li key={`${ex.exerciseId}-${i}`}>
                    {set.type === "warmup" ? "Aquecimento" : `Série ${i + 1}`}
                    {": "}
                    {set.skipped
                      ? "pulada"
                      : `${set.reps} × ${set.weightKg > 0 ? `${set.weightKg} kg` : "corpo"}${
                          set.rpe != null ? ` · RPE ${set.rpe}` : set.rir != null ? ` · RIR ${set.rir}` : ""
                        }`}
                    {!set.done && !set.skipped ? " · não feita" : ""}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
