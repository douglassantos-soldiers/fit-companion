import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareCardPicker } from "@/components/progress/share-card";
import type { ProofOfPerformance } from "@/lib/engine/proof-of-performance";
import { PROOF_CARD_D1, PROOF_CARD_EYEBROW } from "@/lib/ui/platform-copy";
import type { AppState } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProofCard({
  proof,
  name,
  onShare,
  sharing,
  state,
  className,
  empty,
}: {
  proof: ProofOfPerformance;
  name?: string;
  onShare?: () => void;
  sharing?: boolean;
  state?: AppState;
  className?: string;
  empty?: boolean;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  if (empty) {
    return (
      <article className={cn("surface-glass overflow-hidden p-5", className)}>
        <p className="eyebrow">{PROOF_CARD_EYEBROW}</p>
        <h3 className="mt-1 text-display text-2xl leading-none">Prova bloqueada</h3>
        <p className="mt-2 text-sm text-muted-foreground">{PROOF_CARD_D1}</p>
        <Link to="/treino" className="mt-4 block">
          <Button className="w-full" size="sm">
            Fazer o 1º treino
          </Button>
        </Link>
      </article>
    );
  }
  return (
    <article className={cn("surface-glass overflow-hidden p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{PROOF_CARD_EYEBROW}</p>
        <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {proof.status === "verified" ? "Verificado" : proof.status === "pending" ? "Pendente" : "Auto-relatado"}
        </span>
      </div>
      <h3 className="mt-1 text-display text-2xl leading-none">
        {name ? `${name.split(" ")[0]} · ` : ""}
        {proof.periodDays}d
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">{proof.narrative}</p>
      <p className="mt-1 text-[0.65rem] text-muted-foreground">
        {proof.status === "verified"
          ? `Verificado via ${proof.source === "strava" ? "Strava" : proof.source === "garmin" ? "Garmin" : "wearable"}.`
          : proof.status === "pending"
            ? "Prova pendente — ainda não verificada neste site."
            : "Auto-relatado no app. Strava/Garmin verificam quando conectados; Apple Health e Health Connect exigem app nativo."}
      </p>

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
      {state ? (
        <>
          <Button
            className="mt-2 w-full"
            size="sm"
            variant="outline"
            onClick={() => setSaveOpen((v) => !v)}
          >
            {saveOpen ? "Fechar imagem" : "Salvar imagem"}
          </Button>
          {saveOpen ? (
            <div className="mt-3">
              <ShareCardPicker state={state} defaultKind="prova" />
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
