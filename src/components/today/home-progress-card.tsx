import { CalendarDays, Flame, Star } from "lucide-react";
import { MetricRing } from "@/components/metric-ring";

export function HomeProgressCard({
  score,
  exerciseMin,
  questsDone,
  questsTarget,
  streakDays,
}: {
  score: number;
  exerciseMin: number;
  questsDone: number;
  questsTarget: number;
  streakDays: number;
}) {
  return (
    <section className="surface-glass mb-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <p className="eyebrow">Progresso</p>
          <ul className="space-y-2.5">
            <li className="flex items-center gap-2.5 text-sm">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                <CalendarDays className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-tight">{exerciseMin} min</p>
                <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  Treino de hoje
                </p>
              </div>
            </li>
            <li className="flex items-center gap-2.5 text-sm">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Star className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-tight">
                  {questsDone}/{questsTarget}
                </p>
                <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  Missões
                </p>
              </div>
            </li>
            <li className="flex items-center gap-2.5 text-sm">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Flame className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-tight">
                  {streakDays} dia{streakDays === 1 ? "" : "s"}
                </p>
                <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  Sequência
                </p>
              </div>
            </li>
          </ul>
        </div>
        <MetricRing value={score} max={100} label="Score" size="lg" />
      </div>
    </section>
  );
}
