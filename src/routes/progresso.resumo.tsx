import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, EmptyState } from "@/components/app-shell";
import { PeriodShareCard, ShareCardPicker } from "@/components/progress/share-card";
import { Button } from "@/components/ui/button";
import { periodReview, type PeriodKind } from "@/lib/engine/period-review";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/progresso/resumo")({
  validateSearch: (search: Record<string, unknown>) => ({
    period: search["period"] === "month" ? "month" : "week",
  }),
  head: () => ({
    meta: [
      { title: "Resumo — Soldiers Training" },
      { name: "description", content: "Resumo semanal e mensal com volume, PRs e consistência." },
    ],
  }),
  component: PeriodResumoPage,
});

function PeriodResumoPage() {
  const { period } = Route.useSearch();
  const kind = period as PeriodKind;
  const { state } = useStore();
  const review = periodReview(state, kind);
  const name = state.profile?.name ?? "Soldado";

  if (review.sessions === 0) {
    return (
      <AppShell title={review.label} subtitle="Ainda sem treinos neste período">
        <EmptyState
          variant="progresso"
          title="Nenhum treino neste período"
          description="Feche uma sessão para ver volume, PRs e consistência."
          action={
            <Link to="/treino" className="block">
              <Button className="h-11 w-full font-bold uppercase tracking-wide">Treinar agora</Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell title={review.label} subtitle={`${review.sessions} treinos · ${review.prCount} PRs`}>
      <div className="mb-3 flex gap-2">
        <Link to="/progresso/resumo" search={{ period: "week" }}>
          <Button size="sm" variant={kind === "week" ? "default" : "secondary"}>
            Semana
          </Button>
        </Link>
        <Link to="/progresso/resumo" search={{ period: "month" }}>
          <Button size="sm" variant={kind === "month" ? "default" : "secondary"}>
            Mês
          </Button>
        </Link>
      </div>

      <div className="surface-glass mb-4 grid grid-cols-2 gap-3 p-4">
        <Stat label="Treinos" value={String(review.sessions)} />
        <Stat label="Volume" value={`${review.volumeKg.toLocaleString("pt-BR")} kg`} />
        <Stat label="PRs" value={String(review.prCount)} />
        <Stat label="Aderência" value={`${review.adherencePct}%`} />
        <Stat
          label="Strength Score"
          value={review.strengthScore != null ? String(review.strengthScore) : "—"}
        />
        <Stat label="Consistência" value={`${review.consistencyPct}%`} />
      </div>

      {review.strengthDelta != null ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Strength Score {review.strengthDelta > 0 ? "+" : ""}
          {review.strengthDelta} em 28 dias
        </p>
      ) : null}

      {review.bestEvolution ? (
        <p className="mb-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold">
          Melhor evolução: {review.bestEvolution.name} +{review.bestEvolution.deltaKg} kg
        </p>
      ) : null}

      {review.nextBlock && review.nextBlock.days.length > 0 ? (
        <section className="surface-glass mb-4 p-4">
          <p className="eyebrow">Próximo bloco</p>
          <h2 className="mt-1 text-display text-lg">{review.nextBlock.label}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {review.nextBlock.days.map((d) => (
              <li key={d.title} className="flex justify-between gap-2 border-b border-white/5 pb-2 last:border-0">
                <span>
                  <span className="font-semibold">{d.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{d.focus}</span>
                </span>
                <span className="text-xs text-muted-foreground">{d.exerciseCount} ex.</span>
              </li>
            ))}
          </ul>
          <Link to="/treino" className="mt-3 block">
            <Button variant="secondary" className="h-10 w-full">
              Abrir plano
            </Button>
          </Link>
        </section>
      ) : null}

      <p className="mb-4 text-sm text-muted-foreground">{review.coachLine}</p>
      {review.wins.length ? (
        <ul className="mb-4 space-y-1 text-sm">
          {review.wins.map((w) => (
            <li key={w}>· {w}</li>
          ))}
        </ul>
      ) : null}

      <PeriodShareCard
        athleteName={name}
        title={review.label}
        sessions={review.sessions}
        volumeKg={review.volumeKg}
        prCount={review.prCount}
        consistencyPct={review.consistencyPct}
      />
      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold">Card de evolução</p>
        <ShareCardPicker state={state} defaultKind="evolucao" />
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-display text-xl text-primary">{value}</p>
    </div>
  );
}
