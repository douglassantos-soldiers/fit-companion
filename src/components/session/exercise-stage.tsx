import { NumberInput } from "@mantine/core";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { Exercise } from "@/data/exercises";
import type { PlannedExercise } from "@/lib/engine/plan";
import type { SetLog } from "@/lib/types";
import { MuscleArt } from "@/components/session/muscle-art";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShinyButton } from "@/components/ui/shiny-button";

export function ExerciseStage({
  planned,
  exercise,
  setLog,
  setIndex,
  totalSets,
  exIndex,
  totalExercises,
  onChangeSet,
  onCompleteSet,
  onSwap,
  onPrevExercise,
  onNextExercise,
}: {
  planned: PlannedExercise;
  exercise: Exercise | undefined;
  setLog: SetLog;
  setIndex: number;
  totalSets: number;
  exIndex: number;
  totalExercises: number;
  onChangeSet: (patch: Partial<SetLog>) => void;
  onCompleteSet: () => void;
  onSwap: () => void;
  onPrevExercise: () => void;
  onNextExercise: () => void;
}) {
  const group = exercise?.group ?? "peito";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <MuscleArt
        group={group}
        {...(exercise?.mediaUrl ? { mediaUrl: exercise.mediaUrl } : {})}
        className="-mx-4 h-[45vh] min-h-[200px] w-[calc(100%+2rem)] shrink-0 sm:mx-0 sm:h-[42vh] sm:w-full sm:rounded-2xl"
      />

      <div className="surface-glass space-y-2 border-primary/30 p-4 glow-primary">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="eyebrow">
              Exercício {exIndex + 1}/{totalExercises}
            </p>
            <h2 className="text-2xl leading-none">{planned.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Série{" "}
              <span className="text-display text-primary text-glow">
                {setIndex + 1}/{totalSets}
              </span>{" "}
              · {planned.sets}x{planned.reps} · descanso {planned.restSec}s
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={onSwap}>
            <RefreshCw className="size-3.5" /> Trocar
          </Button>
        </div>
        {planned.suggestedLoad > 0 && planned.unit === "kg" ? (
          <Badge variant="secondary" className="text-display text-xs text-primary">
            sugerido {planned.suggestedLoad} kg
          </Badge>
        ) : null}
        {planned.reason ? <p className="text-[0.65rem] text-primary/80">{planned.reason}</p> : null}
      </div>

      <div className="mt-auto space-y-3 pb-2">
        <div className="flex gap-2">
          <NumberInput
            label="Reps"
            value={setLog.reps}
            onChange={(v) => onChangeSet({ reps: typeof v === "number" ? v : 0 })}
            min={0}
            step={1}
            className="flex-1"
            styles={{ input: { textAlign: "center", fontFamily: "Anton, sans-serif", fontSize: "1.25rem" } }}
          />
          <NumberInput
            label="Kg"
            value={setLog.weightKg}
            onChange={(v) => onChangeSet({ weightKg: typeof v === "number" ? v : 0 })}
            min={0}
            step={2.5}
            decimalScale={1}
            className="flex-1"
            styles={{ input: { textAlign: "center", fontFamily: "Anton, sans-serif", fontSize: "1.25rem" } }}
          />
        </div>

        <ShinyButton
          className="glow-primary h-14 w-full border-primary bg-primary text-base font-bold text-primary-foreground disabled:opacity-50"
          onClick={onCompleteSet}
          disabled={setLog.done}
        >
          {setLog.done ? "Série concluída" : "Concluir série"}
        </ShinyButton>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            disabled={exIndex <= 0}
            onClick={onPrevExercise}
          >
            <ChevronLeft className="size-4" /> Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            disabled={exIndex >= totalExercises - 1}
            onClick={onNextExercise}
          >
            Próximo <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
