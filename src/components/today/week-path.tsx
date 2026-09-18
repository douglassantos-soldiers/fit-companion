import { cn } from "@/lib/utils";
import type { WeekPathState } from "@/lib/engine/retention";
import { todayKey } from "@/lib/types";

const LABELS = ["S", "T", "Q", "Q", "S", "S", "D"];

export function WeekPath({
  days,
  states,
}: {
  days: Date[];
  states: WeekPathState[];
}) {
  return (
    <div className="mb-4 flex justify-between gap-1">
      {days.map((d, i) => {
        const key = todayKey(d);
        const st = states[i] ?? "empty";
        return (
          <div key={key} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[0.55rem] uppercase tracking-wider text-muted-foreground">
              {LABELS[i] ?? d.toLocaleDateString("pt-BR", { weekday: "narrow" })}
            </span>
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                st === "today" && "border-2 border-primary text-primary glow-primary",
                st === "trained" && "bg-primary/25 text-primary",
                st === "freeze" && "bg-sky-500/25 text-sky-400",
                st === "partial" && "bg-amber-500/20 text-amber-400",
                st === "miss" && "bg-muted/30 text-muted-foreground/50",
                st === "empty" && "bg-muted/40 text-muted-foreground",
              )}
              title={st}
            >
              {st === "freeze" ? "F" : st === "trained" ? "✓" : d.getDate()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
