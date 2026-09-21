import { Link } from "@tanstack/react-router";
import { ChevronRight, Pin } from "lucide-react";
import { SoldiersMediaThumb } from "@/components/soldiers-media-frame";
import { Button } from "@/components/ui/button";
import { resolveExerciseMedia } from "@/lib/soldiers-media";
import { cn } from "@/lib/utils";

export function ExercisePlanRow({
  exerciseId,
  name,
  sets,
  reps,
  suggestedLoad,
  unit,
  chips,
  pinned,
  onPin,
  onSwap,
  onSkip,
}: {
  exerciseId: string;
  name: string;
  sets: number;
  reps: string | number;
  suggestedLoad: number;
  unit: string;
  chips: string[];
  pinned: boolean;
  onPin: () => void;
  onSwap: () => void;
  onSkip: () => void;
}) {
  const thumb = resolveExerciseMedia(exerciseId);

  return (
    <li className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center gap-3 p-2.5">
        <SoldiersMediaThumb media={thumb} alt={name} className="size-16 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
              {sets} séries
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
              {reps} reps
            </span>
            {suggestedLoad > 0 && unit === "kg" ? (
              <span className="text-[0.65rem] text-muted-foreground">{suggestedLoad} kg</span>
            ) : null}
          </div>
          {chips.length ? (
            <p className="mt-1 truncate text-[0.65rem] text-muted-foreground">{chips.join(" · ")}</p>
          ) : null}
        </div>
        <Link
          to="/treino/exercicio/$id"
          params={{ id: exerciseId }}
          className="flex shrink-0 flex-col items-end gap-0.5 text-primary"
          aria-label={`Abrir ${name}`}
        >
          <span className="text-[0.65rem] font-bold uppercase tracking-wider">Iniciar</span>
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <div className="flex gap-1 border-t border-white/5 px-2.5 py-1.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={cn("h-7 px-2 text-[0.65rem]", pinned && "text-primary")}
          onClick={onPin}
        >
          <Pin className="size-3" /> {pinned ? "Fixado" : "Fixar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[0.65rem]" onClick={onSwap}>
          Trocar
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[0.65rem]" onClick={onSkip}>
          Pular
        </Button>
      </div>
    </li>
  );
}
