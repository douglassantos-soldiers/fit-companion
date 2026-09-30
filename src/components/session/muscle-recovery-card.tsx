import { Link } from "@tanstack/react-router";
import { Bot, CalendarDays, Play, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { MuscleHeatmap } from "@/components/session/muscle-heatmap";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import { Button } from "@/components/ui/button";
import type { MuscleGroup } from "@/data/exercises";
import type { MuscleRecovery, MuscleRecoverySnapshot } from "@/lib/engine/recovery";
import {
  findDayForMuscle,
  REASON_LABEL,
  recoveryActionHint,
  STATUS_LABEL,
  type DayLike,
} from "@/lib/training/recovery-ui";
import { WEEKDAY_LABELS } from "@/lib/training/weekdays";
import { seedCoachQuestion } from "@/lib/coach/seed";
import { cn } from "@/lib/utils";

function statusDotClass(status: MuscleRecoverySnapshot["status"], empty: boolean): string {
  if (empty || status === "unknown") return "bg-muted-foreground/50";
  if (status === "fresh") return "bg-primary";
  if (status === "ok") return "bg-[var(--chart-2)]";
  return "bg-[var(--chart-4)]";
}

export function MuscleRecoveryCard({
  recovery,
  recoverySnaps,
  plan,
  todayDay,
  express,
  trainingMode,
  onFocusDay,
}: {
  recovery: MuscleRecovery[];
  recoverySnaps: MuscleRecoverySnapshot[];
  plan: Array<DayLike & { weekday?: number }>;
  todayDay: (DayLike & { id: string }) | null;
  express: boolean;
  trainingMode?: string | null;
  /** Switch to Semana tab and scroll to day */
  onFocusDay?: (dayId: string) => void;
}) {
  const [selected, setSelected] = useState<MuscleGroup | null>(null);

  const hint = useMemo(
    () => recoveryActionHint(recoverySnaps, todayDay, { express, trainingMode }),
    [recoverySnaps, todayDay, express, trainingMode],
  );

  const selectedSnap = selected
    ? recoverySnaps.find((s) => s.muscle === selected) ?? null
    : null;
  const dayForMuscle = selected ? findDayForMuscle(plan, selected) : null;

  const sessionHref =
    todayDay != null
      ? {
          to: "/treino/sessao/$id" as const,
          params: { id: todayDay.id },
          search: { express: hint.preferExpress || express, from: "treino" as const },
        }
      : null;

  return (
    <>
      <section className="surface-card mb-4 p-5">
        <h2 className="text-lg">Recuperação muscular</h2>
        <p className="text-xs text-muted-foreground">
          {hint.empty
            ? "Sem volume recente — toque em um grupo após treinar para ver detalhes"
            : "Heatmap por grupo — toque para detalhes · volume 7d influencia a recuperação"}
        </p>

        {hint.empty ? (
          <p className="mt-3 rounded-xl border border-dashed border-white/15 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            {hint.message}
          </p>
        ) : (
          <p className="mt-3 text-sm text-foreground">{hint.message}</p>
        )}

        <div className="mt-4">
          <MuscleHeatmap
            recovery={recovery}
            empty={hint.empty}
            selected={selected}
            onSelectMuscle={setSelected}
          />
        </div>

        <ul className="mt-4 space-y-1.5">
          {recoverySnaps
            .filter((s) => s.muscle !== "cardio")
            .map((s) => (
              <li key={s.muscle}>
                <button
                  type="button"
                  onClick={() => setSelected(s.muscle)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/5",
                    selected === s.muscle && "bg-white/8",
                  )}
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      statusDotClass(s.status, hint.empty),
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {hint.empty ? "—" : STATUS_LABEL[s.status]}
                  </span>
                  <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                    {hint.empty ? "—" : `${s.freshness}%`}
                  </span>
                  <span className="w-14 shrink-0 text-right tabular-nums text-[0.65rem] text-muted-foreground">
                    {hint.empty ? "sem carga" : `L7 ${s.load7d}`}
                  </span>
                </button>
              </li>
            ))}
        </ul>

        {sessionHref ? (
          <Link {...sessionHref} className="mt-4 block">
            <Button className="h-11 w-full font-bold uppercase tracking-wide">
              {hint.preferExpress || express ? (
                <Zap className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
              {hint.ctaLabel}
            </Button>
          </Link>
        ) : null}
      </section>

      <SoldiersOverlay
        open={Boolean(selectedSnap)}
        onClose={() => setSelected(null)}
        title={selectedSnap?.label ?? "Músculo"}
        description={
          hint.empty
            ? "Sem carga recente neste grupo"
            : selectedSnap
              ? `${STATUS_LABEL[selectedSnap.status]} · ${selectedSnap.freshness}%`
              : undefined
        }
      >
        {selectedSnap ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Freshness
                </dt>
                <dd className="font-semibold">{hint.empty ? "—" : `${selectedSnap.freshness}%`}</dd>
              </div>
              <div>
                <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Status
                </dt>
                <dd className="font-semibold">
                  {hint.empty ? "Sem dado" : STATUS_LABEL[selectedSnap.status]}
                </dd>
              </div>
              <div>
                <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  load7d
                </dt>
                <dd className="font-semibold">{selectedSnap.load7d}</dd>
              </div>
              <div>
                <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  load28d
                </dt>
                <dd className="font-semibold">{selectedSnap.load28d}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Último treino
                </dt>
                <dd className="font-semibold">
                  {selectedSnap.lastTrainedHours != null
                    ? `há ${selectedSnap.lastTrainedHours}h`
                    : "Nunca neste histórico"}
                </dd>
              </div>
            </dl>

            {selectedSnap.reasonCodes.length ? (
              <div>
                <p className="mb-1.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Sinais
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {selectedSnap.reasonCodes.map((code) => (
                    <li
                      key={code}
                      className="rounded-full border border-white/10 px-2 py-0.5 text-[0.65rem] text-muted-foreground"
                    >
                      {REASON_LABEL[code] ?? code}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              {dayForMuscle ? (
                <Button
                  type="button"
                  className="h-11 w-full font-bold uppercase tracking-wide"
                  onClick={() => {
                    onFocusDay?.(dayForMuscle.id);
                    setSelected(null);
                  }}
                >
                  <CalendarDays className="size-4" />
                  Ver dia que treina isto
                  {"weekday" in dayForMuscle && typeof dayForMuscle.weekday === "number"
                    ? ` · ${WEEKDAY_LABELS[dayForMuscle.weekday]}`
                    : ""}
                </Button>
              ) : null}

              {(selectedSnap.status === "fatigued" || selectedSnap.status === "ok") &&
              !hint.empty ? (
                <Link
                  to="/coach"
                  onClick={() => {
                    seedCoachQuestion(
                      `Por que ${selectedSnap.label} está com recuperação ${STATUS_LABEL[selectedSnap.status].toLowerCase()}?`,
                    );
                    setSelected(null);
                  }}
                >
                  <Button type="button" variant="secondary" className="h-11 w-full">
                    <Bot className="size-4" /> Perguntar ao Coach
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </SoldiersOverlay>
    </>
  );
}
