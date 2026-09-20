import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AccessUrgency } from "@/lib/access-window";

export function AccessWindowBanner({
  daysRemaining,
  urgency,
  reorderUrl,
  productName,
}: {
  daysRemaining: number;
  urgency: AccessUrgency;
  reorderUrl: string;
  productName: string | null;
}) {
  const label =
    urgency === "d1"
      ? "Seu acesso acaba hoje"
      : urgency === "d3"
        ? `Acesso acaba em ${daysRemaining} dia${daysRemaining === 1 ? "" : "s"}`
        : `${daysRemaining} dias de acesso`;
  return (
    <div className="surface-glass mb-4 border-primary/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</p>
      <p className="mt-1 text-sm">
        Nova compra no mesmo e-mail mantém treino, streak e coach.
      </p>
      <a href={reorderUrl} target="_blank" rel="noreferrer" className="mt-3 block">
        <Button className="h-11 w-full font-bold uppercase tracking-wide">
          {productName ? `Recomprar ${productName}` : "Recomprar meu kit"}{" "}
          <ExternalLink className="size-4" />
        </Button>
      </a>
    </div>
  );
}
