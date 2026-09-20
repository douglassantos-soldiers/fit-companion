import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SoldiersLogo } from "@/components/soldiers-logo";
import {
  GOAL_LABEL,
  GYM_GEAR_LABEL,
  LEVEL_LABEL,
  type Equipment,
  type Goal,
  type GymGear,
  type Level,
  type Profile,
} from "@/lib/types";
import { SESSION_DURATION_LABEL, SESSION_DURATION_OPTIONS } from "@/lib/engine/session-time";
import { defaultInventory, GYM_GEAR_OPTIONS } from "@/lib/training/inventory";
import { resolveTrainingWeekdays, WEEKDAY_LABELS } from "@/lib/training/weekdays";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Monte seu treino — Soldiers Training" },
      {
        name: "description",
        content: "Objetivo, dias e equipamentos — o treino do dia em 3 passos.",
      },
      { property: "og:title", content: "Monte seu treino de performance" },
      { property: "og:description", content: "Três passos e o plano do dia está pronto." },
    ],
  }),
  component: Onboarding,
});

const STEPS = ["Objetivo", "Rotina", "Equipamentos"];

function Onboarding() {
  const navigate = useNavigate();
  const { state, setProfile, acceptLegal } = useStore();
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(state.shopifyDisplayName || state.profile?.name || "");
  const suggestedGoal = useMemo(() => {
    const ids = state.purchaseProductIds ?? [];
    if (!ids.length) return "massa" as Goal;
    if (ids.includes("termogenico")) return "gordura" as Goal;
    if (ids.includes("pre-treino") || ids.includes("creatina")) return "performance" as Goal;
    if (ids.includes("whey-protein") || ids.includes("beef-protein")) return "massa" as Goal;
    if (ids.includes("multivitaminico") || ids.includes("omega-3")) return "saude" as Goal;
    return "massa" as Goal;
  }, [state.purchaseProductIds]);
  const [goal, setGoal] = useState<Goal>(suggestedGoal);
  const [level, setLevel] = useState<Level>("iniciante");
  const [daysPerWeek, setDays] = useState(3);
  const [trainingWeekdays, setTrainingWeekdays] = useState<number[]>([1, 3, 5]);
  const [typicalSessionMin, setTypicalSessionMin] = useState<number>(60);
  const [equipment, setEquipment] = useState<Equipment>("academia");
  const [inventory, setInventory] = useState<GymGear[]>(() => defaultInventory("academia"));
  const [termsAck, setTermsAck] = useState(Boolean(state.termsAcceptedAt));
  const [privacyAck, setPrivacyAck] = useState(Boolean(state.privacyAcceptedAt));

  useEffect(() => {
    setInventory(defaultInventory(equipment));
  }, [equipment]);

  const lastStep = step === STEPS.length - 1;

  const buildProfile = (): Profile => ({
    name: name.trim(),
    goal,
    level,
    daysPerWeek: trainingWeekdays.length >= 2 ? trainingWeekdays.length : daysPerWeek,
    age: 0,
    heightCm: 0,
    weightKg: 0,
    equipment,
    restrictions: [],
    trainingWeekdays: resolveTrainingWeekdays({
      daysPerWeek,
      trainingWeekdays,
    }),
    equipmentInventory: inventory.length ? inventory : defaultInventory(equipment),
    typicalSessionMin,
    onboardingComplete: false,
    createdAt: new Date().toISOString(),
  });

  const finish = () => {
    if (!name.trim() || !termsAck || !privacyAck) return;
    acceptLegal("terms");
    acceptLegal("privacy");
    setProfile(buildProfile());
    navigate({ to: "/" });
  };

  const canContinue =
    step === 0
      ? name.trim().length >= 2
      : step === 2
        ? inventory.length > 0 && termsAck && privacyAck
        : true;

  const startWithDefaults = () => {
    setGoal(suggestedGoal);
    setLevel("iniciante");
    setDays(3);
    setTrainingWeekdays([1, 3, 5]);
    setTypicalSessionMin(60);
    setEquipment("academia");
    setInventory(defaultInventory("academia"));
    setStarted(true);
    setStep(STEPS.length - 1);
  };

  if (!started) {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/25 via-background to-background" />
        <div className="pointer-events-none absolute -left-24 top-20 size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-32 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-4 py-8">
          <SoldiersLogo />
          <div className="pb-8">
            <p className="eyebrow">Soldiers Training</p>
            <h1 className="mt-3 text-display text-4xl leading-none">
              Seu treino do dia em
              <span className="text-glow block text-primary"> 3 passos</span>
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Objetivo, dias e equipamentos. Corpo e preferências ficam no perfil — depois do primeiro treino.
            </p>
            <Button
              size="lg"
              className="glow-primary mt-8 h-14 w-full font-bold uppercase tracking-wide"
              onClick={() => setStarted(true)}
            >
              Começar <ArrowRight className="size-4" />
            </Button>
            {name.trim().length >= 2 ? (
              <Button
                size="lg"
                variant="secondary"
                className="mt-3 h-12 w-full font-bold uppercase tracking-wide"
                onClick={startWithDefaults}
              >
                Montar treino com padrão
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent" />
      <div className="pointer-events-none absolute -right-20 top-24 size-56 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative mx-auto w-full max-w-md px-4 py-6">
        <SoldiersLogo />

        <div className="mt-6 flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary shadow-[0_0_10px_var(--glow-primary)]" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <p className="eyebrow mt-4">
          Passo {step + 1} de {STEPS.length}
        </p>

        {step === 0 && (
          <section className="mt-3">
            <h1 className="text-3xl">Qual é o seu objetivo?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {state.purchaseProductIds?.length
                ? `Sugerimos ${GOAL_LABEL[suggestedGoal]} com base na sua compra Soldiers — você pode mudar.`
                : "Isso define o volume, as repetições e a progressão do seu plano."}
            </p>
            <div className="mt-5 space-y-2">
              {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
                <OptionCard key={g} selected={goal === g} onClick={() => setGoal(g)} title={GOAL_LABEL[g]} />
              ))}
            </div>
            <div className="mt-6">
              <Label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground">
                Como quer ser chamado? *
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="mt-2 h-12"
                required
              />
              {name.trim().length > 0 && name.trim().length < 2 ? (
                <p className="mt-1 text-xs text-destructive">Use pelo menos 2 caracteres</p>
              ) : null}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="mt-3">
            <h1 className="text-3xl">Sua rotina</h1>
            <p className="mt-2 text-sm text-muted-foreground">Nível, dias, tempo e onde você treina — o plano segue isso.</p>
            <div className="mt-5 space-y-2">
              {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                <OptionCard
                  key={l}
                  selected={level === l}
                  onClick={() => setLevel(l)}
                  title={LEVEL_LABEL[l]}
                  hint={
                    l === "iniciante"
                      ? "Até 6 meses de treino contínuo"
                      : l === "intermediario"
                        ? "6 meses a 2 anos"
                        : "Mais de 2 anos consistentes"
                  }
                />
              ))}
            </div>
            <h2 className="mt-8 text-xl">Quais dias você treina?</h2>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {WEEKDAY_LABELS.map((label, weekday) => {
                const on = trainingWeekdays.includes(weekday);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      setTrainingWeekdays((prev) => {
                        const next = prev.includes(weekday)
                          ? prev.filter((d) => d !== weekday)
                          : [...prev, weekday].sort((a, b) => a - b);
                        setDays(Math.min(6, Math.max(2, next.length || 3)));
                        return next;
                      })
                    }
                    className={`rounded-xl border py-3 text-[0.65rem] font-bold uppercase ${
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <h2 className="mt-8 text-xl">Quanto tempo você normalmente tem?</h2>
            <div className="mt-3 space-y-2">
              {SESSION_DURATION_OPTIONS.map((min) => (
                <OptionCard
                  key={min}
                  selected={typicalSessionMin === min}
                  onClick={() => setTypicalSessionMin(min)}
                  title={SESSION_DURATION_LABEL[min]}
                />
              ))}
            </div>
            <h2 className="mt-8 text-xl">Onde você treina?</h2>
            <div className="mt-3 space-y-2">
              <OptionCard
                selected={equipment === "academia"}
                onClick={() => setEquipment("academia")}
                title="Academia"
                hint="Barras, máquinas e halteres"
              />
              <OptionCard
                selected={equipment === "casa"}
                onClick={() => setEquipment("casa")}
                title="Casa"
                hint="Peso do corpo e equipamento mínimo"
              />
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="mt-3">
            <h1 className="text-3xl">Quais equipamentos?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Confirmamos o que você tem — o plano só usa o que está marcado.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {GYM_GEAR_OPTIONS.map((g) => {
                const on = inventory.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() =>
                      setInventory((prev) => (on ? prev.filter((x) => x !== g) : [...prev, g]))
                    }
                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {GYM_GEAR_LABEL[g]}
                  </button>
                );
              })}
            </div>
            {inventory.length === 0 ? (
              <p className="mt-3 text-xs text-destructive">Marque pelo menos um equipamento.</p>
            ) : null}
            <dl className="mt-6 space-y-3">
              <ReadyRow label="Objetivo" value={GOAL_LABEL[goal]} />
              <ReadyRow label="Frequência" value={`${trainingWeekdays.length || daysPerWeek}x / semana`} />
              <ReadyRow
                label="Tempo"
                value={SESSION_DURATION_LABEL[(typicalSessionMin as 30 | 45 | 60 | 90) ?? 60]}
              />
            </dl>
            <div className="mt-6 space-y-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-primary"
                  checked={termsAck}
                  onChange={(e) => setTermsAck(e.target.checked)}
                />
                <span>
                  Aceito os{" "}
                  <Link to="/termos" className="text-primary underline">
                    Termos de uso
                  </Link>
                  .
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-primary"
                  checked={privacyAck}
                  onChange={(e) => setPrivacyAck(e.target.checked)}
                />
                <span>
                  Li a{" "}
                  <Link to="/privacidade" className="text-primary underline">
                    Política de privacidade
                  </Link>
                  .
                </span>
              </label>
            </div>
          </section>
        )}

        <div className="mt-10 flex gap-3">
          {step > 0 ? (
            <Button variant="secondary" className="h-12 flex-1" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="size-4" /> Voltar
            </Button>
          ) : null}
          <Button
            className="glow-primary h-12 flex-[2] font-bold uppercase tracking-wide"
            disabled={!canContinue}
            onClick={() => (lastStep ? finish() : setStep((s) => s + 1))}
          >
            {lastStep ? (
              <>
                Montar meu treino <Check className="size-4" />
              </>
            ) : (
              <>
                Continuar <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReadyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card/50 px-4 py-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-display text-lg">{value}</p>
    </div>
  );
}

function OptionCard({
  title,
  hint,
  selected,
  onClick,
}: {
  title: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/10 shadow-[0_0_20px_var(--glow-primary)]"
          : "border-white/10 bg-card/50 backdrop-blur"
      }`}
    >
      <span>
        <span className="text-display block text-lg">{title}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <span
        className={`flex size-5 items-center justify-center rounded-full border ${
          selected ? "border-primary bg-primary" : "border-muted-foreground"
        }`}
      >
        {selected ? <Check className="size-3 text-primary-foreground" /> : null}
      </span>
    </button>
  );
}
