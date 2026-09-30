import { Link } from "@tanstack/react-router";
import { Check, ExternalLink, Trophy } from "lucide-react";
import { toast } from "sonner";
import { SoldiersMediaThumb } from "@/components/soldiers-media-frame";
import { InviteFriendsButton } from "@/components/social/invite-friends";
import { Button } from "@/components/ui/button";
import {
  challengeById,
  isPersonalizedChallenge,
  isRelativeChallenge,
  type Challenge,
} from "@/data/challenges";
import { performanceUpgradeUrl } from "@/data/shopify-product-map";
import { challengeProgress } from "@/lib/social";
import { resolveChallengeMedia } from "@/lib/soldiers-media";
import type { AppState } from "@/lib/types";
import { PERFORMANCE_LOCK_BENEFITS, PERFORMANCE_LOCK_TITLE } from "@/lib/ui/platform-copy";
import { cn } from "@/lib/utils";

const PERFORMANCE_URL = performanceUpgradeUrl();

function progressFor(challengeId: string, state: AppState) {
  const challenge = challengeById(challengeId);
  if (!challenge) return null;
  const opts: import("@/lib/social").ChallengeProgressOpts = {
    activityLogs: state.activityLogs,
    invitesSent: state.challengeInvitesSent ?? 0,
  };
  const baseline = state.challengeBaselines?.[challengeId];
  if (baseline !== undefined) opts.baseline = baseline;
  const personalTarget = state.challengePersonalTargets?.[challengeId];
  if (personalTarget !== undefined) opts.personalTarget = personalTarget;
  return challengeProgress(challenge, state.sessions, opts);
}

function modeLabel(c: Challenge) {
  if (isRelativeChallenge(c)) return "% evolução";
  if (isPersonalizedChallenge(c)) return "Meta pessoal";
  if (c.requiresPerformance) return "Performance";
  return c.category;
}

export function ChallengeCard({
  c,
  state,
  joined,
  deviceId,
  toggleChallenge,
  variant = "compact",
  why,
}: {
  c: Challenge;
  state: AppState;
  joined: string[];
  deviceId: string;
  toggleChallenge: (id: string) => void;
  variant?: "featured" | "compact";
  why?: string;
}) {
  const active = joined.includes(c.id);
  const progress = progressFor(c.id, state);
  const relative = isRelativeChallenge(c);
  const personalized = isPersonalizedChallenge(c);
  const locked = c.requiresPerformance === true && (state.accessTier ?? "base") !== "performance";
  const featured = variant === "featured";

  const progressLabel = progress
    ? relative
      ? `${progress.displayValue >= 0 ? "+" : ""}${progress.displayValue}% / +${progress.displayTarget}%`
      : personalized
        ? `${progress.displayValue.toLocaleString("pt-BR")} / ${progress.displayTarget.toLocaleString("pt-BR")} ${progress.displayUnit} (${Math.round(progress.pct)}%)`
        : `${progress.displayValue.toLocaleString("pt-BR")} / ${progress.displayTarget.toLocaleString("pt-BR")} ${progress.displayUnit}`
    : "—";

  return (
    <div className="space-y-1">
      <article className={cn("surface-glass p-4", locked && "opacity-80", featured && "border-primary/30")}>
        {featured ? (
          <SoldiersMediaThumb
            media={resolveChallengeMedia(c.category)}
            alt={c.category}
            className="mb-3 aspect-[16/9] w-full rounded-xl"
          />
        ) : null}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            {!featured ? (
              <SoldiersMediaThumb
                media={resolveChallengeMedia(c.category)}
                alt={c.category}
                className="size-12 rounded-xl"
              />
            ) : null}
            <div className="min-w-0">
              <p className="eyebrow">{modeLabel(c)}</p>
              <h2 className={cn("mt-0.5 text-display", featured ? "text-2xl" : "text-xl")}>{c.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
            </div>
          </div>
          {!featured ? <Trophy className="size-5 shrink-0 text-muted-foreground" /> : null}
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[0.65rem] text-muted-foreground">
            <span>{progressLabel}</span>
            <span>{c.durationDays}d</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${progress?.barPct ?? 0}%` }}
            />
          </div>
        </div>
        <div className={cn("mt-3 flex gap-2", featured ? "flex-col" : "justify-end")}>
          {active ? (
            <Link to="/desafios" search={{ challenge: c.id }} className={featured ? "block" : undefined}>
              <Button size="sm" variant="secondary" className={featured ? "w-full" : undefined}>
                Ranking
              </Button>
            </Link>
          ) : null}
          {!locked || active ? (
            <Button
              size={featured ? "default" : "sm"}
              variant={active ? "secondary" : "default"}
              className={cn(featured && "h-11 w-full font-bold uppercase tracking-wide")}
              onClick={() => {
                if (!state.profile?.name?.trim()) {
                  toast.error("Defina seu nome no Perfil para participar");
                  return;
                }
                toggleChallenge(c.id);
                toast.success(active ? "Saiu do desafio" : "Entrou no desafio");
              }}
            >
              {active ? "Sair" : "Entrar"}
            </Button>
          ) : null}
        </div>
        {locked && !active ? (
          <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs font-semibold text-primary">{PERFORMANCE_LOCK_TITLE}</p>
            <ul className="space-y-1">
              {PERFORMANCE_LOCK_BENEFITS.map((line) => (
                <li key={line} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="mt-0.5 size-3 shrink-0 text-primary" />
                  {line}
                </li>
              ))}
            </ul>
            <a href={PERFORMANCE_URL} target="_blank" rel="noreferrer" className="block">
              <Button size="sm" className="w-full gap-1">
                Kit Performance <ExternalLink className="size-3" />
              </Button>
            </a>
          </div>
        ) : null}
        {active && state.profile?.name ? (
          <div className="mt-2">
            <InviteFriendsButton
              deviceId={deviceId}
              challengeId={c.id}
              displayName={state.profile.name}
            />
          </div>
        ) : null}
      </article>
      {why ? <p className="px-1 text-[0.65rem] text-muted-foreground">{why}</p> : null}
    </div>
  );
}
