import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HomeBlockImpression } from "@/components/today/home-block-impression";
import { trackHomeSurface } from "@/lib/home/track-home-surface";

export function HomeStreakRiskBanner({
  streakDays,
  workoutDayId,
  express,
  freezes,
  onFreeze,
}: {
  streakDays: number;
  workoutDayId: string | null;
  express: boolean;
  freezes: number;
  onFreeze: () => void;
}) {
  return (
    <HomeBlockImpression blockId="streakRisk">
      <div className="surface-glass mb-4 flex flex-col gap-3 border-primary/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <Flame className="size-5 shrink-0 text-primary text-glow" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Não perca o streak de {streakDays}d
            </p>
            <p className="text-xs text-muted-foreground">
              Treine, faça Express ou use um freeze.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {workoutDayId ? (
            <Link
              to="/treino/sessao/$id"
              params={{ id: workoutDayId }}
              search={{ express, from: "hoje" }}
              onClick={() => trackHomeSurface("home_block_click", { blockId: "streakRisk" })}
            >
              <Button size="sm">Treinar</Button>
            </Link>
          ) : null}
          {freezes > 0 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                trackHomeSurface("home_block_click", { blockId: "streakRisk", action: "freeze" });
                onFreeze();
              }}
            >
              Freeze ({freezes})
            </Button>
          ) : null}
        </div>
      </div>
    </HomeBlockImpression>
  );
}
