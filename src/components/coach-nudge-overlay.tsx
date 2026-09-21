import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SoldiersOverlay } from "@/components/soldiers-overlay";

export function CoachNudgeOverlay({
  open,
  onClose,
  volumeDeltaPct,
}: {
  open: boolean;
  onClose: () => void;
  volumeDeltaPct: number | null;
}) {
  const delta =
    volumeDeltaPct != null ? `${volumeDeltaPct > 0 ? "+" : ""}${volumeDeltaPct}%` : "acima";
  return (
    <SoldiersOverlay
      open={open}
      onClose={onClose}
      title="Percebemos uma mudança"
      description={`Volume ${delta} na semana e recuperação em queda. Vale olhar a análise antes de empilhar mais carga.`}
    >
      <div className="space-y-2">
        <Link to="/progresso/resumo" search={{ period: "week" }} onClick={onClose} className="block">
          <Button className="h-11 w-full font-bold uppercase">Ver análise</Button>
        </Link>
        <Button variant="secondary" className="h-11 w-full" onClick={onClose}>
          Agora não
        </Button>
      </div>
    </SoldiersOverlay>
  );
}
