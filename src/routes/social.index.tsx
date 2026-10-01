import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Medal, Radio, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState, LoadingPulse } from "@/components/app-shell";
import { ActivityFeed } from "@/components/social/activity-feed";
import { ChallengeCard } from "@/components/social/challenge-card";
import { ClubStoriesRail } from "@/components/social/club-stories-rail";
import { FeedFilterChips, type FeedFilter } from "@/components/social/feed-filter-chips";
import { SocialAvatar } from "@/components/social/social-avatar";
import { WearableProvidersPanel } from "@/components/social/wearable-providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHALLENGES, challengeById, type Challenge } from "@/data/challenges";
import { HUBS } from "@/data/hubs";
import { performanceUpgradeUrl } from "@/data/shopify-product-map";
import { useClubSocialFeed } from "@/hooks/use-club-social-feed";
import {
  acceptChallengeInvite,
  createClub,
  declineChallengeInvite,
  ensureFriendQuest,
  fetchClubLeague,
  fetchClubStories,
  followUser,
  joinClubByCode,
  listMyClubs,
  type ClubStory,
  type ClubSummary,
  type FriendQuest,
  type LeagueRow,
} from "@/lib/social";
import { listPendingInvitesFn, listFollowingForInviteFn } from "@/lib/social/graph.functions";
import { listHubs, type Hub } from "@/lib/hubs";
import { suggestProfileChallenges, isProfileGeneratedChallenge } from "@/lib/engine/profile-challenges";
import { suggestAiChallenges, isAiGeneratedChallenge } from "@/lib/challenges/ai-suggest";
import { useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";
import type { ActivityLogKind } from "@/lib/types";
import { EMPTY_FEED_BODY, EMPTY_FEED_TITLE, PERFORMANCE_LOCK_BENEFITS, PERFORMANCE_LOCK_TITLE } from "@/lib/ui/platform-copy";

const PERFORMANCE_URL = performanceUpgradeUrl();

export const Route = createFileRoute("/social/")({
  validateSearch: (search: Record<string, unknown>) => {
    const tab =
      search["tab"] === "clubes" ||
      search["tab"] === "feed" ||
      search["tab"] === "desafios" ||
      search["tab"] === "hubs"
        ? (search["tab"] as "desafios" | "clubes" | "feed" | "hubs")
        : "feed";
    const feedFilter =
      search["feedFilter"] === "following" ||
      search["feedFilter"] === "club" ||
      search["feedFilter"] === "foryou"
        ? (search["feedFilter"] as "foryou" | "following" | "club")
        : undefined;
    return feedFilter ? { tab, feedFilter } : { tab };
  },
  head: () => ({
    meta: [
      { title: "Social — Soldiers Training" },
      {
        name: "description",
        content: "Para você, clubes e desafios — grafo, reações e ranking.",
      },
    ],
  }),
  component: SocialHubPage,
});

function SocialHubPage() {
  const search = Route.useSearch();
  const tab = search.tab;
  const feedFilter: FeedFilter = search.feedFilter ?? "foryou";
  const navigate = useNavigate();
  const { state, hydrated, markQuestKudos, toggleChallenge, logActivity, markFollowedSomeone } =
    useStore();
  const deviceId = getDeviceId();
  const feedMode = feedFilter === "following" ? "following" : feedFilter === "club" ? "club" : "foryou";
  const {
    club: feedClub,
    feed,
    setFeed,
    kudosGiven,
    setKudosGiven,
    applyReaction,
    status: feedStatus,
  } = useClubSocialFeed({
    enabled: hydrated && Boolean(deviceId),
    deviceId,
    limit: 20,
    globalFallback: feedMode === "foryou",
    refreshKey: state.sessions.length,
    mode: feedMode,
    goal: state.profile?.goal ?? null,
    level: state.profile?.level ?? null,
  });

  const setFeedFilter = (next: FeedFilter) => {
    void navigate({
      to: "/social",
      search: { tab: "feed", feedFilter: next },
    });
  };

  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [clubName, setClubName] = useState("");
  const [clubCode, setClubCode] = useState("");
  const [clubBusy, setClubBusy] = useState(false);
  const [clubOffline, setClubOffline] = useState(false);
  const [stepsInput, setStepsInput] = useState("");
  const [footballInput, setFootballInput] = useState("1");
  const [invites, setInvites] = useState<
    Array<{ id: string; challengeId: string; fromName: string; fromUserId: string }>
  >([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [leagueMe, setLeagueMe] = useState<LeagueRow | null>(null);
  const [friendQuest, setFriendQuest] = useState<FriendQuest | null>(null);
  const [stories, setStories] = useState<ClubStory[]>([]);
  const [hubs, setHubs] = useState<Hub[]>(HUBS);
  const primaryClub = clubs[0] ?? null;

  useEffect(() => {
    if (!hydrated || !deviceId) return;
    let cancelled = false;
    void listMyClubs(deviceId)
      .then((rows) => {
        if (!cancelled) {
          setClubs(rows);
          setClubOffline(false);
        }
      })
      .catch((err) => {
        console.warn("listMyClubs failed", err);
        if (!cancelled) setClubOffline(true);
      });
    void listPendingInvitesFn({ data: { deviceId } })
      .then((res) => {
        if (!cancelled) setInvites(res.invites ?? []);
      })
      .catch(() => undefined);
    void listFollowingForInviteFn({ data: { deviceId } })
      .then((res) => {
        if (cancelled) return;
        const people = res.people ?? [];
        setFollowingCount(people.length);
        setFollowingIds(new Set(people.map((p) => p.userId)));
      })
      .catch(() => undefined);
    void listHubs()
      .then((rows) => {
        if (!cancelled && rows.length) setHubs(rows);
      })
      .catch(() => {
        /* hubs catalogue optional */
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, deviceId, state.sessions.length]);

  useEffect(() => {
    if (!primaryClub || !deviceId) {
      setLeagueMe(null);
      setFriendQuest(null);
      setStories([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const ids = primaryClub.members.map((m) => m.deviceId);
        const [league, fq, st] = await Promise.all([
          fetchClubLeague(primaryClub.id, ids, deviceId),
          ensureFriendQuest(deviceId, primaryClub, state.profile?.name || "Soldado"),
          fetchClubStories(primaryClub.id, deviceId),
        ]);
        if (cancelled) return;
        setLeagueMe(league?.find((r) => r.isYou) ?? null);
        setFriendQuest(fq);
        setStories(st);
      } catch (err) {
        console.warn("club extras failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primaryClub, deviceId, state.profile?.name, state.sessions.length]);

  const suggestFollow = useMemo(() => {
    const selfName = state.profile?.name?.trim().toLowerCase() ?? "";
    const seen = new Set<string>();
    const out: Array<{ userId: string; displayName: string }> = [];
    for (const club of clubs) {
      for (const m of club.members) {
        if (!m.userId || followingIds.has(m.userId)) continue;
        if (selfName && m.displayName.trim().toLowerCase() === selfName) continue;
        if (seen.has(m.userId)) continue;
        seen.add(m.userId);
        out.push({ userId: m.userId, displayName: m.displayName });
      }
    }
    return out.slice(0, 8);
  }, [clubs, followingIds, state.profile?.name]);

  const joined = state.challenges ?? [];
  const needsManualLog = joined.some((id) => {
    const c = challengeById(id);
    return c?.metric === "steps" || c?.metric === "football_sessions";
  });

  const submitActivity = (kind: ActivityLogKind, raw: string) => {
    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    const result = logActivity(kind, value);
    if (!result.ok) {
      toast.error(result.message ?? "Não registrado");
      return;
    }
    if (result.warning) toast.message(result.warning);
    else toast.success("Registrado (auto-relatado)");
    if (kind === "steps") setStepsInput("");
  };

  const catalogChallenges = CHALLENGES.filter(
    (c) => !isProfileGeneratedChallenge(c.id) && !isAiGeneratedChallenge(c.id),
  );
  const profileChallenges = suggestProfileChallenges({
    level: state.profile?.level ?? null,
    sessionCount: state.sessions.length,
    hasClub: clubs.length > 0,
    followingCount,
  });
  const aiSuggestions = suggestAiChallenges(state);

  const featuredChallenge = useMemo((): { challenge: Challenge; why?: string } | null => {
    const joinedFirst = joined.map((id) => challengeById(id)).find((c): c is Challenge => Boolean(c));
    if (joinedFirst) return { challenge: joinedFirst };
    if (aiSuggestions[0]) return { challenge: aiSuggestions[0].challenge, why: aiSuggestions[0].why };
    if (profileChallenges[0]) return { challenge: profileChallenges[0] };
    if (catalogChallenges[0]) return { challenge: catalogChallenges[0] };
    return null;
  }, [joined, aiSuggestions, profileChallenges, catalogChallenges]);

  const featuredId = featuredChallenge?.challenge.id;

  return (
    <AppShell title="SOCIAL" subtitle="Feed · clube · desafios">
      <div className="mb-3 flex flex-wrap gap-2">
        <Link to="/social/seguidores" search={{ dir: "following" }}>
          <Button size="sm" variant="secondary">
            Seguindo
          </Button>
        </Link>
        <Link to="/desafios" search={{ challenge: joined[0] ?? CHALLENGES[0]!.id }}>
          <Button size="sm" variant="secondary">
            Ranking
          </Button>
        </Link>
      </div>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          void navigate({
            to: "/social",
            search: {
              tab: v as "desafios" | "clubes" | "feed" | "hubs",
              ...(v === "feed" ? { feedFilter } : {}),
            },
          });
        }}
        className="w-full"
      >
        <TabsList className="mb-4 w-full rounded-full bg-muted/40 p-1">
          <TabsTrigger value="feed" className="flex-1 gap-1 rounded-full text-[0.7rem]">
            <Medal className="size-3.5" /> Para você
          </TabsTrigger>
          <TabsTrigger value="clubes" className="flex-1 gap-1 rounded-full text-[0.7rem]">
            <Users className="size-3.5" /> Clubes
          </TabsTrigger>
          <TabsTrigger value="desafios" className="flex-1 gap-1 rounded-full text-[0.7rem]">
            <Trophy className="size-3.5" /> Desafios
          </TabsTrigger>
          <TabsTrigger value="hubs" className="flex-1 gap-1 rounded-full text-[0.7rem]">
            <Radio className="size-3.5" /> Hubs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="desafios" className="mt-0 space-y-3">
          {(state.accessTier ?? "base") !== "performance" ? (
            <article className="surface-glass border-primary/30 p-4">
              <p className="eyebrow">Kit Performance</p>
              <h2 className="mt-1 text-display text-xl">{PERFORMANCE_LOCK_TITLE}</h2>
              <ul className="mt-3 space-y-2">
                {PERFORMANCE_LOCK_BENEFITS.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {line}
                  </li>
                ))}
              </ul>
              <a href={PERFORMANCE_URL} target="_blank" rel="noreferrer" className="mt-4 block">
                <Button className="h-11 w-full font-bold uppercase tracking-wide">
                  Kit Performance <ExternalLink className="size-4" />
                </Button>
              </a>
            </article>
          ) : null}
          <Link to="/hubs" className="block">
            <article className="surface-glass mb-1 flex items-center justify-between gap-3 border-primary/25 p-4">
              <div>
                <p className="eyebrow">Hub</p>
                <p className="text-sm font-semibold">Hubs Soldiers</p>
                <p className="text-xs text-muted-foreground">
                  Entre no hub Soldiers e dispute por % evolução.
                </p>
              </div>
              <Button size="sm" variant="secondary">
                Ver hubs
              </Button>
            </article>
          </Link>
          <p className="px-1 text-xs text-muted-foreground">
            Ativos: {joined.length} · Badges: {(state.earnedBadges ?? []).length}
          </p>

          {featuredChallenge ? (
            <section className="space-y-2">
              <p className="eyebrow px-1">Em destaque</p>
              <ChallengeCard
                c={featuredChallenge.challenge}
                state={state}
                joined={joined}
                deviceId={deviceId}
                toggleChallenge={toggleChallenge}
                variant="featured"
                {...(featuredChallenge.why ? { why: featuredChallenge.why } : {})}
              />
            </section>
          ) : null}

          <details className="surface-glass group">
            <summary className="cursor-pointer list-none p-4 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                Registro e wearables
                <span className="text-[0.65rem] font-normal text-muted-foreground group-open:hidden">
                  Abrir
                </span>
                <span className="hidden text-[0.65rem] font-normal text-muted-foreground group-open:inline">
                  Fechar
                </span>
              </span>
            </summary>
            <div className="space-y-3 border-t border-white/5 p-4 pt-3">
              {needsManualLog ? (
                <section className="space-y-3">
                  <p className="eyebrow">Registro manual</p>
                  <p className="text-xs text-muted-foreground">
                    Passos e futebol podem ser auto-relatados. No ranking aparece o selo correspondente —
                    verificação Strava/Garmin quando conectado.
                  </p>
                  {state.lastFraudWarning ? (
                    <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                      {state.lastFraudWarning}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Passos hoje"
                      value={stepsInput}
                      onChange={(e) => setStepsInput(e.target.value)}
                    />
                    <Button size="sm" onClick={() => submitActivity("steps", stepsInput)}>
                      + Passos
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Jogos"
                      value={footballInput}
                      onChange={(e) => setFootballInput(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => submitActivity("football", footballInput)}
                    >
                      + Jogo
                    </Button>
                  </div>
                </section>
              ) : null}
              <WearableProvidersPanel />
            </div>
          </details>

          {aiSuggestions.filter((s) => s.challenge.id !== featuredId).length ? (
            <section className="space-y-3">
              <p className="eyebrow px-1">Desafios personalizados (IA)</p>
              {aiSuggestions
                .filter((s) => s.challenge.id !== featuredId)
                .map(({ challenge: c, why }) => (
                  <ChallengeCard
                    key={c.id}
                    c={c}
                    state={state}
                    joined={joined}
                    deviceId={deviceId}
                    toggleChallenge={toggleChallenge}
                    why={why}
                  />
                ))}
            </section>
          ) : null}

          {profileChallenges.filter((c) => c.id !== featuredId).length ? (
            <section className="space-y-3">
              <p className="eyebrow px-1">Para o seu perfil</p>
              {profileChallenges
                .filter((c) => c.id !== featuredId)
                .map((c) => (
                  <ChallengeCard
                    key={c.id}
                    c={c}
                    state={state}
                    joined={joined}
                    deviceId={deviceId}
                    toggleChallenge={toggleChallenge}
                  />
                ))}
            </section>
          ) : null}

          {catalogChallenges
            .filter((c) => c.id !== featuredId)
            .map((c) => (
              <ChallengeCard
                key={c.id}
                c={c}
                state={state}
                joined={joined}
                deviceId={deviceId}
                toggleChallenge={toggleChallenge}
              />
            ))}
          <Link to="/hubs" className="block">
            <Button variant="outline" className="h-10 w-full text-xs uppercase tracking-wide">
              <Radio className="size-3.5" /> Ver Performance Hubs
            </Button>
          </Link>
          <Link to="/desafios" search={{ challenge: joined[0] ?? CHALLENGES[0]!.id }}>
            <Button variant="secondary" className="h-10 w-full text-xs uppercase tracking-wide">
              Ranking completo
            </Button>
          </Link>
        </TabsContent>

        <TabsContent value="hubs" className="mt-0 space-y-3">
          <p className="text-xs text-muted-foreground px-1">
            Hubs de creators — entre e os desafios entram automaticamente.
          </p>
          {hubs.map((hub) => {
            const joinedHub = (state.joinedHubIds ?? []).includes(hub.id);
            return (
              <Link key={hub.id} to="/hubs/$slug" params={{ slug: hub.slug }} className="block">
                <article className="surface-glass p-4">
                  <p className="eyebrow">{joinedHub ? "Membro" : "Hub"}</p>
                  <h2 className="mt-0.5 text-display text-xl">{hub.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{hub.tagline}</p>
                </article>
              </Link>
            );
          })}
          <Link to="/hubs">
            <Button variant="secondary" className="h-10 w-full text-xs uppercase tracking-wide">
              Ver todos os hubs
            </Button>
          </Link>
        </TabsContent>

        <TabsContent value="clubes" className="mt-0 space-y-3">
          {clubOffline ? (
            <p className="surface-glass p-3 text-xs text-muted-foreground">
              Clubes offline — confira a conexão e tente de novo.
            </p>
          ) : null}
          {primaryClub ? (
            <>
              <section id="liga" className="surface-glass scroll-mt-24 p-4">
                <p className="eyebrow">Liga da semana</p>
                <p className="mt-1 text-sm font-semibold">
                  {leagueMe
                    ? `#${leagueMe.rank} · ${leagueMe.points} pts`
                    : "Treine para subir no ranking do clube"}
                </p>
              </section>
              {friendQuest ? (
                <section id="missao" className="surface-glass scroll-mt-24 p-4">
                  <p className="eyebrow">Missão em dupla</p>
                  <p className="mt-1 text-sm font-semibold">
                    {friendQuest.nameA} + {friendQuest.nameB}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {friendQuest.progressA + friendQuest.progressB}/{friendQuest.target} treinos esta
                    semana
                  </p>
                </section>
              ) : null}
              {stories.length ? <ClubStoriesRail stories={stories} /> : null}
            </>
          ) : null}
          {clubs.length ? (
            clubs.map((c) => (
              <article key={c.id} className="surface-glass p-4">
                <p className="eyebrow">Seu clube</p>
                <h2 className="mt-0.5 text-display text-xl">{c.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Código {c.code} · {c.memberCount} membro{c.memberCount === 1 ? "" : "s"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      const text = `Entra no meu clube Soldiers: código ${c.code}`;
                      void (navigator.share
                        ? navigator.share({ title: "Clube Soldiers", text })
                        : navigator.clipboard.writeText(text).then(() => toast.success("Código copiado")));
                    }}
                  >
                    Convidar por código
                  </Button>
                </div>
                {c.members.length ? (
                  <ul className="mt-3 space-y-2">
                    {c.members.slice(0, 12).map((m) => (
                      <li key={m.deviceId} className="flex items-center gap-2">
                        <SocialAvatar name={m.displayName} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm">{m.displayName}</span>
                        {m.userId ? (
                          <Link
                            to="/social/$userId"
                            params={{ userId: m.userId }}
                            className="text-xs text-primary"
                          >
                            Perfil
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))
          ) : (
            <section className="surface-glass space-y-3 p-4">
              <p className="text-sm font-semibold">Crie ou entre num clube</p>
              <Input
                placeholder="Nome do clube"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
              />
              <Button
                className="w-full"
                disabled={clubBusy || !clubName.trim()}
                onClick={() => {
                  if (!state.profile?.name?.trim()) {
                    toast.error("Defina seu nome no Perfil");
                    return;
                  }
                  setClubBusy(true);
                  void createClub(deviceId, clubName.trim(), state.profile.name)
                    .then((club) => {
                      setClubs((prev) => [...prev, club]);
                      setClubName("");
                      toast.success("Clube criado");
                    })
                    .catch(() => toast.error("Falha ao criar clube"))
                    .finally(() => setClubBusy(false));
                }}
              >
                Criar clube
              </Button>
              <div className="flex gap-2">
                <Input
                  placeholder="Código"
                  value={clubCode}
                  onChange={(e) => setClubCode(e.target.value.toUpperCase())}
                />
                <Button
                  variant="secondary"
                  disabled={clubBusy || clubCode.length < 4}
                  onClick={() => {
                    if (!state.profile?.name?.trim()) {
                      toast.error("Defina seu nome no Perfil");
                      return;
                    }
                    setClubBusy(true);
                    void joinClubByCode(deviceId, clubCode.trim(), state.profile.name)
                      .then((club) => {
                        setClubs((prev) => [...prev.filter((x) => x.id !== club.id), club]);
                        setClubCode("");
                        toast.success("Entrou no clube");
                      })
                      .catch(() => toast.error("Código inválido"))
                      .finally(() => setClubBusy(false));
                  }}
                >
                  Entrar
                </Button>
              </div>
            </section>
          )}
        </TabsContent>

        <TabsContent value="feed" className="mt-0 space-y-3">
          <FeedFilterChips value={feedFilter} onChange={setFeedFilter} />
          {stories.length ? <ClubStoriesRail stories={stories} /> : null}
          {invites.length ? (
            <section className="surface-glass space-y-2 p-4">
              <p className="eyebrow">Convites</p>
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-2">
                  <p className="text-sm">
                    {inv.fromName} · {challengeById(inv.challengeId)?.title ?? inv.challengeId}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => {
                        void acceptChallengeInvite(deviceId, inv.id, state.profile?.name ?? "Soldado")
                          .then((res) => {
                            const cid = String(
                              (res as { challengeId?: string }).challengeId ?? inv.challengeId,
                            );
                            if (!joined.includes(cid)) toggleChallenge(cid);
                            setInvites((prev) => prev.filter((x) => x.id !== inv.id));
                            toast.success("Entrou no desafio");
                          })
                          .catch(() => toast.error("Não foi possível aceitar"));
                      }}
                    >
                      Aceitar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void declineChallengeInvite(deviceId, inv.id)
                          .then(() => setInvites((prev) => prev.filter((x) => x.id !== inv.id)))
                          .catch(() => toast.error("Falha ao recusar"));
                      }}
                    >
                      Recusar
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          ) : null}
          {feedStatus === "loading" ? (
            <LoadingPulse label="Carregando feed…" />
          ) : feedStatus === "error" ? (
            <EmptyState
              variant="social"
              title="Não foi possível carregar o feed"
              description="Verifique a conexão e atualize a tela."
            />
          ) : feed.length ? (
            <ActivityFeed
              events={feed}
              deviceId={deviceId}
              kudosGiven={kudosGiven}
              onKudos={(id, kind) => {
                applyReaction(id, kind);
                setKudosGiven((g) => ({ ...g, [id]: true }));
              }}
              onDismissed={(id) => setFeed((prev) => prev.filter((x) => x.id !== id))}
              onKudosQuest={markQuestKudos}
            />
          ) : (
            <div className="space-y-3">
              {feedFilter === "following" ? (
                <EmptyState
                  variant="social"
                  title="Nada de quem você segue"
                  description={
                    followingCount === 0
                      ? "Comece encontrando atletas com objetivos parecidos."
                      : "Quem você segue ainda não publicou atividade recente."
                  }
                  action={
                    <Link to="/social/seguidores" search={{ dir: "following" }}>
                      <Button className="w-full">
                        {followingCount === 0 ? "Encontrar atletas" : "Ver quem você segue"}
                      </Button>
                    </Link>
                  }
                />
              ) : feedFilter === "club" ? (
                <EmptyState
                  variant="social"
                  title={feedClub || clubs.length ? "Feed do grupo vazio" : "Entre num grupo"}
                  description={
                    feedClub || clubs.length
                      ? "Quando o clube treinar, o check-in aparece aqui."
                      : "Treinar junto muda a consistência."
                  }
                  action={
                    <Button className="w-full" type="button" onClick={() => void navigate({ to: "/social", search: { tab: "clubes" } })}>
                      {feedClub || clubs.length ? "Ver clube" : "Descobrir grupos"}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  variant="social"
                  title={EMPTY_FEED_TITLE}
                  description={
                    suggestFollow.length || clubs.length
                      ? "Siga alguém do clube ou entre num clube para aquecer o feed."
                      : EMPTY_FEED_BODY
                  }
                />
              )}
              {feedFilter === "foryou" && suggestFollow.length ? (
                <section className="surface-glass space-y-2 p-4">
                  <p className="eyebrow">Quem seguir</p>
                  <ul className="space-y-2">
                    {suggestFollow.map((p) => (
                      <li key={p.userId} className="flex items-center gap-2">
                        <Link
                          to="/social/$userId"
                          params={{ userId: p.userId }}
                          className="flex min-w-0 flex-1 items-center gap-2"
                        >
                          <SocialAvatar name={p.displayName} size="sm" />
                          <span className="truncate text-sm font-semibold">{p.displayName}</span>
                        </Link>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => {
                            void followUser(deviceId, p.userId, state.profile?.name ?? "Soldado")
                              .then(() => {
                                markFollowedSomeone();
                                setFollowingIds((prev) => new Set([...prev, p.userId]));
                                setFollowingCount((n) => n + 1);
                                toast.success(`Seguindo ${p.displayName}`);
                              })
                              .catch((err) =>
                                toast.error(err instanceof Error ? err.message : "Falha ao seguir"),
                              );
                          }}
                        >
                          Seguir
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {feedFilter === "foryou" ? (
              <div className="flex flex-col gap-2">
                <Link to="/social" search={{ tab: "clubes" }}>
                  <Button className="w-full">
                    {clubs.length ? "Ver clube" : "Criar ou entrar num clube"}
                  </Button>
                </Link>
                {primaryClub ? (
                  <Button
                    variant="secondary"
                    className="w-full"
                    type="button"
                    onClick={() => {
                      const text = `Entra no meu clube Soldiers: código ${primaryClub.code}`;
                      void (navigator.share
                        ? navigator.share({ title: "Clube Soldiers", text })
                        : navigator.clipboard
                            .writeText(text)
                            .then(() => toast.success("Código copiado")));
                    }}
                  >
                    Compartilhar código do clube
                  </Button>
                ) : (
                  <Link to="/social/seguidores" search={{ dir: "following" }}>
                    <Button variant="secondary" className="w-full">
                      Ver quem você segue
                    </Button>
                  </Link>
                )}
              </div>
              ) : null}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

