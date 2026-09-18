import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProofOfPerformance } from "@/lib/engine/proof-of-performance";
import { cn } from "@/lib/utils";

export function ProofCard({
  proof,
  name,
  onShare,
  sharing,
  className,
}: {
  proof: ProofOfPerformance;
  name?: string;
  onShare?: () => void;
  sharing?: boolean;
  className?: string;
}) {
  return (
    <article className={cn("surface-glass overflow-hidden p-5", className)}>
      <p className="eyebrow">Proof of Performance</p>
      <h3 className="mt-1 text-display text-2xl leading-none">
        {name ? `${name.split(" ")[0]} · ` : ""}
        {proof.periodDays}d
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">{proof.narrative}</p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/40 px-2 py-3">
          <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Score</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {proof.scoreDelta > 0 ? "+" : ""}
            {proof.scoreDelta}
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 px-2 py-3">
          <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Volume</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {proof.volumeDeltaPct > 0 ? "+" : ""}
            {proof.volumeDeltaPct}%
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 px-2 py-3">
          <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
            {proof.weakestImproved?.label ?? "Consist."}
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {proof.weakestImproved
              ? `+${proof.weakestImproved.delta}`
              : `${proof.consistencyDelta > 0 ? "+" : ""}${proof.consistencyDelta}`}
          </p>
        </div>
      </div>

      {onShare ? (
        <Button className="mt-4 w-full gap-2" size="sm" disabled={sharing} onClick={onShare}>
          <Share2 className="size-3.5" />
          {sharing ? "Publicando…" : "Compartilhar no feed"}
        </Button>
      ) : null}
    </article>
  );
}
