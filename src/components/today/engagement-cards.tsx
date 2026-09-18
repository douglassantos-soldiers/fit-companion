import { Link } from "@tanstack/react-router";
import { Check, Flame, Sparkles, Trophy, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DAILY_XP_GOAL } from "@/lib/types";
import { questById, isQuestComplete, questProgressValue } from "@/data/daily-quests";
import type { AppState } from "@/lib/types";

export function XpBar({ xp, className }: { xp: number; className?: string }) {
  const pct = Math.min(100, Math.round((xp / DAILY_XP_GOAL) * 100));
  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">XP do dia</span>
        <span className="text-muted-foreground">
          {xp}/{DAILY_XP_GOAL}
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

export function DailyQuestsCard({ state }: { state: AppState }) {
  const ids = state.dailyQuestIds ?? [];
  if (ids.length < 3) return null;
  const done = ids.filter((id) => {
    const q = questById(id);
    return q ? isQuestComplete(state, q) : false;
  }).length;

  return (
    <section className="surface-glass p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow">Missões de hoje</p>
        <span className="text-xs text-muted-foreground">{done}/3</span>
      </div>
      <ul className="space-y-2">
        {ids.map((id) => {
          const q = questById(id);
          if (!q) return null;
          const progress = questProgressValue(state, q);
          const complete = progress >= q.target;
          return (
            <li key={id} className="flex items-center gap-2 text-sm">
              <span
                className={`flex size-5 items-center justify-center rounded-full ${
                  complete ? "bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground"
                }`}
              >
                {complete ? <Check className="size-3" /> : null}
              </span>
              <span className={complete ? "text-muted-foreground line-through" : "font-medium"}>
                {q.title}
              </span>
              <span className="ml-auto text-[0.65rem] text-muted-foreground">
                {Math.min(progress, q.target)}/{q.target}
              </span>
            </li>
          );
        })}
      </ul>
      {done === 3 ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-primary">
          <Sparkles className="size-3.5" /> Bônus +5 XP liberado
        </p>
      ) : null}
    </section>
  );
}

export function SessionCelebration({
  open,
  onClose,
  xpGained,
  xpTotal,
  streak,
  questsDone,
  questsTotal,
  upsell,
  onUpsellClick,
  onUpsellDismiss,
}: {
  open: boolean;
  onClose: () => void;
  xpGained: number;
  xpTotal: number;
  streak: number;
  questsDone: number;
  questsTotal: number;
  upsell?: { name: string; url: string } | null;
  onUpsellClick?: () => void;
  onUpsellDismiss?: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="surface-glass w-full max-w-md p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="eyebrow">Treino salvo</p>
            <h2 className="text-display text-2xl">Missão cumprida</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4 text-primary" />
            <span>
              +{xpGained} XP · meta {xpTotal}/{DAILY_XP_GOAL}
            </span>
          </div>
          <XpBar xp={xpTotal} />
          <div className="flex items-center gap-2 text-sm">
            <Flame className="size-4 text-primary" />
            <span>Streak {streak}d</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Missões {questsDone}/{questsTotal}
          </p>
          {upsell ? (
            <div className="rounded-xl border border-primary/25 bg-primary/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Recuperação</p>
              <p className="mt-1 text-sm">Complemente com {upsell.name} na Soldiers.</p>
              <div className="mt-2 flex gap-2">
                <a
                  href={upsell.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1"
                  onClick={() => onUpsellClick?.()}
                >
                  <Button className="w-full" size="sm" variant="default">
                    Ver na loja
                  </Button>
                </a>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    onUpsellDismiss?.();
                  }}
                >
                  Agora não
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex gap-2">
          <Link to="/social" search={{ tab: "desafios" }} className="flex-1" onClick={onClose}>
            <Button className="w-full" variant="secondary">
              <Users className="size-4" /> Social
            </Button>
          </Link>
          <Link to="/desafios" className="flex-1" onClick={onClose}>
            <Button className="w-full" variant="outline">
              <Trophy className="size-4" /> Desafio
            </Button>
          </Link>
        </div>
        <Button className="mt-2 w-full" onClick={onClose}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
