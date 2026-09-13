import { createFileRoute } from "@tanstack/react-router";
import { Medal, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { CHALLENGES, RANKING_NAMES, type Challenge } from "@/data/challenges";
import { sessionsInLastDays } from "@/lib/engine/dimensions";
import { useStore } from "@/lib/store";
import type { AppState } from "@/lib/types";

export const Route = createFileRoute("/desafios")({
  head: () => ({
    meta: [
      { title: "Desafios — Soldiers Performance OS" },
      {
        name: "description",
        content: "Entre em desafios de consistência e volume, acompanhe o progresso e conquiste badges.",
      },
      { property: "og:title", content: "Desafios Soldiers" },
      { property: "og:description", content: "Consistência, volume e semana perfeita com ranking." },
    ],
  }),
  component: ChallengesPage,
});

function progressFor(challenge: Challenge, state: AppState) {
  const sessions = sessionsInLastDays(state.sessions, challenge.durationDays);
  if (challenge.metric === "volume") return Math.round(sessions.reduce((s, x) => s + x.volumeKg, 0));
  return sessions.length;
}

function ChallengesPage() {
  const { state, hydrated, toggleChallenge } = useStore();

  if (!hydrated) {
    return (
      <AppShell title="Desafios">
        <div className="surface-card h-40 animate-pulse" />
      </AppShell>
    );
  }

  const joined = state.challenges;

  return (
    <AppShell title="Desafios" subtitle={`${joined.length} desafio(s) ativos`}>
      <div className="space-y-4">
        {CHALLENGES.map((c) => {
          const active = joined.includes(c.id);
          const value = progressFor(c, state);
          const pct = Math.min(100, (value / c.target) * 100);
          const complete = value >= c.target;

          return (
            <article key={c.id} className="surface-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl">{c.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                </div>
                {complete && active ? (
                  <span className="flex flex-col items-center text-primary">
                    <Medal className="size-7" />
                    <span className="text-[0.6rem] font-bold uppercase">Badge</span>
                  </span>
                ) : (
                  <Trophy className="size-6 text-muted-foreground" />
                )}
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {value.toLocaleString("pt-BR")} / {c.target.toLocaleString("pt-BR")} {c.unit}
                  </span>
                  <span>{c.durationDays} dias</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-4" /> {c.participants.toLocaleString("pt-BR")} participantes
                </span>
                <Button
                  size="sm"
                  variant={active ? "secondary" : "default"}
                  onClick={() => {
                    toggleChallenge(c.id);
                    toast.success(active ? "Você saiu do desafio" : `Bem-vindo ao ${c.title}`);
                  }}
                >
                  {active ? "Sair" : "Participar"}
                </Button>
              </div>

              {active ? (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-primary">Ranking</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {RANKING_NAMES.slice(0, 3).map((n, i) => (
                      <li key={n} className="flex justify-between text-muted-foreground">
                        <span>
                          {i + 1}. {n}
                        </span>
                        <span>{Math.round(c.target * (0.95 - i * 0.08)).toLocaleString("pt-BR")}</span>
                      </li>
                    ))}
                    <li className="flex justify-between font-semibold text-foreground">
                      <span>Você</span>
                      <span>{value.toLocaleString("pt-BR")}</span>
                    </li>
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
