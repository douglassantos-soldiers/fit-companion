import { Link } from "@tanstack/react-router";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PeriodReview } from "@/lib/engine/period-review";

export function PeriodReviewCard({ review }: { review: PeriodReview }) {
  return (
    <section className="surface-glass mb-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="eyebrow">{review.kind === "week" ? "Semana" : "Mês"}</p>
          <h2 className="text-display text-xl">{review.label}</h2>
        </div>
        <Link to="/progresso/resumo" search={{ period: review.kind }}>
          <Button size="sm" variant="secondary">
            <Share2 className="size-3.5" /> Ver
          </Button>
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-display text-lg text-primary">{review.sessions}</p>
          <p className="text-[0.65rem] uppercase text-muted-foreground">Treinos</p>
        </div>
        <div>
          <p className="text-display text-lg text-primary">{review.prCount}</p>
          <p className="text-[0.65rem] uppercase text-muted-foreground">PRs</p>
        </div>
        <div>
          <p className="text-display text-lg text-primary">{review.consistencyPct}%</p>
          <p className="text-[0.65rem] uppercase text-muted-foreground">Consistência</p>
        </div>
      </div>
      {review.volumeDeltaPct != null ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Volume {review.volumeDeltaPct > 0 ? "+" : ""}
          {review.volumeDeltaPct}% vs semana passada
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {review.volumeKg.toLocaleString("pt-BR")} kg no período
        </p>
      )}
      {review.bestEvolution ? (
        <p className="mt-1 text-sm font-semibold">
          Melhor evolução: {review.bestEvolution.name} +{review.bestEvolution.deltaKg} kg
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">{review.coachLine}</p>
    </section>
  );
}
