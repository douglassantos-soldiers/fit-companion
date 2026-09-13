import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Minus, Plus, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildWeeklyPlan, sessionVolume } from "@/lib/engine/plan";
import { useStore } from "@/lib/store";
import type { ExerciseLog, SetLog } from "@/lib/types";

export const Route = createFileRoute("/treino/sessao/$id")({
  head: () => ({
    meta: [
      { title: "Sessão de treino — Soldiers Performance OS" },
      {
        name: "description",
        content: "Execute o treino com séries, cargas sugeridas e cronômetro de descanso.",
      },
      { property: "og:title", content: "Sessão de treino" },
      { property: "og:description", content: "Marque cada série e registre o volume da sessão." },
    ],
  }),
  component: SessionPage,
});

function SessionPage() {
  const { id } = useParams({ from: "/treino/sessao/$id" });
  const navigate = useNavigate();
  const { state, hydrated, addSession } = useStore();
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [rest, setRest] = useState<number | null>(null);

  const day = useMemo(() => {
    if (!state.profile) return null;
    return buildWeeklyPlan(state.profile, state.sessions).find((d) => d.id === id) ?? null;
  }, [state.profile, state.sessions, id]);

  useEffect(() => {
    if (!day || logs.length) return;
    setLogs(
      day.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        sets: Array.from({ length: ex.sets }, () => ({
          reps: Number((ex.reps.split("-")[0] ?? "10").replace(/\D/g, "")) || 10,
          weightKg: ex.suggestedLoad,
          done: false,
        })),
      })),
    );
  }, [day, logs.length]);

  useEffect(() => {
    if (rest === null) return;
    if (rest <= 0) {
      setRest(null);
      return;
    }
    const t = setTimeout(() => setRest((r) => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [rest]);

  if (!hydrated || !state.profile || !day) {
    return (
      <div className="mx-auto w-full max-w-md p-4">
        <div className="surface-card h-40 animate-pulse" />
      </div>
    );
  }

  const totalSets = logs.reduce((s, l) => s + l.sets.length, 0);
  const doneSets = logs.reduce((s, l) => s + l.sets.filter((x) => x.done).length, 0);

  const updateSet = (exIdx: number, setIdx: number, patch: Partial<SetLog>) =>
    setLogs((prev) =>
      prev.map((l, i) =>
        i !== exIdx ? l : { ...l, sets: l.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...patch })) },
      ),
    );

  const finish = () => {
    const volume = sessionVolume(logs);
    addSession({
      id: `${Date.now()}`,
      dayId: day.id,
      title: day.title,
      date: new Date().toISOString(),
      durationMin: Math.max(1, Math.round((Date.now() - startedAt) / 60000)),
      exercises: logs,
      volumeKg: Math.round(volume),
    });
    toast.success(`Treino salvo · ${Math.round(volume).toLocaleString("pt-BR")} kg de volume`);
    navigate({ to: "/progresso" });
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center gap-3">
          <button onClick={() => navigate({ to: "/treino" })} aria-label="Voltar">
            <ArrowLeft className="size-5 text-muted-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg">{day.title}</h1>
            <p className="text-xs text-muted-foreground">
              {doneSets}/{totalSets} séries · descanso {day.exercises[0]?.restSec ?? 60}s
            </p>
          </div>
          {rest !== null && (
            <span className="text-display flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground">
              <Timer className="size-4" /> {rest}s
            </span>
          )}
        </div>
        <div className="mx-auto mt-3 h-1 w-full max-w-md rounded-full bg-muted">
          <div
            className="h-1 rounded-full bg-primary transition-all"
            style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }}
          />
        </div>
      </header>

      <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-5">
        {day.exercises.map((ex, exIdx) => (
          <article key={ex.exerciseId} className="surface-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg">{ex.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {ex.sets}x{ex.reps} · descanso {ex.restSec}s
                </p>
              </div>
              {ex.suggestedLoad > 0 && ex.unit === "kg" ? (
                <span className="text-display rounded-md bg-muted px-2 py-1 text-xs text-primary">
                  sugerido {ex.suggestedLoad} kg
                </span>
              ) : null}
            </div>

            <div className="mt-3 space-y-2">
              {logs[exIdx]?.sets.map((set, setIdx) => (
                <div key={setIdx} className="flex items-center gap-2">
                  <span className="text-display w-6 text-sm text-muted-foreground">{setIdx + 1}</span>
                  <Stepper
                    value={set.reps}
                    suffix="reps"
                    onChange={(v) => updateSet(exIdx, setIdx, { reps: v })}
                  />
                  <Stepper
                    value={set.weightKg}
                    step={2.5}
                    suffix="kg"
                    onChange={(v) => updateSet(exIdx, setIdx, { weightKg: v })}
                  />
                  <Button
                    size="icon"
                    variant={set.done ? "default" : "secondary"}
                    onClick={() => {
                      updateSet(exIdx, setIdx, { done: !set.done });
                      if (!set.done) setRest(ex.restSec);
                    }}
                    aria-label="Concluir série"
                  >
                    <Check className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 p-4 backdrop-blur">
        <div className="mx-auto w-full max-w-md">
          <Button className="h-12 w-full font-bold uppercase tracking-wide" onClick={finish}>
            Finalizar treino
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stepper({
  value,
  onChange,
  suffix,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix: string;
  step?: number;
}) {
  return (
    <div className="flex flex-1 items-center justify-between rounded-lg bg-muted px-2 py-1.5">
      <button onClick={() => onChange(Math.max(0, value - step))} aria-label={`Diminuir ${suffix}`}>
        <Minus className="size-4 text-muted-foreground" />
      </button>
      <span className="text-display text-sm">
        {value}
        <span className="ml-1 text-[0.65rem] text-muted-foreground">{suffix}</span>
      </span>
      <button onClick={() => onChange(value + step)} aria-label={`Aumentar ${suffix}`}>
        <Plus className="size-4 text-muted-foreground" />
      </button>
    </div>
  );
}
