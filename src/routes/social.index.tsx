import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ExternalLink, Medal, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState } from "@/components/app-shell";
import { SoldiersMediaThumb } from "@/components/soldiers-media-frame";
import { ActivityFeed } from "@/components/social/activity-feed";
import { InviteFriendsButton } from "@/components/social/invite-friends";
import { WearableProvidersPanel } from "@/components/social/wearable-providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CHALLENGES,
  challengeById,
  isPersonalizedChallenge,
  isRelativeChallenge,
  type Challenge,
} from "@/data/challenges";
import { performanceUpgradeUrl } from "@/data/shopify-product-map";
import { useClubSocialFeed } from "@/hooks/use-club-social-feed";
import {
  acceptChallengeInvite,
  challengeProgress,
  createClub,
  declineChallengeInvite,
  joinClubByCode,
  listMyClubs,
  type ClubSummary,
} from "@/lib/social";
import { listPendingInvitesFn, listFollowingForInviteFn } from "@/lib/social/graph.functions";
import { suggestProfileChallenges, isProfileGeneratedChallenge } from "@/lib/engine/profile-challenges";
import { useStore } from "@/lib/store";
import { resolveChallengeMedia } from "@/lib/soldiers-media";
import { getDeviceId } from "@/lib/sync";
import type { ActivityLogKind, AppState } from "@/lib/types";
import { EMPTY_FEED_BODY, EMPTY_FEED_TITLE, PERFORMANCE_LOCK_BENEFITS, PERFORMANCE_LOCK_TITLE } from "@/lib/ui/platform-copy";

const PERFORMANCE_URL = performanceUpgradeUrl();

export const Route = createFileRoute("/social/")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab:
      search["tab"] === "clubes" || search["tab"] === "feed" || search["tab"] === "desafios"
        ? (search["tab"] as "desafios" | "clubes" | "feed")
        : "feed",
  }),
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

function progressFor(challengeId: string, state: AppState) {
  const challenge = challengeById(challengeId);
  if (!challenge) return null;
  return challengeProgress(challenge, state.sessions, {
    baseline: state.challengeBaselines?.[challengeId],
    personalTarget: state.challengePersonalTargets?.[challengeId],
    activityLogs: state.activityLogs,
    invitesSent: state.challengeInvitesSent ?? 0,
  });
}

function modeLabel(c: (typeof CHALLENGES)[number]) {
  if (isRelativeChallenge(c)) return "% evolução";
  if (isPersonalizedChallenge(c)) return "Meta pessoal";
  if (c.requiresPerformance) return "Performance";
  return c.category;
}

function SocialHubPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { state, hydrated, markQuestKudos, toggleChallenge, logActivity } = useStore();
  const deviceId = getDeviceId();
  const {
    feed,
    setFeed,
    kudosGiven,
    setKudosGiven,
    applyReaction,
  } = useClubSocialFeed({
    enabled: hydrated && Boolean(deviceId),
    deviceId,
    limit: 20,
    globalFallback: true,
    refreshKey: state.sessions.length,
    mode: "foryou",
    goal: state.profile?.goal,
    level: state.profile?.level,
  });

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
        if (!cancelled) setFollowingCount((res.people ?? []).length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [hydrated, deviceId, state.sessions.length]);

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

  const catalogChallenges = CHALLENGES.filter((c) => !isProfileGeneratedChallenge(c.id));
  const profileChallenges = suggestProfileChallenges({
    level: state.profile?.level,
    sessionCount: state.sessions.length,
    hasClub: clubs.length > 0,
    followingCount,
  });

  return (
    <AppShell title="Social" subtitle="Para você · clube · desafios">
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
            search: { tab: v as "desafios" | "clubes" | "feed" },
          });
        }}
        className="w-full"
      >
        <TabsList className="mb-4 w-full rounded-full bg-muted/40 p-1">
          <TabsTrigger value="feed" className="flex-1 gap-1 rounded-full">
            <Medal className="size-3.5" /> Para você
          </TabsTrigger>
          <TabsTrigger value="clubes" className="flex-1 gap-1 rounded-full">
            <Users className="size-3.5" /> Clubes
          </TabsTrigger>
          <TabsTrigger value="desafios" className="flex-1 gap-1 rounded-full">
            <Trophy className="size-3.5" /> Desafios
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

          {needsManualLog ? (
            <section className="surface-glass space-y-3 p-4">
              <p className="eyebrow">Registro manual</p>
              <p className="text-xs text-muted-foreground">
                Passos e futebol podem ser auto-relatados. No ranking aparece o selo correspondente — verificação
                Strava/Garmin quando conectado.
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
                <Button size="sm" variant="secondary" onClick={() => submitActivity("football", footballInput)}>
                  + Jogo
                </Button>
              </div>
            </section>
          ) : null}

          <WearableProvidersPanel />

          {profileChallenges.length ? (
            <section className="space-y-3">
              <p className="eyebrow px-1">Para o seu perfil</p>
              {profileChallenges.map((c) => (
                <HubChallengeCard
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

          {catalogChallenges.map((c) => (
            <HubChallengeCard
              key={c.id}
              c={c}
              state={state}
              joined={joined}
              deviceId={deviceId}
              toggleChallenge={toggleChallenge}
            />
          ))}
          <Link to="/desafios" search={{ challenge: joined[0] ?? CHALLENGES[0]!.id }}>
            <Button variant="secondary" className="h-10 w-full text-xs uppercase tracking-wide">
              Ranking completo
            </Button>
          </Link>
        </TabsContent>

        <TabsContent value="clubes" className="mt-0 space-y-3">
          {clubOffline ? (
            <p className="surface-glass p-3 text-xs text-muted-foreground">
              Clubes offline — confira a conexão e tente de novo.
            </p>
          ) : null}
          {clubs.length ? (
            clubs.map((c) => (
              <article key={c.id} className="surface-glass p-4">
                <p className="eyebrow">Seu clube</p>
                <h2 className="mt-0.5 text-display text-xl">{c.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Código {c.code} · {c.memberCount} membro{c.memberCount === 1 ? "" : "s"}
                </p>
                {c.members.length ? (
                  <ul className="mt-3 space-y-1">
                    {c.members.slice(0, 12).map((m) => (
                      <li key={m.deviceId} className="flex items-center justify-between text-sm">
                        <span className="truncate">{m.displayName}</span>
                        {m.userId ? (
                          <Link to="/social/$userId" params={{ userId: m.userId }} className="text-xs text-primary">
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
          {feed.length ? (
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
            <EmptyState
              variant="social"
              title={EMPTY_FEED_TITLE}
              description={EMPTY_FEED_BODY}
              action={
                <Link to="/social/seguidores" search={{ dir: "following" }}>
                  <Button className="w-full">Ver quem você segue</Button>
                </Link>
              }
            />
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function HubChallengeCard({
  c,
  state,
  joined,
  deviceId,
  toggleChallenge,
}: {
  c: Challenge;
  state: AppState;
  joined: string[];
  deviceId: string;
  toggleChallenge: (id: string) => void;
}) {
  const active = joined.includes(c.id);
  const progress = progressFor(c.id, state);
  const relative = isRelativeChallenge(c);
  const personalized = isPersonalizedChallenge(c);
  const locked = c.requiresPerformance === true && (state.accessTier ?? "base") !== "performance";
  return (
    <article className={`surface-glass p-4 ${locked ? "opacity-80" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <SoldiersMediaThumb
            media={resolveChallengeMedia(c.category)}
            alt={c.category}
            className="size-12 rounded-xl"
          />
          <div>
            <p className="eyebrow">{modeLabel(c)}</p>
            <h2 className="mt-0.5 text-display text-xl">{c.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
          </div>
        </div>
        <Trophy className="size-5 shrink-0 text-muted-foreground" />
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-[0.65rem] text-muted-foreground">
          <span>
            {progress
              ? relative
                ? `${progress.displayValue >= 0 ? "+" : ""}${progress.displayValue}% / +${progress.displayTarget}%`
                : personalized
                  ? `${progress.displayValue.toLocaleString("pt-BR")} / ${progress.displayTarget.toLocaleString("pt-BR")} ${progress.displayUnit} (${Math.round(progress.pct)}%)`
                  : `${progress.displayValue.toLocaleString("pt-BR")} / ${progress.displayTarget.toLocaleString("pt-BR")} ${progress.displayUnit}`
              : "—"}
          </span>
          <span>{c.durationDays}d</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${progress?.barPct ?? 0}%` }}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {active ? (
          <Link to="/desafios" search={{ challenge: c.id }}>
            <Button size="sm" variant="secondary">
              Ranking
            </Button>
          </Link>
        ) : null}
        {!locked || active ? (
          <Button
            size="sm"
            variant={active ? "secondary" : "default"}
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
  );
}
