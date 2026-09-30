import { Link } from "@tanstack/react-router";
import { Bell, Check, ChevronRight, Flame, Sparkles, Trophy, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { postWorkoutCoachSeed, seedCoachQuestion } from "@/lib/coach/seed";
import { DAILY_XP_GOAL } from "@/lib/types";
import {
  questById,
  isQuestComplete,
  questProgressValue,
  type QuestKind,
} from "@/data/daily-quests";
import type { AppState } from "@/lib/types";
import {
  PUSH_AFTER_FIRST_BODY,
  PUSH_AFTER_FIRST_TITLE,
  SHARE_FIRST_WORKOUT,
} from "@/lib/ui/platform-copy";
import { trackHomeSurface } from "@/lib/home/track-home-surface";

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

function questCta(kind: QuestKind): {
  label: string;
  to?: "/treino" | "/nutricao" | "/coach" | "/social" | "/";
  search?: { tab: string };
} | null {
  switch (kind) {
    case "train":
      return { label: "Treinar", to: "/treino" };
    case "protein80":
    case "meals2":
      return { label: "Comer", to: "/nutricao" };
    case "water":
      return { label: "Água", to: "/" };
    case "supplements":
      return { label: "Doses", to: "/nutricao", search: { tab: "doses" } };
    case "coach":
      return { label: "Coach", to: "/coach" };
    case "kudos":
    case "share":
    case "follow":
      return { label: "Social", to: "/social", search: { tab: "feed" } };
    case "xp_goal":
      return { label: "Ver dia", to: "/" };
    default:
      return null;
  }
}

export function DailyQuestsCard({
  state,
  onWaterQuest,
}: {
  state: AppState;
  /** When water quest is incomplete, prefer local +500ml over navigating away. */
  onWaterQuest?: () => void;
}) {
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
          const cta = !complete ? questCta(q.kind) : null;
          return (
            <li key={id} className="flex items-center gap-2 text-sm">
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                  complete ? "bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground"
                }`}
              >
                {complete ? <Check className="size-3" /> : null}
              </span>
              <span
                className={
                  complete
                    ? "min-w-0 flex-1 text-muted-foreground line-through"
                    : "min-w-0 flex-1 font-medium"
                }
              >
                {q.title}
              </span>
              <span className="shrink-0 text-[0.65rem] text-muted-foreground">
                {Math.min(progress, q.target)}/{q.target}
              </span>
              {cta ? (
                q.kind === "water" && onWaterQuest ? (
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-0.5 text-[0.65rem] font-semibold text-primary"
                    onClick={() => {
                      trackHomeSurface("home_block_click", { blockId: "quest", questId: q.id });
                      onWaterQuest();
                    }}
                  >
                    {cta.label}
                    <ChevronRight className="size-3" />
                  </button>
                ) : cta.to ? (
                  <Link
                    to={cta.to}
                    {...(cta.search ? { search: cta.search as never } : {})}
                    className="inline-flex shrink-0 items-center gap-0.5 text-[0.65rem] font-semibold text-primary"
                    onClick={() =>
                      trackHomeSurface("home_block_click", { blockId: "quest", questId: q.id })
                    }
                  >
                    {cta.label}
                    <ChevronRight className="size-3" />
                  </Link>
                ) : null
              ) : null}
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
  nextHint,
  upsell,
  onUpsellClick,
  onUpsellDismiss,
  unlocked,
  rankLabel,
  pushPrompt,
  onEnablePush,
  onDismissPush,
  shareFirst,
  onShareFirst,
  onPublishFeed,
  showCoachCta,
  coachSeedTitle,
  coachSeedRpe,
}: {
  open: boolean;
  onClose: () => void;
  xpGained: number;
  xpTotal: number;
  streak: number;
  questsDone: number;
  questsTotal: number;
  nextHint?: string | null;
  upsell?: { name: string; url: string } | null;
  onUpsellClick?: () => void;
  onUpsellDismiss?: () => void;
  unlocked?: string[];
  rankLabel?: string | null;
  pushPrompt?: boolean;
  onEnablePush?: () => void;
  onDismissPush?: () => void;
  shareFirst?: boolean;
  onShareFirst?: () => void;
  onPublishFeed?: () => void;
  /** Post-workout Coach discovery (activation). */
  showCoachCta?: boolean;
  /** Session title for post-workout coach seed. */
  coachSeedTitle?: string | null;
  /** Session RPE for post-workout coach seed. */
  coachSeedRpe?: string | null;
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground"
            aria-label="Fechar"
          >
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
          {rankLabel ? <p className="text-sm font-semibold text-primary">{rankLabel}</p> : null}
          {unlocked?.length ? (
            <p className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold">
              <Trophy className="mr-1 inline size-4" />
              {unlocked.join(" · ")}
            </p>
          ) : null}
          <Link to="/progresso">
            <Button variant="secondary" className="h-10 w-full">
              Ver meu progresso
            </Button>
          </Link>
          {showCoachCta ? (
            <Link
              to="/coach"
              onClick={() => {
                seedCoachQuestion(
                  postWorkoutCoachSeed({
                    title: coachSeedTitle,
                    rpe: coachSeedRpe,
                  }),
                );
                onClose();
              }}
            >
              <Button className="h-10 w-full font-bold uppercase tracking-wide">
                Revisar com o Coach
              </Button>
            </Link>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Missões {questsDone}/{questsTotal}
          </p>
          {nextHint ? (
            <p className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-foreground">
              {nextHint}
            </p>
          ) : null}
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
          {pushPrompt ? (
            <div className="rounded-xl border border-primary/25 bg-primary/10 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Bell className="size-4 text-primary" />
                {PUSH_AFTER_FIRST_TITLE}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{PUSH_AFTER_FIRST_BODY}</p>
              <div className="mt-2 flex gap-2">
                <Button className="flex-1" size="sm" onClick={() => onEnablePush?.()}>
                  Quero o lembrete
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onDismissPush?.()}>
                  Agora não
                </Button>
              </div>
            </div>
          ) : null}
          {shareFirst ? (
            <Button className="w-full" size="sm" variant="outline" onClick={() => onShareFirst?.()}>
              {SHARE_FIRST_WORKOUT}
            </Button>
          ) : null}
          {onPublishFeed ? (
            <Button className="w-full" size="sm" onClick={() => onPublishFeed()}>
              Publicar no feed
            </Button>
          ) : null}
        </div>
        <div className="mt-4 flex gap-2">
          <Link to="/social" search={{ tab: "desafios" }} className="flex-1" onClick={onClose}>
            <Button className="w-full" variant="secondary">
              <Users className="size-4" /> Social
            </Button>
          </Link>
          <Link to="/social" search={{ tab: "desafios" }} className="flex-1" onClick={onClose}>
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
