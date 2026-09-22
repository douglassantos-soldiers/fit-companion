import { NumberInput } from "@mantine/core";
import { ChevronLeft, ChevronRight, Minus, Plus, RefreshCw, SkipForward, ThumbsDown, ThumbsUp, Wrench } from "lucide-react";
import type { Exercise } from "@/data/exercises";
import type { PlannedExercise } from "@/lib/engine/plan";
import type { SetLog } from "@/lib/types";
import { MuscleArt } from "@/components/session/muscle-art";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShinyButton } from "@/components/ui/shiny-button";
import { exerciseWorkoutNote } from "@/lib/cms";
import { exerciseInstructions, resolveExerciseMedia } from "@/lib/soldiers-media";
import { PROGRESSION_CODE_LABEL, type ProgressionReasonCode } from "@/lib/engine/progression";
import { estimated1RM } from "@/lib/training/one-rm";
import { cn } from "@/lib/utils";

export type SessionEffortScale = "rpe" | "rir";

function reasonChips(codes: string[] | undefined) {
  if (!codes?.length) return [];
  return codes.map((code) => PROGRESSION_CODE_LABEL[code as ProgressionReasonCode] ?? code);
}

export function ExerciseStage({
  planned,
  exercise,
  setLog,
  setIndex,
  totalSets,
  exIndex,
  totalExercises,
  preference,
  effortScale,
  partnerName,
  restAfterThisSet,
  onChangeSet,
  onCompleteSet,
  onSkipSet,
  onAddSet,
  onSwap,
  onBusyMachine,
  onPrevExercise,
  onNextExercise,
  onPreference,
  onEffortScale,
}: {
  planned: PlannedExercise;
  exercise: Exercise | undefined;
  setLog: SetLog;
  setIndex: number;
  totalSets: number;
  exIndex: number;
  totalExercises: number;
  preference?: "like" | "dislike" | null;
  effortScale: SessionEffortScale;
  partnerName?: string;
  restAfterThisSet?: boolean;
  onChangeSet: (patch: Partial<SetLog>) => void;
  onCompleteSet: () => void;
  onSkipSet?: () => void;
  onAddSet?: () => void;
  onSwap: () => void;
  onBusyMachine?: () => void;
  onPrevExercise: () => void;
  onNextExercise: () => void;
  onPreference?: (pref: "like" | "dislike" | "clear") => void;
  onEffortScale: (scale: SessionEffortScale) => void;
}) {
  const group = exercise?.group ?? "peito";
  const cueNote = exercise ? exerciseWorkoutNote(exercise.id) : undefined;
  const media = exercise ? resolveExerciseMedia(exercise.id, exercise.mediaUrl) : undefined;
  const steps = exercise ? exerciseInstructions(exercise.id) : [];
  const todayLabel =
    planned.unit === "kg" && planned.suggestedLoad > 0
      ? `${planned.suggestedLoad} kg × ${planned.reps}`
      : `${planned.sets}×${planned.reps}`;
  const live1rm =
    planned.unit === "kg" && setLog.weightKg > 0 && setLog.reps > 0 && setLog.reps <= 12
      ? estimated1RM(setLog.weightKg, setLog.reps)
      : 0;
  const chips = reasonChips(planned.reasonCodes);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <MuscleArt
        group={group}
        {...(media ? { media } : {})}
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
          <div className="flex shrink-0 flex-col gap-1.5">
            <Button size="sm" variant="secondary" onClick={onSwap}>
              <RefreshCw className="size-3.5" /> Trocar
            </Button>
            {onBusyMachine ? (
              <Button size="sm" variant="outline" className="border-primary/40" onClick={onBusyMachine}>
                <Wrench className="size-3.5" /> Ocupada
              </Button>
            ) : null}
          </div>
        </div>

        {planned.supersetGroupId && partnerName ? (
          <Badge variant="outline" className="border-primary/40 text-xs text-primary">
            {restAfterThisSet
              ? `Bi-set · descanso depois desta`
              : `Bi-set · vai para ${partnerName}`}
          </Badge>
        ) : null}

        <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs space-y-1.5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-primary">Por que este peso</p>
          {planned.lastPerformance ? (
            <p className="font-medium text-foreground">
              Última vez{" "}
              <span className="text-display text-primary">{planned.lastPerformance}</span>
              {" → "}
              hoje <span className="text-display text-primary">{todayLabel}</span>
            </p>
          ) : planned.suggestedLoad > 0 && planned.unit === "kg" ? (
            <p className="font-medium text-foreground">
              Sugerido <span className="text-display text-primary">{planned.suggestedLoad} kg</span>
            </p>
          ) : (
            <p className="text-muted-foreground">Carga inicial do perfil</p>
          )}
          {planned.bestWeight != null && planned.bestWeight > 0 ? (
            <p className="text-muted-foreground">
              Melhor marca{" "}
              <span className="text-display text-primary">{planned.bestWeight} kg</span>
            </p>
          ) : null}
          {planned.estimated1rm != null && planned.estimated1rm > 0 ? (
            <p className="text-muted-foreground">
              1RM est.{" "}
              <span className="text-display text-primary">{planned.estimated1rm} kg</span>
            </p>
          ) : null}
          {live1rm > 0 ? (
            <p className="text-muted-foreground">
              1RM desta série{" "}
              <span className="text-display text-primary">{live1rm} kg</span>
            </p>
          ) : null}
          {planned.reason ? <p className="text-sm leading-snug text-foreground/90">{planned.reason}</p> : null}
          {chips.length ? (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {chips.map((label) => (
                <Badge key={label} variant="outline" className="text-[0.65rem]">
                  {label}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {planned.plateau ? (
            <Badge variant="outline" className="border-chart-4/50 text-xs text-chart-4">
              Plateau · variação aplicada
            </Badge>
          ) : null}
          <Badge variant="outline" className="text-[0.65rem] capitalize">
            {setLog.type === "warmup" ? "Aquecimento" : (setLog.type ?? "working")}
          </Badge>
          {setLog.skipped ? (
            <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
              Pulada
            </Badge>
          ) : null}
        </div>

        {onPreference ? (
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn("h-8 flex-1", preference === "like" && "border-primary bg-primary/15 text-primary")}
              onClick={() => onPreference(preference === "like" ? "clear" : "like")}
            >
              <ThumbsUp className="size-3.5" /> Gosto
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "h-8 flex-1",
                preference === "dislike" && "border-destructive/50 bg-destructive/10 text-destructive",
              )}
              onClick={() => onPreference(preference === "dislike" ? "clear" : "dislike")}
            >
              <ThumbsDown className="size-3.5" /> Evitar
            </Button>
          </div>
        ) : null}

        {cueNote ? (
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground/90">
            {cueNote}
          </p>
        ) : steps.length ? (
          <ol className="space-y-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground/90">
            {steps.map((step, i) => (
              <li key={step}>
                {i + 1}. {step}
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <div className="mt-auto space-y-3 pb-2">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            size="sm"
            variant={effortScale === "rpe" ? "secondary" : "ghost"}
            className="h-7 px-2 text-[0.65rem]"
            onClick={() => onEffortScale("rpe")}
          >
            RPE
          </Button>
          <Button
            type="button"
            size="sm"
            variant={effortScale === "rir" ? "secondary" : "ghost"}
            className="h-7 px-2 text-[0.65rem]"
            onClick={() => onEffortScale("rir")}
          >
            RIR
          </Button>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <NumberInput
              key={`${planned.exerciseId}-${setIndex}-reps`}
              label="Reps"
              value={setLog.reps}
              onChange={(v) => onChangeSet({ reps: typeof v === "number" ? v : 0 })}
              min={0}
              step={1}
              className="w-full"
              styles={{ input: { textAlign: "center", fontFamily: "Anton, sans-serif", fontSize: "1.25rem" } }}
            />
            <div className="flex gap-1">
              <Button type="button" variant="outline" className="h-8 flex-1" onClick={() => onChangeSet({ reps: Math.max(0, setLog.reps - 1) })}>
                <Minus className="size-3.5" />
              </Button>
              <Button type="button" variant="outline" className="h-8 flex-1" onClick={() => onChangeSet({ reps: setLog.reps + 1 })}>
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <NumberInput
              key={`${planned.exerciseId}-${setIndex}-kg`}
              label="Kg"
              value={setLog.weightKg}
              onChange={(v) => onChangeSet({ weightKg: typeof v === "number" ? v : 0 })}
              min={0}
              step={2.5}
              decimalScale={1}
              className="w-full"
              styles={{ input: { textAlign: "center", fontFamily: "Anton, sans-serif", fontSize: "1.25rem" } }}
            />
            <div className="flex gap-1">
              <Button type="button" variant="outline" className="h-8 flex-1" onClick={() => onChangeSet({ weightKg: Math.max(0, setLog.weightKg - 2.5) })}>
                <Minus className="size-3.5" />
              </Button>
              <Button type="button" variant="outline" className="h-8 flex-1" onClick={() => onChangeSet({ weightKg: setLog.weightKg + 2.5 })}>
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
          {effortScale === "rpe" ? (
            <NumberInput
              key={`${planned.exerciseId}-${setIndex}-rpe`}
              label="RPE"
              value={setLog.rpe ?? ""}
              onChange={(v) => {
                if (typeof v === "number") onChangeSet({ rpe: Math.min(10, Math.max(1, v)) });
              }}
              min={1}
              max={10}
              step={1}
              className="w-20"
              styles={{ input: { textAlign: "center", fontFamily: "Anton, sans-serif", fontSize: "1.1rem" } }}
            />
          ) : (
            <NumberInput
              key={`${planned.exerciseId}-${setIndex}-rir`}
              label="RIR"
              value={setLog.rir ?? ""}
              onChange={(v) => {
                if (typeof v === "number") onChangeSet({ rir: Math.min(5, Math.max(0, v)) });
              }}
              min={0}
              max={5}
              step={1}
              className="w-20"
              styles={{ input: { textAlign: "center", fontFamily: "Anton, sans-serif", fontSize: "1.1rem" } }}
            />
          )}
        </div>

        <ShinyButton
          className="glow-primary h-14 w-full border-primary bg-primary text-base font-bold text-primary-foreground disabled:opacity-50"
          onClick={onCompleteSet}
          disabled={setLog.done}
        >
          {setLog.done ? "Série concluída" : setLog.type === "warmup" ? "Concluir aquecimento" : "Concluir série"}
        </ShinyButton>
        <div className="flex gap-2">
          {onSkipSet ? (
            <Button type="button" variant="outline" className="h-10 flex-1" onClick={onSkipSet} disabled={setLog.done}>
              <SkipForward className="size-3.5" /> Pular
            </Button>
          ) : null}
          {onAddSet ? (
            <Button type="button" variant="outline" className="h-10 flex-1" onClick={onAddSet}>
              <Plus className="size-3.5" /> + série
            </Button>
          ) : null}
        </div>

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
