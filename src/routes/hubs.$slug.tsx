import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { challengeById, isRelativeChallenge } from "@/data/challenges";
import { hubBySlug } from "@/data/hubs";
import { performanceUpgradeUrl } from "@/data/shopify-product-map";
import { formatActivityEvent } from "@/components/social/activity-feed";
import {
  fetchHubLeaderboard,
  getHub,
  type Hub,
} from "@/lib/hubs";
import {
  challengeProgress,
  fetchFeed,
  type ActivityEvent,
  type LeaderboardRow,
} from "@/lib/social";
import { useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";

const PERFORMANCE_URL = performanceUpgradeUrl();

export const Route = createFileRoute("/hubs/$slug")({
  head: ({ params }) => {
    const hub = hubBySlug(params.slug);
    return {
      meta: [
        { title: `${hub?.name ?? "Hub"} — Soldiers Training` },
        {
          name: "description",
          content: hub?.tagline ?? "Performance Hub Soldiers",
        },
      ],
    };
  },
  component: HubDetailPage,
});

function HubDetailPage() {
  const { slug } = Route.useParams();
  const { state, hydrated, toggleHub } = useStore();
  const [hub, setHub] = useState<Hub | null>(hubBySlug(slug) ?? null);
  const [boards, setBoards] = useState<Record<string, LeaderboardRow[]>>({});
  const [feed, setFeed] = useState<ActivityEvent[]>([]);
  const deviceId = getDeviceId();
  const joined = (state.joinedHubIds ?? []).includes(hub?.id ?? "");

  useEffect(() => {
    let cancelled = false;
    void getHub(slug).then((h) => {
      if (!cancelled && h) setHub(h);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!hub || !hydrated) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, LeaderboardRow[]> = {};
      for (const cid of hub.challengeIds) {
        const board = await fetchHubLeaderboard(cid, deviceId);
        if (board) next[cid] = board;
      }
      if (!cancelled) setBoards(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [hub, hydrated, deviceId, state.sessions.length, state.challenges.length]);

  const challengeIdSet = useMemo(() => new Set(hub?.challengeIds ?? []), [hub]);

  useEffect(() => {
    if (!hub || !hydrated) return;
    let cancelled = false;
    void fetchFeed(40).then((rows) => {
      if (cancelled || !rows) return;
      setFeed(
        rows.filter((e) => {
          const cid = e.payload["challengeId"];
          return typeof cid === "string" && challengeIdSet.has(cid);
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [hub, hydrated, challengeIdSet, state.challenges.length]);

  if (!hydrated || !hub) {
    return (
      <AppShell title="Hub">
        <div className="surface-glass h-40 animate-pulse" />
      </AppShell>
    );
  }

  return (
    <AppShell title={hub.name} subtitle={hub.creatorName}>
      <header className="mb-5">
        <p className="eyebrow">{hub.creatorName}</p>
        <h2 className="mt-1 text-display text-3xl leading-none">{hub.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{hub.tagline}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => {
              if (!state.profile?.name?.trim()) {
                toast.error("Defina seu nome no Perfil para entrar no hub");
                return;
              }
              toggleHub(hub.id);
              toast.success(joined ? "Você saiu do hub" : `Bem-vindo ao ${hub.name}`);
            }}
            variant={joined ? "secondary" : "default"}
          >
            {joined ? "Sair do hub" : "Participar"}
          </Button>
          <Link to="/hubs">
            <Button variant="secondary">Todos os hubs</Button>
          </Link>
        </div>
      </header>

      <section className="mb-4 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">Desafios do hub</h3>
        {hub.challengeIds.map((cid) => {
          const c = challengeById(cid);
          if (!c) return null;
          const relative = isRelativeChallenge(c);
          const progress = challengeProgress(c, state.sessions, state.challengeBaselines?.[cid]);
          const board = boards[cid] ?? [];
          return (
            <article key={cid} className="surface-glass p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="eyebrow">{relative ? "% evolução" : c.metric}</p>
                  <h4 className="mt-0.5 text-display text-xl">{c.title}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                </div>
                <Trophy className="size-5 shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[0.65rem] text-muted-foreground">
                  <span>
                    {relative
                      ? `${progress.displayValue >= 0 ? "+" : ""}${progress.displayValue}% / +${progress.displayTarget}%`
                      : `${progress.displayValue.toLocaleString("pt-BR")} / ${progress.displayTarget.toLocaleString("pt-BR")} ${progress.displayUnit}`}
                  </span>
                  <span>{c.durationDays}d</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${progress.barPct}%` }}
                  />
                </div>
              </div>
              {joined ? (
                <ul className="mt-3 space-y-1 border-t border-border pt-2 text-sm">
                  {board.length ? (
                    board.slice(0, 5).map((row) => (
                      <li
                        key={row.deviceId}
                        className={`flex justify-between ${row.isYou ? "font-semibold" : "text-muted-foreground"}`}
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
                    <li className="flex justify-between font-semibold">
                      <span>Você</span>
                      <span>
                        {relative
                          ? `${progress.displayValue >= 0 ? "+" : ""}${progress.displayValue}%`
                          : progress.displayValue.toLocaleString("pt-BR")}
                      </span>
                    </li>
                  )}
                </ul>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="mb-4 surface-glass p-4">
        <p className="eyebrow">Suplementação</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Estoque estimado no app — reposição Soldiers quando fizer sentido, sem pressão.
        </p>
        <a href={PERFORMANCE_URL} target="_blank" rel="noreferrer" className="mt-3 inline-block">
          <Button size="sm" variant="secondary" className="gap-1.5">
            Ver kit Performance <ExternalLink className="size-3.5" />
          </Button>
        </a>
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
          <Users className="size-3.5" /> Atividade do hub
        </h3>
        {feed.length === 0 ? (
          <p className="surface-glass p-4 text-sm text-muted-foreground">
            Ainda sem eventos deste hub. Participe e complete treinos para aparecer aqui.
          </p>
        ) : (
          feed.slice(0, 8).map((e) => (
            <article key={e.id} className="surface-glass p-3">
              <p className="text-sm font-medium">{formatActivityEvent(e)}</p>
              <p className="mt-1 text-[0.65rem] text-muted-foreground">
                {new Date(e.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </p>
            </article>
          ))
        )}
      </section>
    </AppShell>
  );
}
