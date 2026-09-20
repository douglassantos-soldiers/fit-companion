import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, HelpCircle, Moon, Pill, Play, ThumbsDown, ThumbsUp, Utensils, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import { isAppPath, parseSessionHref } from "@/lib/training/session-nav";
import type {
  DayCheckIn,
  DayEnergy,
  LivingPlanFeedback,
  LivingPlanFeedbackReason,
  LivingPlanFeedbackVote,
  LivingPlanSnapshot,
} from "@/lib/types";
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

export type LivingPlanEatAction = {
  title: string;
  hint: string;
  servings: number;
  onServings: (n: number) => void;
  onApply: () => void;
  onRegister: () => void;
  onRepeatLast?: () => void;
  repeatLabel?: string;
};

const FEEDBACK_REASONS: Array<{ id: LivingPlanFeedbackReason; label: string }> = [
  { id: "tempo", label: "Não tenho tempo" },
  { id: "equipamento", label: "Equipamento" },
  { id: "nao_faz_sentido", label: "Não faz sentido" },
  { id: "outro", label: "Outro" },
];

export function LivingPlanHero({
  plan,
  doneToday,
  checkIn,
  onSaveCheckIn,
  primaryAction,
  onPrimaryAction,
  eatAction,
  defaultAvailableMin = 60,
  feedback,
  onFeedback,
}: {
  plan: LivingPlanSnapshot;
  doneToday: boolean;
  checkIn: DayCheckIn | undefined;
  onSaveCheckIn: (c: Omit<DayCheckIn, "date">) => void;
  primaryAction?: LivingPlanPrimaryAction | null;
  onPrimaryAction?: () => void;
  eatAction?: LivingPlanEatAction | null;
  defaultAvailableMin?: number;
  feedback?: LivingPlanFeedback | null;
  onFeedback?: (vote: LivingPlanFeedbackVote, reason?: LivingPlanFeedbackReason) => void;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [sleepHours, setSleep] = useState(checkIn?.sleepHours ?? 7);
  const [energy, setEnergy] = useState<DayEnergy>(checkIn?.energy ?? "ok");
  const [availableMin, setMin] = useState(checkIn?.availableMin ?? defaultAvailableMin);
  const [downOpen, setDownOpen] = useState(false);
  const [noEquipment, setNoEq] = useState(checkIn?.noEquipment ?? false);
  const [soreness, setSoreness] = useState(checkIn?.soreness ?? 3);
  const [stress, setStress] = useState(checkIn?.stress ?? 3);
  const [notes, setNotes] = useState(checkIn?.notes ?? "");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const sessionNav = parseSessionHref(primaryAction?.href);
  const primaryPath = !sessionNav && isAppPath(primaryAction?.href) ? primaryAction.href : null;
  const workoutDayId = plan.workout.dayId?.replace(/-express$/, "") ?? null;
  const workoutExpress = plan.workout.mode === "express";
  const persistCheck = (patch: Partial<Omit<DayCheckIn, "date">> = {}) => {
    const lunchOutToday = "lunchOutToday" in patch ? Boolean(patch.lunchOutToday) : Boolean(checkIn?.lunchOutToday);
    const skippedSlots = "skippedSlots" in patch ? patch.skippedSlots : checkIn?.skippedSlots;
    onSaveCheckIn({
      sleepHours: patch.sleepHours ?? sleepHours,
      energy: patch.energy ?? energy,
      availableMin: patch.availableMin ?? availableMin,
      ...((patch.noEquipment ?? noEquipment) ? { noEquipment: true } : {}),
      soreness: patch.soreness ?? soreness,
      stress: patch.stress ?? stress,
      ...((patch.notes ?? notes).trim() ? { notes: (patch.notes ?? notes).trim().slice(0, 280) } : {}),
      ...(checkIn?.equipment ? { equipment: checkIn.equipment } : {}),
      ...(checkIn?.acceptedTrainingMode ? { acceptedTrainingMode: checkIn.acceptedTrainingMode } : {}),
      ...(lunchOutToday ? { lunchOutToday: true } : {}),
      ...(Array.isArray(skippedSlots) ? { skippedSlots } : {}),
    });
  };

  return (
    <>
      <section className="surface-glass relative mb-4 overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">
                {plan.workout.mode === "rest"
                  ? "Hoje: proteína e rest"
                  : `Hoje: treinar ~${plan.workout.estimatedMin} min`}
              </p>
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

          {plan.how ? (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Como: </span>
              {plan.how}
            </p>
          ) : null}

          {plan.confidenceLabel ? (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Confiança: </span>
              {plan.confidenceLabel === "alta"
                ? "Alta"
                : plan.confidenceLabel === "media"
                  ? "Média"
                  : "Baixa"}
              {typeof plan.confidence === "number"
                ? ` (${Math.round(plan.confidence * 100)}%)`
                : ""}
            </p>
          ) : null}

          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary"
            onClick={() => setWhyOpen(true)}
          >
            <HelpCircle className="size-3.5" /> Por quê?
          </button>

          {(() => {
            const showTrain = !doneToday && Boolean(workoutDayId) && plan.workout.mode !== "rest";
            if (showTrain) return null;
            if (sessionNav) {
              return (
                <Link
                  to="/treino/sessao/$id"
                  params={{ id: sessionNav.id }}
                  search={{ express: sessionNav.express, from: "hoje" }}
                  className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3"
                  onClick={() => onPrimaryAction?.()}
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      O que fazer agora
                    </p>
                    <p className="truncate text-sm font-semibold text-foreground">{primaryAction?.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{primaryAction?.reason}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-primary">Ir</span>
                </Link>
              );
            }
            if (primaryAction && primaryPath) {
              return (
                <Link
                  to={primaryPath}
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
              );
            }
            return null;
          })()}

          {!doneToday && workoutDayId && plan.workout.mode !== "rest" ? (
            <Link
              to="/treino/sessao/$id"
              params={{ id: workoutDayId }}
              search={{ express: workoutExpress, from: "hoje" }}
              className="mt-4 block"
            >
              <Button className="glow-primary h-14 w-full font-bold uppercase tracking-wide">
                {workoutExpress ? <Zap className="size-4" /> : <Play className="size-4" />}
                {workoutExpress ? "Começar Express" : "Treinar agora"}
                <span className="ml-1 font-normal normal-case tracking-normal opacity-80">
                  · {plan.workout.estimatedMin} min
                </span>
              </Button>
            </Link>
          ) : eatAction ? (
            <div className="mt-4 space-y-2">
              <Button className="glow-primary h-14 w-full font-bold uppercase tracking-wide" onClick={eatAction.onApply}>
                <Utensils className="size-4" /> Comer agora
                <span className="ml-1 font-normal normal-case tracking-normal opacity-80">· {eatAction.title}</span>
              </Button>
              <p className="text-xs text-muted-foreground">{eatAction.hint}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/10 px-2 py-1 text-xs"
                  onClick={() => eatAction.onServings(Math.max(0.25, eatAction.servings - 0.25))}
                >
                  −
                </button>
                <span className="text-xs font-semibold">{eatAction.servings}×</span>
                <button
                  type="button"
                  className="rounded-full border border-white/10 px-2 py-1 text-xs"
                  onClick={() => eatAction.onServings(Math.min(3, eatAction.servings + 0.25))}
                >
                  +
                </button>
                {eatAction.onRepeatLast ? (
                  <Button size="sm" variant="outline" className="ml-auto" onClick={eatAction.onRepeatLast}>
                    {eatAction.repeatLabel ?? "Igual ontem"}
                  </Button>
                ) : (
                  <button
                    type="button"
                    className="ml-auto text-xs font-semibold text-primary underline"
                    onClick={eatAction.onRegister}
                  >
                    Outra refeição
                  </button>
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Quanto tempo você tem?
            </p>
            <div className="flex flex-wrap gap-2">
              {[30, 45, 60, 90].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMin(m);
                    persistCheck({ availableMin: m });
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold",
                    availableMin === m ? "border-primary bg-primary/15 text-primary" : "border-white/10",
                  )}
                >
                  {m} min
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`mt-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                checkIn?.lunchOutToday ? "border-primary bg-primary/15 text-primary" : "border-white/10"
              }`}
              onClick={() => persistCheck({ lunchOutToday: !checkIn?.lunchOutToday })}
            >
              Hoje almoço fora
            </button>
            <button
              type="button"
              className="mt-2 text-left text-xs font-semibold text-primary"
              onClick={() => setCheckOpen((v) => !v)}
            >
              {checkIn
                ? `Ajustar check-in (${checkIn.sleepHours}h · ${checkIn.energy})`
                : "Sono e energia (opcional)"}
            </button>
            {checkOpen ? (
              <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
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
                <button
                  type="button"
                  className="block text-xs font-semibold text-primary"
                  onClick={() => setAdvancedOpen((v) => !v)}
                >
                  {advancedOpen ? "Ocultar detalhes" : "Dor, estresse e notas"}
                </button>
                {advancedOpen ? (
                  <div className="space-y-3">
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
                    <input
                      type="text"
                      value={notes}
                      maxLength={280}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex.: viagem, prova, dor no joelho…"
                      className="h-10 w-full rounded-lg border border-white/10 bg-transparent px-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                ) : null}
                <Button
                  className="h-10 w-full font-bold uppercase tracking-wide"
                  onClick={() => {
                    persistCheck();
                    setCheckOpen(false);
                  }}
                >
                  Atualizar plano
                </Button>
              </div>
            ) : null}
          </div>

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
              <Link to="/nutricao" className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  Nutrição · {plan.nutrition.kcal} kcal · {plan.nutrition.proteinG} g proteína
                </p>
                <p className="text-xs text-muted-foreground">
                  Água {plan.nutrition.waterMl} ml
                  {plan.nutrition.skipBreakfast ? " · sem café (redistribuído)" : ""}
                </p>
              </Link>
            </div>

            <div className="flex items-start gap-3">
              <Pill className="mt-0.5 size-4 shrink-0 text-primary" />
              <Link to="/nutricao" search={{ tab: "doses" }} className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Suplementação</p>
                <p className="text-xs text-muted-foreground">
                  {plan.supplements.length
                    ? plan.supplements.map((s) => s.name).join(" · ")
                    : "Nenhum stack hoje"}
                </p>
              </Link>
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
                {plan.habits.contentId ? (
                  <Link
                    to="/conteudo/$id"
                    params={{ id: plan.habits.contentId }}
                    className="mt-1 inline-block text-[0.65rem] text-primary"
                  >
                    Ler conteúdo
                  </Link>
                ) : null}
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
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-semibold">Faz sentido?</p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant={feedback?.vote === "up" ? "default" : "secondary"}
              className="flex-1"
              onClick={() => onFeedback?.("up")}
            >
              <ThumbsUp className="size-4" /> Sim
            </Button>
            <Button
              size="sm"
              variant={feedback?.vote === "down" ? "default" : "secondary"}
              className="flex-1"
              onClick={() => setDownOpen(true)}
            >
              <ThumbsDown className="size-4" /> Não
            </Button>
          </div>
          {downOpen || feedback?.vote === "down" ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FEEDBACK_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onFeedback?.("down", r.id);
                    setDownOpen(false);
                  }}
                  className={`rounded-full border px-3 py-1 text-[0.7rem] font-semibold ${
                    feedback?.reason === r.id
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-white/10 text-muted-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <Link to="/coach" className="mt-4 block" onClick={() => setWhyOpen(false)}>
          <Button className="w-full">Perguntar ao coach</Button>
        </Link>
      </SoldiersOverlay>
    </>
  );
}
