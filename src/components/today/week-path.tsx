import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeekPathState } from "@/lib/engine/retention";
import { todayKey } from "@/lib/types";

const LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

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
        const isToday = st === "today";
        return (
          <div key={key} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={cn(
                "text-[0.6rem] font-semibold uppercase tracking-wider",
                isToday ? "text-primary" : "text-muted-foreground",
              )}
            >
              {LABELS[i] ?? d.toLocaleDateString("pt-BR", { weekday: "short" })}
            </span>
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-full text-sm font-bold transition-colors",
                isToday && "bg-primary text-primary-foreground shadow-[0_0_18px_var(--glow-primary)]",
                st === "trained" && "bg-primary/20 text-primary",
                st === "freeze" && "bg-sky-500/25 text-sky-400",
                st === "partial" && "border border-amber-400/50 bg-amber-500/15 text-amber-300",
                st === "miss" && "bg-muted/30 text-muted-foreground/50",
                st === "empty" && "bg-white/5 text-muted-foreground",
              )}
              title={st}
            >
              {st === "trained" ? <Check className="size-4" strokeWidth={3} /> : d.getDate()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
