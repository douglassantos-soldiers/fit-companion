import { Droplets, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Water (+ weight when quest-relevant) on the main Today flow — not buried in Mais do dia. */
export function HomeQuickHabits({
  showWeight,
  waterMl,
  waterGoalMl,
  onAddWater,
  onOpenWeight,
}: {
  showWeight: boolean;
  waterMl: number;
  waterGoalMl: number;
  onAddWater: () => void;
  onOpenWeight: () => void;
}) {
  const waterPct = waterGoalMl > 0 ? Math.min(100, Math.round((waterMl / waterGoalMl) * 100)) : 0;
  return (
    <div className="mb-4 flex gap-2">
      <Button
        variant="outline"
        className="h-11 flex-1"
        onClick={onAddWater}
        aria-label="Adicionar 500 ml de água"
      >
        <Droplets className="size-4" />
        +500 ml
        <span className="ml-1 text-[0.65rem] font-normal text-muted-foreground">{waterPct}%</span>
      </Button>
      {showWeight ? (
        <Button variant="outline" className="h-11 flex-1" onClick={onOpenWeight}>
          <Scale className="size-4" /> Peso
        </Button>
      ) : null}
    </div>
  );
}
