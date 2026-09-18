import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SoldiersLogo } from "@/components/soldiers-logo";
import { performanceDimensions, performanceScore } from "@/lib/engine/dimensions";
import { emptyState, GOAL_LABEL, LEVEL_LABEL, BLOCKER_LABEL, type Equipment, type Goal, type Level, type PrimaryBlocker, type Profile } from "@/lib/types";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Monte seu perfil — Soldiers Performance OS" },
      {
        name: "description",
        content: "Objetivo, rotina, sono e o que mais te impede — plano adaptativo em minutos.",
      },
      { property: "og:title", content: "Monte seu perfil de performance" },
      { property: "og:description", content: "Descobrimos o que te impede, não só o objetivo." },
    ],
  }),
  component: Onboarding,
});

const RESTRICTIONS = ["Joelho", "Ombro", "Lombar", "Punho", "Nenhuma"];
const BLOCKERS = Object.keys(BLOCKER_LABEL) as PrimaryBlocker[];

function Onboarding() {
  const navigate = useNavigate();
  const { state, setProfile } = useStore();
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
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
  const [age, setAge] = useState(28);
  const [heightCm, setHeight] = useState(178);
  const [weightKg, setWeight] = useState(80);
  const [equipment, setEquipment] = useState<Equipment>("academia");
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [typicalSleepHours, setTypicalSleepHours] = useState(7);
  const [primaryBlocker, setPrimaryBlocker] = useState<PrimaryBlocker>("consistencia");
  const [skipBreakfast, setSkipBreakfast] = useState(false);
  const [lunchOutOften, setLunchOutOften] = useState(false);
  const [readyProfile, setReadyProfile] = useState<Profile | null>(null);

  const steps = ["Objetivo", "Nível", "Rotina", "Corpo", "Limites", "Contexto", "Perfil"];
  const collectLast = step === 5;
  const resultStep = step === 6;

  const dims = useMemo(() => {
    if (!readyProfile) return [];
    return performanceDimensions({ ...emptyState, profile: readyProfile }, readyProfile);
  }, [readyProfile]);

  const score = performanceScore(dims);

  const buildProfile = (): Profile => ({
    name: name.trim(),
    goal,
    level,
    daysPerWeek,
    age,
    heightCm,
    weightKg,
    equipment,
    restrictions,
    typicalSleepHours,
    primaryBlocker,
    skipBreakfast,
    lunchOutOften,
    createdAt: new Date().toISOString(),
  });

  const goToResult = () => {
    if (!name.trim()) return;
    const profile = buildProfile();
    setReadyProfile(profile);
    setProfile(profile);
    setStep(6);
  };

  const canContinueFromStep0 = name.trim().length >= 2;

  const goHome = () => navigate({ to: "/" });

  if (!started) {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/25 via-background to-background" />
        <div className="pointer-events-none absolute -left-24 top-20 size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-32 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-4 py-8">
          <SoldiersLogo />
          <div className="pb-8">
            <p className="eyebrow">Soldiers Performance OS</p>
            <h1 className="mt-3 text-display text-4xl leading-none">
              Seu plano de
              <span className="text-glow block text-primary"> performance</span>
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Não só o objetivo — descobrimos o que te impede de chegar lá.
            </p>
            <Button
              size="lg"
              className="glow-primary mt-8 h-14 w-full font-bold uppercase tracking-wide"
              onClick={() => setStarted(true)}
            >
              Começar <ArrowRight className="size-4" />
            </Button>
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
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary shadow-[0_0_10px_var(--glow-primary)]" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <p className="eyebrow mt-4">
          Passo {step + 1} de {steps.length}
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
            <h1 className="text-3xl">Seu nível de treino</h1>
            <p className="mt-2 text-sm text-muted-foreground">Usamos isso para calibrar as cargas iniciais.</p>
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
          </section>
        )}

        {step === 2 && (
          <section className="mt-3">
            <h1 className="text-3xl">Quantos dias por semana?</h1>
            <p className="mt-2 text-sm text-muted-foreground">Escolha o que você realmente consegue cumprir.</p>
            <div className="mt-5 grid grid-cols-5 gap-2">
              {[2, 3, 4, 5, 6].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`text-display rounded-xl border py-4 text-xl transition-colors ${
                    daysPerWeek === d
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  {d}
                </button>
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

        {step === 3 && (
          <section className="mt-3">
            <h1 className="text-3xl">Seus números</h1>
            <p className="mt-2 text-sm text-muted-foreground">Base para acompanhar sua evolução.</p>
            <div className="mt-5 space-y-4">
              <NumberField label="Idade" value={age} onChange={setAge} unit="anos" />
              <NumberField label="Altura" value={heightCm} onChange={setHeight} unit="cm" />
              <NumberField label="Peso" value={weightKg} onChange={setWeight} unit="kg" />
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="mt-3">
            <h1 className="text-3xl">Alguma limitação?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Selecione o que precisa de cuidado — evitamos sobrecarregar essas regiões.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {RESTRICTIONS.map((r) => {
                const active = restrictions.includes(r);
                return (
                  <button
                    key={r}
                    onClick={() =>
                      setRestrictions((prev) =>
                        r === "Nenhuma" ? [] : prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
                      )
                    }
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 5 && (
          <section className="mt-3">
            <h1 className="text-3xl">O que mais te impede?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O plano adapta a isso — não só ao objetivo.
            </p>
            <div className="mt-5 space-y-2">
              {BLOCKERS.map((b) => (
                <OptionCard
                  key={b}
                  selected={primaryBlocker === b}
                  onClick={() => setPrimaryBlocker(b)}
                  title={BLOCKER_LABEL[b]}
                />
              ))}
            </div>
            <h2 className="mt-8 text-xl">Sono típico</h2>
            <div className="mt-3">
              <NumberField
                label="Horas por noite"
                value={typicalSleepHours}
                onChange={(n) => setTypicalSleepHours(Math.min(12, Math.max(4, n)))}
                unit="h"
              />
            </div>
            <h2 className="mt-8 text-xl">Alimentação</h2>
            <div className="mt-3 space-y-2">
              <OptionCard
                selected={skipBreakfast}
                onClick={() => setSkipBreakfast((v) => !v)}
                title="Pulo o café da manhã"
                hint="Redistribuímos proteína no resto do dia"
              />
              <OptionCard
                selected={lunchOutOften}
                onClick={() => setLunchOutOften((v) => !v)}
                title="Almoço fora com frequência"
                hint="Priorizamos presets práticos no almoço"
              />
            </div>
          </section>
        )}

        {resultStep && readyProfile && (
          <section className="mt-3">
            <h1 className="text-3xl">Perfil de Performance</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Baseline para {readyProfile.name}. Bloqueio atual:{" "}
              {readyProfile.primaryBlocker ? BLOCKER_LABEL[readyProfile.primaryBlocker] : "—"}.
            </p>
            <div className="surface-glass mt-5 p-5">
              <p className="text-display text-glow text-4xl text-primary">{score}</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Score geral / 100</p>
              <ul className="mt-5 space-y-3">
                {dims.map((d) => (
                  <li key={d.key}>
                    <div className="flex justify-between text-sm">
                      <span>{d.label}</span>
                      <span className="text-muted-foreground">{d.score}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted/60">
                      <div
                        className="h-2 rounded-full bg-primary shadow-[0_0_10px_var(--glow-primary)] transition-all"
                        style={{ width: `${d.score}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <div className="mt-10 flex gap-3">
          {step > 0 && step < 6 && (
            <Button variant="secondary" className="h-12 flex-1" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="size-4" /> Voltar
            </Button>
          )}
          {resultStep ? (
            <Button className="glow-primary h-12 w-full font-bold uppercase tracking-wide" onClick={goHome}>
              Ir para Hoje <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              className="glow-primary h-12 flex-[2] font-bold uppercase tracking-wide"
              disabled={step === 0 && !canContinueFromStep0}
              onClick={() => (collectLast ? goToResult() : setStep((s) => s + 1))}
            >
              {collectLast ? (
                <>
                  Gerar meu perfil <Check className="size-4" />
                </>
              ) : (
                <>
                  Continuar <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
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

function NumberField({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit: string;
}) {
  return (
    <div className="surface-glass flex items-center justify-between p-4">
      <div>
        <p className="text-display text-base">{label}</p>
        <p className="text-xs text-muted-foreground">{unit}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="icon" onClick={() => onChange(Math.max(1, value - 1))} aria-label="Diminuir">
          <Minus className="size-4" />
        </Button>
        <span className="text-display w-12 text-center text-2xl">{value}</span>
        <Button variant="secondary" size="icon" onClick={() => onChange(value + 1)} aria-label="Aumentar">
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
