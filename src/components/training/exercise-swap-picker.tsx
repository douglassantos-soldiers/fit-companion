import { RefreshCw } from "lucide-react";
import type { Exercise } from "@/data/exercises";
import { SoldiersMediaThumb } from "@/components/soldiers-media-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveExerciseMedia } from "@/lib/soldiers-media";

export function ExerciseSwapPicker({
  options,
  emptyLabel = "Nenhuma alternativa disponível agora.",
  onPick,
}: {
  options: Exercise[];
  emptyLabel?: string;
  onPick: (exercise: Exercise) => void;
}) {
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2">
      {options.map((alt) => {
        const media = resolveExerciseMedia(alt.id, alt.mediaUrl);
        const published = media.source === "soldiers";
        return (
          <li key={alt.id}>
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-left font-normal"
              onClick={() => onPick(alt)}
            >
              {published ? (
                <SoldiersMediaThumb media={media} alt={alt.name} className="size-14 rounded-xl" />
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-[0.65rem] uppercase text-muted-foreground">
                  {alt.group.slice(0, 3)}
                </div>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="block truncate text-sm font-semibold">{alt.name}</span>
                  {published ? (
                    <Badge variant="outline" className="shrink-0 border-primary/40 text-[0.6rem] text-primary">
                      Demo
                    </Badge>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {alt.group} · {alt.equipment}
                </span>
              </span>
              <RefreshCw className="size-4 shrink-0 text-primary" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
