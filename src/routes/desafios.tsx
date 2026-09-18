import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Heart, Medal, Radio, Trophy, Users, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { CHALLENGES, challengeById, isRelativeChallenge, type Challenge } from "@/data/challenges";
import {
  challengeProgress,
  fetchFeed,
  fetchLeaderboard,
  fetchParticipantCount,
  giveKudos,
  publishProofEvent,
  syncAllJoinedChallenges,
  type ActivityEvent,
  type LeaderboardRow,
} from "@/lib/social";
import { buildProofOfPerformance } from "@/lib/engine/proof-of-performance";
import { useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";
import { performanceUpgradeUrl } from "@/data/shopify-product-map";
import { formatActivityEvent } from "@/components/social/activity-feed";

const PERFORMANCE_URL = performanceUpgradeUrl();

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

function ChallengesPage() {
  const { state, hydrated, toggleChallenge, earnBadge } = useStore();
  const awarded = useRef(new Set<string>());
  const suggestedProof = useRef(new Set<string>());
  const [tab, setTab] = useState<"desafios" | "feed">("desafios");
  const [boards, setBoards] = useState<Record<string, LeaderboardRow[]>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [socialOffline, setSocialOffline] = useState(false);
  const [feed, setFeed] = useState<ActivityEvent[]>([]);
  const [feedOffline, setFeedOffline] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    for (const id of state.challenges) {
      const c = challengeById(id);
      if (!c) continue;
      const progress = challengeProgress(c, state.sessions, state.challengeBaselines?.[id]);
      if (progress.complete && !state.earnedBadges.includes(id) && !awarded.current.has(id)) {
        awarded.current.add(id);
        if (earnBadge(id)) {
          toast.success(`Badge conquistado: ${c.title}`);
        }
      }
      if (
        progress.complete &&
        isRelativeChallenge(c) &&
        !suggestedProof.current.has(id) &&
        state.shareProgress &&
        state.profile
      ) {
        suggestedProof.current.add(id);
        const proof = buildProofOfPerformance(state, c.durationDays);
        toast.message("Proof of Performance", {
          description: "Desafio relativo concluído — quer compartilhar sua evolução?",
          action: {
            label: "Compartilhar",
            onClick: () => {
              void publishProofEvent(getDeviceId(), state.profile!.name, {
                title: "Proof of Performance",
                narrative: proof.narrative,
                scoreDelta: proof.scoreDelta,
                volumeDeltaPct: proof.volumeDeltaPct,
                periodDays: proof.periodDays,
                challengeId: id,
              }).then(() => toast.success("Proof publicado no feed"));
            },
          },
        });
      }
    }
  }, [hydrated, state, earnBadge]);

  useEffect(() => {
    if (!hydrated || !state.profile || !state.shareProgress) return;
    const deviceId = getDeviceId();
    let cancelled = false;

    void (async () => {
      await syncAllJoinedChallenges(state, deviceId).catch((err) => {
        console.warn("syncAllJoinedChallenges failed", err);
      });
      const nextBoards: Record<string, LeaderboardRow[]> = {};
      const nextCounts: Record<string, number> = {};
      let anyFail = false;

      for (const c of CHALLENGES) {
        const [board, count] = await Promise.all([
          fetchLeaderboard(c.id, deviceId),
          fetchParticipantCount(c.id),
        ]);
        if (board) nextBoards[c.id] = board;
        else anyFail = true;
        if (count !== null) nextCounts[c.id] = count;
        else anyFail = true;
      }

      if (!cancelled) {
        setBoards(nextBoards);
        setCounts(nextCounts);
        setSocialOffline(anyFail && Object.keys(nextBoards).length === 0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, state.challenges, state.sessions.length, state.profile?.name, state.shareProgress]);

  useEffect(() => {
    if (!hydrated || tab !== "feed") return;
    let cancelled = false;
    void fetchFeed(40).then((rows) => {
      if (cancelled) return;
      if (!rows) {
        setFeedOffline(true);
        setFeed([]);
        return;
      }
      setFeedOffline(false);
      setFeed(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, tab, state.sessions.length, state.challenges.length, state.earnedBadges.length]);

  if (!hydrated) {
    return (
      <AppShell title="Desafios">
        <div className="surface-glass h-40 animate-pulse" />
      </AppShell>
    );
  }

  const joined = state.challenges;
  const earned = state.earnedBadges
    .map((id) => challengeById(id))
    .filter((c): c is Challenge => Boolean(c));

  return (
    <AppShell title="Desafios" subtitle={`${joined.length} desafio(s) ativos`}>
      <header className="mb-6">
        <p className="eyebrow">Missões</p>
        <h2 className="mt-1 text-display text-3xl leading-none">Ativas</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {joined.length} desafio(s) em andamento · {earned.length} conquista(s)
        </p>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <Button size="sm" variant={tab === "desafios" ? "default" : "secondary"} onClick={() => setTab("desafios")}>
          Desafios
        </Button>
        <Button size="sm" variant={tab === "feed" ? "default" : "secondary"} onClick={() => setTab("feed")}>
          <Radio className="size-3.5" /> Feed
        </Button>
      </div>

      {tab === "feed" ? (
        <section className="space-y-3">
          {feedOffline ? (
            <p className="surface-glass p-4 text-sm text-muted-foreground">
              Feed indisponível no momento. O app continua funcionando offline.
            </p>
          ) : null}
          {!feedOffline && feed.length === 0 ? (
            <EmptyState
              variant="social"
              title="Feed quieto"
              description="Complete um treino ou entre em um desafio para aparecer aqui."
              action={
                <div className="flex flex-col gap-2">
                  <Link to="/treino" className="block">
                    <Button className="h-11 w-full font-bold uppercase tracking-wide">Ir treinar</Button>
                  </Link>
                  <Button variant="secondary" className="h-10 w-full" onClick={() => setTab("desafios")}>
                    Ver desafios
                  </Button>
                </div>
              }
            />
          ) : null}
          {feed.map((e) => (
            <article key={e.id} className="surface-glass flex items-start justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">{formatActivityEvent(e)}</p>
                <p className="mt-1 text-[0.65rem] text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0 gap-1"
                onClick={() => {
                  void giveKudos(e.id, e.kudosCount)
                    .then(() =>
                      setFeed((prev) =>
                        prev.map((x) => (x.id === e.id ? { ...x, kudosCount: x.kudosCount + 1 } : x)),
                      ),
                    )
                    .catch(() => toast.error("Não foi possível enviar kudos"));
                }}
              >
                <Heart className="size-3.5" /> {e.kudosCount}
              </Button>
            </article>
          ))}
        </section>
      ) : (
        <>
          {socialOffline ? (
            <p className="mb-4 surface-glass p-4 text-sm text-muted-foreground">
              Ranking remoto indisponível. Mostrando só o seu progresso local.
            </p>
          ) : null}

          {earned.length > 0 ? (
            <section className="surface-glass mb-4 p-5">
              <div className="flex items-center gap-2">
                <Medal className="size-4 text-primary" />
                <h2 className="text-lg">Conquistas</h2>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {earned.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold"
                  >
                    <Medal className="size-3.5 text-primary" />
                    {b.title}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="space-y-4">
            {CHALLENGES.map((c) => {
              const active = joined.includes(c.id);
              const progress = challengeProgress(c, state.sessions, state.challengeBaselines?.[c.id]);
              const relative = isRelativeChallenge(c);
              const hasBadge = state.earnedBadges.includes(c.id);
              const board = boards[c.id] ?? [];
              const participants = counts[c.id] ?? c.participants;
              const locked =
                c.requiresPerformance === true && (state.accessTier ?? "base") !== "performance";

              return (
                <article key={c.id} className={`surface-glass p-6 ${locked ? "opacity-80" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="eyebrow">
                        {relative
                          ? "% evolução"
                          : c.requiresPerformance
                            ? "Performance"
                            : c.metric === "volume"
                              ? "Volume"
                              : "Frequência"}
                      </p>
                      <h2 className="mt-1 text-display text-2xl">{c.title}</h2>
                      <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
                      {locked ? (
                        <p className="mt-2 text-xs text-primary">
                          Exclusivo do plano Performance (kit whey + creatina, Striker ou tag VIP).
                        </p>
                      ) : null}
                    </div>
                    {hasBadge || (progress.complete && active) ? (
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
                        {relative
                          ? `${progress.displayValue >= 0 ? "+" : ""}${progress.displayValue}% / +${progress.displayTarget}%`
                          : `${progress.displayValue.toLocaleString("pt-BR")} / ${progress.displayTarget.toLocaleString("pt-BR")} ${progress.displayUnit}`}
                      </span>
                      <span>{c.durationDays} dias</span>
                    </div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted/60">
                      <div
                        className="h-2.5 rounded-full bg-primary shadow-[0_0_12px_var(--glow-primary)] transition-all"
                        style={{ width: `${progress.barPct}%` }}
                      />
                    </div>
                    {relative && active ? (
                      <p className="mt-1 text-[0.65rem] text-muted-foreground">
                        Baseline {progress.baseline.toLocaleString("pt-BR")} → agora{" "}
                        {progress.current.toLocaleString("pt-BR")} {c.metric === "volume" ? "kg" : "treinos"}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-4" /> {participants.toLocaleString("pt-BR")} participantes
                    </span>
                    {locked && !active ? (
                      <a href={PERFORMANCE_URL} target="_blank" rel="noreferrer">
                        <Button size="sm" className="gap-1.5">
                          Ver kit Performance <ExternalLink className="size-3.5" />
                        </Button>
                      </a>
                    ) : (
                      <Button
                        size="sm"
                        variant={active ? "secondary" : "default"}
                        onClick={() => {
                          if (!state.profile?.name?.trim()) {
                            toast.error("Defina seu nome no Perfil para participar do ranking");
                            return;
                          }
                          toggleChallenge(c.id);
                          toast.success(active ? "Você saiu do desafio" : `Bem-vindo ao ${c.title}`);
                        }}
                      >
                        {active ? "Sair" : "Participar"}
                      </Button>
                    )}
                  </div>

                  {active ? (
                    <div className="mt-4 border-t border-border pt-3">
                      <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-primary">
                        Ranking{relative ? " (% evolução)" : ""}
                      </p>
                      <ul className="mt-2 space-y-1 text-sm">
                        {board.length > 0 ? (
                          board.slice(0, 8).map((row) => (
                            <li
                              key={row.deviceId}
                              className={`flex justify-between ${row.isYou ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                            >
                              <span>
                                {row.rank}. {row.isYou ? "Você" : row.displayName}
                              </span>
                              <span>
                                {relative
                                  ? `${row.value >= 0 ? "+" : ""}${Number(row.value).toFixed(1)}%`
                                  : row.value.toLocaleString("pt-BR")}
                              </span>
                            </li>
                          ))
                        ) : (
                          <li className="flex justify-between font-semibold text-foreground">
                            <span>Você</span>
                            <span>
                              {relative
                                ? `${progress.displayValue >= 0 ? "+" : ""}${progress.displayValue}%`
                                : progress.displayValue.toLocaleString("pt-BR")}
                            </span>
                          </li>
                        )}
                      </ul>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      )}
    </AppShell>
  );
}
