import { Link } from "@tanstack/react-router";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PeriodReview } from "@/lib/engine/period-review";

export function PeriodReviewCard({ review }: { review: PeriodReview }) {
  return (
    <section className="surface-glass mb-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="eyebrow">
            {review.isSundayRitual ? "Domingo" : review.kind === "week" ? "Semana" : "Mês"}
          </p>
          <h2 className="text-display text-xl">{review.label}</h2>
        </div>
        <Link to="/progresso/resumo" search={{ period: review.kind }}>
          <Button size="sm" variant="secondary">
            <Share2 className="size-3.5" /> Ver
          </Button>
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-display text-lg text-primary">{review.sessions}</p>
          <p className="text-[0.65rem] uppercase text-muted-foreground">Treinos</p>
        </div>
        <div>
          <p className="text-display text-lg text-primary">{review.prCount}</p>
          <p className="text-[0.65rem] uppercase text-muted-foreground">PRs</p>
        </div>
        <div>
          <p className="text-display text-lg text-primary">{review.adherencePct}%</p>
          <p className="text-[0.65rem] uppercase text-muted-foreground">Aderência</p>
        </div>
        <div>
          <p className="text-display text-lg text-primary">
            {review.strengthScore != null ? review.strengthScore : "—"}
          </p>
          <p className="text-[0.65rem] uppercase text-muted-foreground">Força</p>
        </div>
      </div>
      {review.isSundayRitual && review.sessions === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Sem treinos esta semana — o ritual volta quando você retomar.
        </p>
      ) : null}
      {review.volumeDeltaPct != null ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Volume {review.volumeDeltaPct > 0 ? "+" : ""}
          {review.volumeDeltaPct}% vs semana passada · {review.volumeKg.toLocaleString("pt-BR")} kg
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {review.volumeKg.toLocaleString("pt-BR")} kg no período
        </p>
      )}
      {review.strengthDelta != null ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Strength Score {review.strengthDelta > 0 ? "+" : ""}
          {review.strengthDelta} em 28d
        </p>
      ) : null}
      {review.bestEvolution ? (
        <p className="mt-1 text-sm font-semibold">
          Melhor evolução: {review.bestEvolution.name} +{review.bestEvolution.deltaKg} kg
        </p>
      ) : null}
      {review.wins.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-primary">
          {review.wins.slice(0, 2).map((w) => (
            <li key={w}>· {w}</li>
          ))}
        </ul>
      ) : null}
      {review.risks.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {review.risks.slice(0, 2).map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
      ) : null}
      {review.nextBlock && review.nextBlock.days.length > 0 ? (
        <div className="mt-3 rounded-xl border border-white/10 px-3 py-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
            {review.nextBlock.label}
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {review.nextBlock.days.slice(0, 4).map((d) => (
              <li key={d.title}>
                {d.title} · {d.exerciseCount} ex. · {d.focus}
              </li>
            ))}
          </ul>
          <Link to="/treino" className="mt-2 inline-block text-xs font-semibold text-primary">
            Ver próximo bloco →
          </Link>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">{review.coachLine}</p>
    </section>
  );
}
