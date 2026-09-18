import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, HelpCircle, Moon, Pill, Play, Utensils, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import type { DayCheckIn, DayEnergy, LivingPlanSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

const TRAFFIC: Record<"green" | "yellow" | "red", string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-destructive",
};

export type LivingPlanPrimaryAction = {
  id: string;
  title: string;
  reason: string;
  href?: string;
};

export function LivingPlanHero({
  plan,
  doneToday,
  checkIn,
  onSaveCheckIn,
  primaryAction,
  onPrimaryAction,
}: {
  plan: LivingPlanSnapshot;
  doneToday: boolean;
  checkIn: DayCheckIn | undefined;
  onSaveCheckIn: (c: Omit<DayCheckIn, "date">) => void;
  primaryAction?: LivingPlanPrimaryAction | null;
  onPrimaryAction?: () => void;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(!checkIn);
  const [sleepHours, setSleep] = useState(checkIn?.sleepHours ?? 7);
  const [energy, setEnergy] = useState<DayEnergy>(checkIn?.energy ?? "ok");
  const [availableMin, setMin] = useState(checkIn?.availableMin ?? 60);
  const [noEquipment, setNoEq] = useState(checkIn?.noEquipment ?? false);
  const [soreness, setSoreness] = useState(checkIn?.soreness ?? 3);
  const [stress, setStress] = useState(checkIn?.stress ?? 3);
  const [notes, setNotes] = useState(checkIn?.notes ?? "");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const primaryHref =
    primaryAction?.href === "/treino"
      ? "/treino"
      : primaryAction?.href === "/nutricao"
        ? "/nutricao"
        : primaryAction?.href === "/suplementos"
          ? "/suplementos"
          : primaryAction?.href === "/coach"
            ? "/coach"
            : primaryAction?.href === "/"
              ? "/"
              : null;

  return (
    <>
      {!checkIn || checkOpen ? (
        <section className="surface-glass mb-4 space-y-3 p-4">
          <p className="eyebrow">Check-in de hoje</p>
          <p className="text-sm text-muted-foreground">3 toques — o plano se adapta.</p>
          <div className="flex flex-wrap gap-2">
            {[5, 6, 7, 8, 9].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setSleep(h)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  sleepHours === h ? "border-primary bg-primary/15 text-primary" : "border-white/10",
                )}
              >
                {h}h sono
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["baixa", "Energia baixa"],
                ["ok", "Energia ok"],
                ["alta", "Energia alta"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setEnergy(k)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  energy === k ? "border-primary bg-primary/15 text-primary" : "border-white/10",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[25, 40, 60, 90].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMin(m)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  availableMin === m ? "border-primary bg-primary/15 text-primary" : "border-white/10",
                )}
              >
                {m} min
              </button>
            ))}
            <button
              type="button"
              onClick={() => setNoEq((v) => !v)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                noEquipment ? "border-primary bg-primary/15 text-primary" : "border-white/10",
              )}
            >
              Sem equipamento
            </button>
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-primary"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            {advancedOpen ? "Ocultar detalhes" : "Dor, estresse e notas (opcional)"}
          </button>
          {advancedOpen ? (
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Dor muscular (1–5)</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={`sore-${n}`}
                      type="button"
                      onClick={() => setSoreness(n)}
                      className={cn(
                        "size-8 rounded-full border text-xs font-semibold",
                        soreness === n ? "border-primary bg-primary/15 text-primary" : "border-white/10",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Estresse (1–5)</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={`stress-${n}`}
                      type="button"
                      onClick={() => setStress(n)}
                      className={cn(
                        "size-8 rounded-full border text-xs font-semibold",
                        stress === n ? "border-primary bg-primary/15 text-primary" : "border-white/10",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Notas</p>
                <input
                  type="text"
                  value={notes}
                  maxLength={280}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex.: viagem, prova, dor no joelho…"
                  className="h-10 w-full rounded-lg border border-white/10 bg-transparent px-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
          ) : null}
          <Button
            className="h-11 w-full font-bold uppercase tracking-wide"
            onClick={() => {
              onSaveCheckIn({
                sleepHours,
                energy,
                availableMin,
                ...(noEquipment ? { noEquipment: true } : {}),
                soreness,
                stress,
                ...(notes.trim() ? { notes: notes.trim().slice(0, 280) } : {}),
              });
              setCheckOpen(false);
            }}
          >
            Atualizar plano de hoje
          </Button>
        </section>
      ) : (
        <button
          type="button"
          className="mb-3 text-left text-xs font-semibold text-primary"
          onClick={() => setCheckOpen(true)}
        >
          Editar check-in ({checkIn.sleepHours}h · {checkIn.energy} · {checkIn.availableMin} min)
        </button>
      )}

      <section className="surface-glass relative mb-4 overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Seu estado</p>
              <p className="text-display text-glow mt-1 text-4xl text-primary">{plan.score}</p>
              <p className="text-xs text-muted-foreground">Performance / 100</p>
            </div>
            <div className="space-y-1.5 text-right text-xs">
              {(
                [
                  ["Treinamento", plan.traffic.training],
                  ["Nutrição", plan.traffic.nutrition],
                  ["Recuperação", plan.traffic.recovery],
                  ["Consistência", plan.traffic.consistency],
                ] as const
              ).map(([label, light]) => (
                <div key={label} className="flex items-center justify-end gap-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cn("size-2.5 rounded-full", TRAFFIC[light])} />
                </div>
              ))}
            </div>
          </div>

          {plan.blocker ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Maior freio agora: <span className="font-semibold text-foreground">{plan.blocker.label}</span> (
              {plan.blocker.score}/100)
            </p>
          ) : null}

          <p className="mt-4 text-sm leading-relaxed text-foreground">{plan.narrative}</p>

          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary"
            onClick={() => setWhyOpen(true)}
          >
            <HelpCircle className="size-3.5" /> Por quê?
          </button>

          {primaryAction && primaryHref ? (
            <Link
              to={primaryHref}
              className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3"
              onClick={() => onPrimaryAction?.()}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  O que fazer agora
                </p>
                <p className="truncate text-sm font-semibold text-foreground">{primaryAction.title}</p>
                <p className="truncate text-xs text-muted-foreground">{primaryAction.reason}</p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-primary">Ir</span>
            </Link>
          ) : null}

          <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
            <p className="eyebrow">O que fazer hoje</p>

            <div className="flex items-start gap-3">
              <Play className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  Treino · {doneToday ? "concluído" : plan.workout.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plan.workout.mode} · ~{plan.workout.estimatedMin} min · volume{" "}
                  {Math.round(plan.workout.volumeFactor * 100)}%
                </p>
                {!doneToday && plan.workout.dayId && plan.workout.mode !== "rest" ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <Link
                      to="/treino/sessao/$id"
                      params={{ id: plan.workout.dayId.replace(/-express$/, "") }}
                      search={{ express: plan.workout.mode === "express" }}
                    >
                      <Button size="sm" className="w-full font-bold uppercase tracking-wide">
                        {plan.workout.mode === "express" ? (
                          <>
                            <Zap className="size-3.5" /> Express
                          </>
                        ) : (
                          <>
                            <Play className="size-3.5" /> Iniciar
                          </>
                        )}
                      </Button>
                    </Link>
                  </div>
                ) : null}
                {plan.workout.mode === "rest" ? (
                  <Link to="/treino" className="mt-2 block">
                    <Button size="sm" variant="secondary" className="w-full">
                      Ver semana
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Utensils className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">
                  Nutrição · {plan.nutrition.kcal} kcal · {plan.nutrition.proteinG} g proteína
                </p>
                <p className="text-xs text-muted-foreground">
                  Água {plan.nutrition.waterMl} ml
                  {plan.nutrition.skipBreakfast ? " · sem café (redistribuído)" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Pill className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Suplementação</p>
                <p className="text-xs text-muted-foreground">
                  {plan.supplements.length
                    ? plan.supplements.map((s) => s.name).join(" · ")
                    : "Nenhum stack hoje"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Moon className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Recuperação · {plan.sleepTargetHours}h de sono</p>
                <p className="text-xs text-muted-foreground">Meta de hoje para fechar o loop.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <BookOpen className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Hábito · {plan.habits.title}</p>
                <p className="text-xs text-muted-foreground">{plan.habits.tip}</p>
              </div>
            </div>
          </div>

          {plan.diffFromYesterday.length ? (
            <p className="mt-4 text-[0.65rem] text-muted-foreground">
              vs ontem: {plan.diffFromYesterday.join(" · ")}
            </p>
          ) : null}
        </div>
      </section>

      <SoldiersOverlay open={whyOpen} onClose={() => setWhyOpen(false)} title="Por que o plano de hoje?">
        {plan.whyByChange?.length ? (
          <ul className="mb-4 space-y-2 text-sm text-muted-foreground">
            {plan.whyByChange.map((item) => (
              <li
                key={item.key}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-foreground"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {item.label}
                </p>
                <p className="mt-0.5">{item.reason}</p>
              </li>
            ))}
          </ul>
        ) : null}
        <ul className="space-y-2 text-sm text-muted-foreground">
          {plan.why.map((w) => (
            <li key={w} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-foreground">
              {w}
            </li>
          ))}
        </ul>
        <Link to="/coach" className="mt-4 block" onClick={() => setWhyOpen(false)}>
          <Button className="w-full">Perguntar ao coach</Button>
        </Link>
      </SoldiersOverlay>
    </>
  );
}
