import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState, LoadingPulse } from "@/components/app-shell";
import { SoldiersMediaThumb } from "@/components/soldiers-media-frame";
import { Button } from "@/components/ui/button";
import {
  CHALLENGES,
  challengeById,
  isPersonalizedChallenge,
  isRelativeChallenge,
} from "@/data/challenges";
import { fetchLeaderboard, type LeaderboardRow } from "@/lib/social";
import { InviteFriendsButton } from "@/components/social/invite-friends";
import { ProofStatusBadge } from "@/components/social/proof-status-badge";
import { resolveChallengeMedia } from "@/lib/soldiers-media";
import { useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";
import { isProfileGeneratedChallenge } from "@/lib/engine/profile-challenges";
import { filterLeaderboardByProof, isActivityProofMetric } from "@/lib/wearables/challenge-proof";
import { EMPTY_RANKING_BODY, EMPTY_RANKING_JOIN, EMPTY_RANKING_TITLE } from "@/lib/ui/platform-copy";

export const Route = createFileRoute("/desafios")({
  validateSearch: (search: Record<string, unknown>) => ({
    challenge:
      typeof search["challenge"] === "string" && search["challenge"].length
        ? search["challenge"]
        : CHALLENGES[0]?.id ?? "consistencia-21",
  }),
  head: () => ({
    meta: [
      { title: "Ranking — Soldiers Training" },
      {
        name: "description",
        content: "Leaderboard de desafios — evolução relativa e metas pessoais.",
      },
    ],
  }),
  component: ChallengeRankingPage,
});

function ChallengeRankingPage() {
  const { challenge: challengeId } = Route.useSearch();
  const { state, hydrated, toggleChallenge } = useStore();
  const deviceId = getDeviceId();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const challenge = challengeById(challengeId) ?? CHALLENGES[0];
  const relative = challenge ? isRelativeChallenge(challenge) : false;
  const personalized = challenge ? isPersonalizedChallenge(challenge) : false;
  const activityMetric = challenge ? isActivityProofMetric(challenge.metric) : false;
  const visibleRows = useMemo(
    () => (rows ? filterLeaderboardByProof(rows, activityMetric && verifiedOnly) : null),
    [rows, activityMetric, verifiedOnly],
  );

  useEffect(() => {
    if (!hydrated || !challenge) return;
    let cancelled = false;
    setLoading(true);
    void fetchLeaderboard(challenge.id, deviceId)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setRows(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, challenge?.id, deviceId, state.challenges.length]);

  if (!challenge) {
    return (
      <AppShell title="Ranking">
        <p className="text-sm text-muted-foreground">Nenhum desafio encontrado.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Ranking"
      subtitle={
        relative
          ? "% de evolução vs baseline"
          : personalized
            ? "% da meta pessoal"
            : "Valor absoluto"
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {CHALLENGES.filter((c) => !isProfileGeneratedChallenge(c.id) || (state.challenges ?? []).includes(c.id)).map(
          (c) => (
          <Link key={c.id} to="/desafios" search={{ challenge: c.id }}>
            <Button size="sm" variant={c.id === challenge.id ? "default" : "secondary"}>
              {c.title.length > 22 ? `${c.title.slice(0, 20)}…` : c.title}
            </Button>
          </Link>
        ))}
      </div>

      <article className="surface-glass mb-4 p-4">
        <div className="flex items-start gap-3">
          <SoldiersMediaThumb
            media={resolveChallengeMedia(challenge.category)}
            alt={challenge.category}
            className="size-14 rounded-xl"
          />
          <div className="min-w-0">
            <p className="eyebrow">{challenge.category}</p>
            <h2 className="mt-0.5 text-display text-xl">{challenge.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{challenge.description}</p>
          </div>
        </div>
        <Link to="/social" search={{ tab: "desafios" }} className="mt-3 inline-block">
          <Button size="sm" variant="secondary">
            Voltar aos desafios
          </Button>
        </Link>
        {state.profile?.name && (state.challenges ?? []).includes(challenge.id) ? (
          <div className="mt-3">
            <InviteFriendsButton
              deviceId={deviceId}
              challengeId={challenge.id}
              displayName={state.profile.name}
            />
          </div>
        ) : null}
      </article>

      {state.lastFraudWarning ? (
        <p className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          {state.lastFraudWarning}
        </p>
      ) : null}

      {activityMetric ? (
        <div className="mb-3 flex justify-end">
          <Button size="sm" variant={verifiedOnly ? "default" : "outline"} onClick={() => setVerifiedOnly((v) => !v)}>
            {verifiedOnly ? "Só verificados" : "Todos (com selo)"}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <LoadingPulse />
      ) : visibleRows?.length ? (
        <ul className="space-y-2">
          {visibleRows.map((r) => (
            <li
              key={r.deviceId}
              className={`surface-glass flex items-center gap-3 p-3 ${r.isYou ? "border-primary/40" : ""}`}
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
                {r.rank <= 3 ? <Trophy className="size-3.5 text-primary" /> : r.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {r.displayName}
                  {r.isYou ? " · você" : ""}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  {activityMetric ? <ProofStatusBadge status={r.proofStatus} flagged={r.flagged} /> : null}
                  {r.personalTarget != null ? (
                    <p className="text-[0.65rem] text-muted-foreground">
                      Meta pessoal: {r.personalTarget.toLocaleString("pt-BR")}
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="text-sm font-semibold tabular-nums">
                {relative || personalized
                  ? `${r.pct != null ? (r.pct >= 0 ? "+" : "") : ""}${Number(r.value).toFixed(1)}%`
                  : r.value.toLocaleString("pt-BR")}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          variant="social"
          title={EMPTY_RANKING_TITLE}
          description={activityMetric ? EMPTY_RANKING_BODY : "Entre no desafio e sincronize progresso para aparecer aqui."}
          action={
            (state.challenges ?? []).includes(challenge.id) ? undefined : (
              <Button
                className="h-12 w-full font-bold uppercase tracking-wide"
                onClick={() => {
                  if (!state.profile?.name?.trim()) {
                    toast.error("Defina seu nome no Perfil para participar");
                    return;
                  }
                  toggleChallenge(challenge.id);
                  toast.success("Entrou no desafio");
                }}
              >
                {EMPTY_RANKING_JOIN}
              </Button>
            )
          }
        />
      )}
    </AppShell>
  );
}
