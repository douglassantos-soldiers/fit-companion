import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SoldiersLogo } from "@/components/soldiers-logo";
import { useStore } from "@/lib/store";
import { GOAL_LABEL, LEVEL_LABEL, type Equipment, type Goal, type Level } from "@/lib/types";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Monte seu perfil — Soldiers Performance OS" },
      {
        name: "description",
        content: "Responda 5 passos e receba um plano de treino personalizado com progressão de carga.",
      },
      { property: "og:title", content: "Monte seu perfil de performance" },
      { property: "og:description", content: "Objetivo, nível, dias por semana e equipamento em 5 passos." },
    ],
  }),
  component: Onboarding,
});

const RESTRICTIONS = ["Joelho", "Ombro", "Lombar", "Punho", "Nenhuma"];

function Onboarding() {
  const navigate = useNavigate();
  const { setProfile } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<Goal>("massa");
  const [level, setLevel] = useState<Level>("iniciante");
  const [daysPerWeek, setDays] = useState(3);
  const [age, setAge] = useState(28);
  const [heightCm, setHeight] = useState(178);
  const [weightKg, setWeight] = useState(80);
  const [equipment, setEquipment] = useState<Equipment>("academia");
  const [restrictions, setRestrictions] = useState<string[]>([]);

  const steps = ["Objetivo", "Nível", "Rotina", "Corpo", "Limites"];
  const last = step === steps.length - 1;

  const finish = () => {
    setProfile({
      name: name.trim() || "Soldado",
      goal,
      level,
      daysPerWeek,
      age,
      heightCm,
      weightKg,
      equipment,
      restrictions,
      createdAt: new Date().toISOString(),
    });
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <SoldiersLogo />

        <div className="mt-6 flex gap-1.5">
          {steps.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary">
          Passo {step + 1} de {steps.length}
        </p>

        {step === 0 && (
          <section className="mt-3">
            <h1 className="text-3xl">Qual é o seu objetivo?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Isso define o volume, as repetições e a progressão do seu plano.
            </p>
            <div className="mt-5 space-y-2">
              {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
                <OptionCard key={g} selected={goal === g} onClick={() => setGoal(g)} title={GOAL_LABEL[g]} />
              ))}
            </div>
            <div className="mt-6">
              <Label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground">
                Como quer ser chamado?
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="mt-2 h-12"
              />
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
                        r === "Nenhuma"
                          ? []
                          : prev.includes(r)
                            ? prev.filter((x) => x !== r)
                            : [...prev, r],
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

        <div className="mt-10 flex gap-3">
          {step > 0 && (
            <Button variant="secondary" className="h-12 flex-1" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="size-4" /> Voltar
            </Button>
          )}
          <Button
            className="h-12 flex-[2] font-bold uppercase tracking-wide"
            onClick={() => (last ? finish() : setStep((s) => s + 1))}
          >
            {last ? (
              <>
                Gerar meu plano <Check className="size-4" />
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
      className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors ${
        selected ? "border-primary bg-primary/10" : "border-border bg-card"
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
    <div className="surface-card flex items-center justify-between p-4">
      <div>
        <p className="text-display text-base">{label}</p>
        <p className="text-xs text-muted-foreground">{unit}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="icon" onClick={() => onChange(Math.max(1, value - 1))}>
          −
        </Button>
        <span className="text-display w-12 text-center text-2xl">{value}</span>
        <Button variant="secondary" size="icon" onClick={() => onChange(value + 1)}>
          +
        </Button>
      </div>
    </div>
  );
}
