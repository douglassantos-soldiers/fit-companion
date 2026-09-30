import { Link } from "@tanstack/react-router";
import { Pill, Users, X } from "lucide-react";
import { toast } from "sonner";
import { ActivityFeed } from "@/components/social/activity-feed";
import { PeriodReviewCard } from "@/components/progress/period-review-card";
import { SoldiersMediaThumb } from "@/components/soldiers-media-frame";
import { HomeBlockImpression } from "@/components/today/home-block-impression";
import { HomeStreakRiskBanner } from "@/components/today/home-streak-risk-banner";
import { Button } from "@/components/ui/button";
import type { OnboardingTip } from "@/data/onboarding-tips";
import type { SupplementProduct } from "@/data/products";
import type { HomePersona } from "@/lib/engine/home-persona";
import type { HomeBlockId } from "@/lib/engine/home-layout";
import type { PeriodReview } from "@/lib/engine/period-review";
import { resolveProductMedia } from "@/lib/soldiers-media";
import { trackHomeSurface } from "@/lib/home/track-home-surface";
import type { ActivityEvent } from "@/lib/social";

type StrengthScore = {
  score: number;
  coldStart: boolean;
  evidenceCount: number;
  delta28d?: number | null;
};

type Wow = { volumeDeltaPct: number | null };

export function HomeBlocks({
  homeBlocks,
  persona,
  wow,
  livingRecovery,
  weekPrs,
  strengthScore,
  weekReview,
  atRisk,
  streakDays,
  workoutDayId,
  expressToday,
  freezes,
  onFreeze,
  nutProof,
  living,
  gap,
  onRegisterMeal,
  nowSuggestion,
  taken,
  onToggleSupplement,
  insightLine,
  whyExtra,
  adhere,
  tip,
  onMarkTipSeen,
  club,
  followingCount,
  leagueRank,
  clubFeed,
  deviceId,
  kudosGiven,
  onKudos,
  onKudosQuest,
}: {
  homeBlocks: HomeBlockId[];
  persona: HomePersona;
  wow: Wow | null;
  livingRecovery: string | null;
  weekPrs: unknown[];
  strengthScore: StrengthScore | null;
  weekReview: PeriodReview | null;
  atRisk: boolean;
  streakDays: number;
  workoutDayId: string | null;
  expressToday: boolean;
  freezes: number;
  onFreeze: () => void;
  nutProof: string | null;
  living: unknown;
  gap: string | null;
  onRegisterMeal: () => void;
  nowSuggestion: SupplementProduct | null;
  taken: string[];
  onToggleSupplement: (id: string) => void;
  insightLine: string | null;
  whyExtra: string[];
  adhere: number;
  tip: OnboardingTip | null;
  onMarkTipSeen: (id: string) => void;
  club: { name: string } | null;
  followingCount: number;
  leagueRank: number | null;
  clubFeed: ActivityEvent[];
  deviceId: string;
  kudosGiven: Record<string, boolean>;
  onKudos: (id: string) => void;
  onKudosQuest: () => void;
}) {
  return (
    <>
      {homeBlocks.map((blockId) => {
        if (blockId === "wow" && persona === "avancado" && wow) {
          return (
            <HomeBlockImpression key="wow" blockId="wow">
              <div className="mb-4 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/10 px-3 py-2 text-center">
                    <p className="text-display text-lg text-primary">
                      {wow.volumeDeltaPct != null
                        ? `${wow.volumeDeltaPct > 0 ? "+" : ""}${wow.volumeDeltaPct}%`
                        : "—"}
                    </p>
                    <p className="text-[0.65rem] uppercase text-muted-foreground">Volume</p>
                  </div>
                  <div className="rounded-xl border border-white/10 px-3 py-2 text-center">
                    <p className="text-display text-lg text-primary">{livingRecovery ?? "—"}</p>
                    <p className="text-[0.65rem] uppercase text-muted-foreground">Recuperação</p>
                  </div>
                  <div className="rounded-xl border border-white/10 px-3 py-2 text-center">
                    <p className="text-display text-lg text-primary">{weekPrs.length}</p>
                    <p className="text-[0.65rem] uppercase text-muted-foreground">PRs sem.</p>
                  </div>
                </div>
                {strengthScore ? (
                  <Link
                    to="/progresso"
                    className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2"
                    onClick={() => trackHomeSurface("home_block_click", { blockId: "wow" })}
                  >
                    <span>
                      <span className="block text-sm font-semibold">Strength Score</span>
                      <span className="text-[0.65rem] uppercase text-muted-foreground">
                        {strengthScore.coldStart
                          ? "Estimativa"
                          : `${strengthScore.evidenceCount} lifts`}
                        {strengthScore.delta28d != null
                          ? ` · ${strengthScore.delta28d > 0 ? "+" : ""}${strengthScore.delta28d} 28d`
                          : ""}
                      </span>
                    </span>
                    <span className="text-display text-xl text-primary">{strengthScore.score}</span>
                  </Link>
                ) : null}
              </div>
            </HomeBlockImpression>
          );
        }
        if (
          blockId === "weekPrs" &&
          (persona === "consistente" || persona === "em_risco") &&
          (weekPrs.length || strengthScore)
        ) {
          return (
            <HomeBlockImpression key="weekPrs" blockId="weekPrs">
              <div className="mb-3 space-y-1">
                {weekPrs.length ? (
                  <p className="text-sm font-semibold text-primary">
                    {weekPrs.length} PR{weekPrs.length === 1 ? "" : "s"} esta semana
                  </p>
                ) : null}
                {strengthScore ? (
                  <Link
                    to="/progresso"
                    className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2"
                    onClick={() => trackHomeSurface("home_block_click", { blockId: "weekPrs" })}
                  >
                    <span>
                      <span className="block text-sm font-semibold">Strength Score</span>
                      <span className="text-[0.65rem] uppercase text-muted-foreground">
                        {strengthScore.coldStart
                          ? "Estimativa"
                          : `${strengthScore.evidenceCount} lifts`}
                        {strengthScore.delta28d != null
                          ? ` · ${strengthScore.delta28d > 0 ? "+" : ""}${strengthScore.delta28d} 28d`
                          : ""}
                      </span>
                    </span>
                    <span className="text-display text-xl text-primary">{strengthScore.score}</span>
                  </Link>
                ) : null}
              </div>
            </HomeBlockImpression>
          );
        }
        if (
          blockId === "periodReview" &&
          weekReview &&
          (weekReview.sessions > 0 || weekReview.isSundayRitual || new Date().getDay() === 1)
        ) {
          return (
            <HomeBlockImpression key="periodReview" blockId="periodReview">
              <PeriodReviewCard review={weekReview} />
            </HomeBlockImpression>
          );
        }
        if (blockId === "streakRisk" && atRisk) {
          return (
            <HomeStreakRiskBanner
              key="streakRisk"
              streakDays={streakDays}
              workoutDayId={workoutDayId}
              express={expressToday}
              freezes={freezes}
              onFreeze={onFreeze}
            />
          );
        }
        if (blockId === "nutritionProof" && nutProof) {
          return (
            <HomeBlockImpression key="nutritionProof" blockId="nutritionProof">
              <Link
                to="/nutricao"
                className="mb-3 block rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
                onClick={() =>
                  trackHomeSurface("home_block_click", { blockId: "nutritionProof" })
                }
              >
                {nutProof}
              </Link>
            </HomeBlockImpression>
          );
        }
        if (blockId === "registerMeal") {
          if (living) return null;
          return (
            <HomeBlockImpression key="registerMeal" blockId="registerMeal">
              <div className="mb-4 space-y-2">
                {gap ? (
                  <p className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                    {gap}
                  </p>
                ) : null}
                <Button
                  variant="secondary"
                  className="h-11 w-full"
                  onClick={() => {
                    trackHomeSurface("home_block_click", { blockId: "registerMeal" });
                    onRegisterMeal();
                  }}
                >
                  Registrar refeição
                </Button>
              </div>
            </HomeBlockImpression>
          );
        }
        if (blockId === "supplement" && nowSuggestion) {
          return (
            <HomeBlockImpression key="supplement" blockId="supplement">
              <section className="surface-glass mb-4 space-y-3 p-4">
                <p className="eyebrow">Suplemento</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <SoldiersMediaThumb
                      media={resolveProductMedia(nowSuggestion.id)}
                      alt={nowSuggestion.name}
                      className="size-12 rounded-xl"
                    />
                    <div>
                      <p className="text-sm font-semibold">{nowSuggestion.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {nowSuggestion.timing} · {nowSuggestion.serving}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!taken.includes(nowSuggestion.id)) onToggleSupplement(nowSuggestion.id);
                      toast.success(`${nowSuggestion.name} marcado`);
                      trackHomeSurface("home_block_click", { blockId: "supplement" });
                    }}
                  >
                    <Pill className="size-3.5" />
                    {taken.includes(nowSuggestion.id) ? "Tomado" : "Marcar"}
                  </Button>
                </div>
              </section>
            </HomeBlockImpression>
          );
        }
        if (blockId === "insights") {
          if (!insightLine && whyExtra.length <= 1) return null;
          return (
            <HomeBlockImpression key="insights" blockId="insights">
              <div>
                {insightLine ? (
                  <p className="mb-3 px-1 text-xs text-muted-foreground">{insightLine}</p>
                ) : null}
                {whyExtra.length > 1 ? (
                  <p className="mb-3 px-1 text-[11px] text-muted-foreground/80">
                    {whyExtra.slice(1, 3).join(" · ")}
                    {adhere > 0 ? ` · Aderência ${adhere}` : ""}
                  </p>
                ) : null}
              </div>
            </HomeBlockImpression>
          );
        }
        if (blockId === "habitTip" && persona === "novo" && tip) {
          return (
            <HomeBlockImpression key="habitTip" blockId="habitTip">
              <div className="surface-glass mb-4 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="eyebrow">Hábito</p>
                    <p className="mt-1 text-sm font-semibold">{tip.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{tip.body}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                    aria-label="Dispensar"
                    onClick={() => onMarkTipSeen(tip.id)}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <Link to={tip.ctaTo} className="mt-3 block">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      trackHomeSurface("home_block_click", { blockId: "habitTip" });
                      onMarkTipSeen(tip.id);
                    }}
                  >
                    {tip.ctaLabel}
                  </Button>
                </Link>
              </div>
            </HomeBlockImpression>
          );
        }
        if (blockId === "socialTeaser") {
          const hasSocialGraph = Boolean(club) || followingCount > 0;
          if (!hasSocialGraph) return null;
          const snippet = clubFeed.slice(0, 2);
          return (
            <HomeBlockImpression key="socialTeaser" blockId="socialTeaser">
              <div className="mb-3 space-y-2">
                <Link
                  to="/social"
                  search={{ tab: "feed" }}
                  className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2"
                  onClick={() =>
                    trackHomeSurface("home_block_click", { blockId: "socialTeaser" })
                  }
                >
                  <Users className="size-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {club ? `Clube · ${club.name}` : "Para você"}
                    </p>
                    <p className="text-[0.65rem] text-muted-foreground">
                      {leagueRank != null
                        ? `Liga #${leagueRank} · feed e pressão saudável`
                        : "Feed, desafios e pressão saudável"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-primary">Ver</span>
                </Link>
                {snippet.length > 0 ? (
                  <ActivityFeed
                    events={snippet}
                    deviceId={deviceId}
                    kudosGiven={kudosGiven}
                    compact
                    onKudos={onKudos}
                    onKudosQuest={onKudosQuest}
                  />
                ) : null}
              </div>
            </HomeBlockImpression>
          );
        }
        return null;
      })}
    </>
  );
}
