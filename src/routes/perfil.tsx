import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { performanceDimensions, performanceScore, streak } from "@/lib/engine/dimensions";
import { useStore } from "@/lib/store";
import { GOAL_LABEL, LEVEL_LABEL } from "@/lib/types";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Soldiers Performance OS" },
      {
        name: "description",
        content: "Seus dados, objetivo, nível e preferências do plano de treino.",
      },
      { property: "og:title", content: "Perfil de performance" },
      { property: "og:description", content: "Objetivo, nível, medidas e histórico do app." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { state, hydrated, reset } = useStore();

  if (!hydrated || !state.profile) {
    return (
      <AppShell title="Perfil">
        <div className="surface-card h-40 animate-pulse" />
      </AppShell>
    );
  }

  const p = state.profile;
  const dims = performanceDimensions(state, p);

  const rows: Array<[string, string]> = [
    ["Objetivo", GOAL_LABEL[p.goal]],
    ["Nível", LEVEL_LABEL[p.level]],
    ["Dias por semana", `${p.daysPerWeek}`],
    ["Onde treina", p.equipment === "casa" ? "Casa" : "Academia"],
    ["Idade", `${p.age} anos`],
    ["Altura", `${p.heightCm} cm`],
    ["Peso atual", `${p.weightKg} kg`],
    ["Limitações", p.restrictions.length ? p.restrictions.join(", ") : "Nenhuma"],
  ];

  return (
    <AppShell title={p.name} subtitle={`Score ${performanceScore(dims)}/100 · streak de ${streak(state.sessions)} dia(s)`}>
      <section className="surface-card divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold">{value}</span>
          </div>
        ))}
      </section>

      <section className="surface-card mt-4 grid grid-cols-3 gap-3 p-5 text-center">
        <Stat label="Treinos" value={state.sessions.length} />
        <Stat label="Desafios" value={state.challenges.length} />
        <Stat
          label="Volume total"
          value={Math.round(state.sessions.reduce((s, x) => s + x.volumeKg, 0) / 1000)}
          suffix="t"
        />
      </section>

      <div className="mt-4 space-y-2">
        <Button variant="secondary" className="h-12 w-full" onClick={() => navigate({ to: "/onboarding" })}>
          Refazer meu perfil
        </Button>
        <Button
          variant="secondary"
          className="h-12 w-full text-destructive"
          onClick={() => {
            if (window.confirm("Apagar todos os dados salvos neste aparelho?")) {
              reset();
              toast.success("Dados apagados");
              navigate({ to: "/onboarding" });
            }
          }}
        >
          <RotateCcw className="size-4" /> Reiniciar dados
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Nesta versão tudo fica salvo apenas neste aparelho, sem cadastro.
      </p>
    </AppShell>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <p className="text-display text-2xl text-primary">
        {value}
        {suffix ?? ""}
      </p>
      <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
