import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink, Medal, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ActivityFeed } from "@/components/social/activity-feed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHALLENGES, challengeById, isRelativeChallenge } from "@/data/challenges";
import { performanceUpgradeUrl } from "@/data/shopify-product-map";
import { useClubSocialFeed } from "@/hooks/use-club-social-feed";
import {
  challengeProgress,
  createClub,
  joinClubByCode,
  listMyClubs,
  type ClubSummary,
} from "@/lib/social";
import { useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";
import type { AppState } from "@/lib/types";

const PERFORMANCE_URL = performanceUpgradeUrl();

export const Route = createFileRoute("/social")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab:
      search["tab"] === "clubes" || search["tab"] === "feed" || search["tab"] === "desafios"
        ? (search["tab"] as "desafios" | "clubes" | "feed")
        : "desafios",
  }),
  head: () => ({
    meta: [
      { title: "Social — Soldiers Training" },
      {
        name: "description",
        content: "Desafios, clubes e feed — ranking e pressão saudável.",
      },
    ],
  }),
  component: SocialHubPage,
});

function progressFor(challengeId: string, state: AppState) {
  const challenge = challengeById(challengeId);
  if (!challenge) return null;
  return challengeProgress(challenge, state.sessions, state.challengeBaselines?.[challengeId]);
}

function SocialHubPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { state, hydrated, markQuestKudos, toggleChallenge } = useStore();
  const deviceId = getDeviceId();
  const {
    feed,
    setFeed,
    kudosGiven,
    setKudosGiven,
  } = useClubSocialFeed({
    enabled: hydrated && Boolean(deviceId) && state.shareProgress,
    deviceId,
    limit: 12,
    globalFallback: true,
    refreshKey: state.sessions.length,
  });

  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [clubName, setClubName] = useState("");
  const [clubCode, setClubCode] = useState("");
  const [clubBusy, setClubBusy] = useState(false);
  const [clubOffline, setClubOffline] = useState(false);

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
    return () => {
      cancelled = true;
    };
  }, [hydrated, deviceId, state.sessions.length]);

  const joined = state.challenges ?? [];

  return (
    <AppShell title="Social" subtitle="Desafios, clubes e feed">
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
          <TabsTrigger value="desafios" className="flex-1 gap-1 rounded-full">
            <Trophy className="size-3.5" /> Desafios
          </TabsTrigger>
          <TabsTrigger value="clubes" className="flex-1 gap-1 rounded-full">
            <Users className="size-3.5" /> Clubes
          </TabsTrigger>
          <TabsTrigger value="feed" className="flex-1 gap-1 rounded-full">
            <Medal className="size-3.5" /> Feed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="desafios" className="mt-0 space-y-3">
          <Link to="/hubs" className="block">
            <article className="surface-glass mb-1 flex items-center justify-between gap-3 border-primary/25 p-4">
              <div>
                <p className="eyebrow">Creator OS</p>
                <p className="text-sm font-semibold">Performance Hubs</p>
                <p className="text-xs text-muted-foreground">Entre no hub Soldiers e dispute por % evolução.</p>
              </div>
              <Button size="sm" variant="secondary">
                Ver hubs
              </Button>
            </article>
          </Link>
          <p className="px-1 text-xs text-muted-foreground">
            Ativos: {joined.length} · Badges: {(state.earnedBadges ?? []).length}
          </p>
          {CHALLENGES.map((c) => {
            const active = joined.includes(c.id);
            const progress = progressFor(c.id, state);
            const relative = isRelativeChallenge(c);
            const locked =
              c.requiresPerformance === true && (state.accessTier ?? "base") !== "performance";
            return (
              <article key={c.id} className={`surface-glass p-4 ${locked ? "opacity-80" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="eyebrow">
                      {relative ? "% evolução" : c.requiresPerformance ? "Performance" : c.metric}
                    </p>
                    <h2 className="mt-0.5 text-display text-xl">{c.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                  </div>
                  <Trophy className="size-5 shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-[0.65rem] text-muted-foreground">
                    <span>
                      {progress
                        ? relative
                          ? `${progress.displayValue >= 0 ? "+" : ""}${progress.displayValue}% / +${progress.displayTarget}%`
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
                <div className="mt-3 flex justify-end">
                  {locked && !active ? (
                    <a href={PERFORMANCE_URL} target="_blank" rel="noreferrer">
                      <Button size="sm" className="gap-1">
                        Kit Performance <ExternalLink className="size-3" />
                      </Button>
                    </a>
                  ) : (
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
                  )}
                </div>
              </article>
            );
          })}
          <Link to="/desafios" className="block pt-1">
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
                  const displayName = state.profile?.name?.trim() || "Soldado";
                  setClubBusy(true);
                  void createClub(deviceId, clubName.trim(), displayName)
                    .then((c) => {
                      setClubs((prev) => [c, ...prev]);
                      setClubName("");
                      toast.success("Clube criado");
                    })
                    .catch((err) => {
                      console.warn("createClub failed", err);
                      toast.error("Não foi possível criar o clube");
                    })
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
                  className="uppercase"
                />
                <Button
                  variant="secondary"
                  disabled={clubBusy || clubCode.trim().length < 4}
                  onClick={() => {
                    const displayName = state.profile?.name?.trim() || "Soldado";
                    setClubBusy(true);
                    void joinClubByCode(deviceId, clubCode.trim(), displayName)
                      .then((c) => {
                        setClubs((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);
                        setClubCode("");
                        toast.success(`Entrou em ${c.name}`);
                      })
                      .catch((err) => {
                        console.warn("joinClub failed", err);
                        toast.error("Código inválido ou indisponível");
                      })
                      .finally(() => setClubBusy(false));
                  }}
                >
                  Entrar
                </Button>
              </div>
            </section>
          )}
          <Link to="/clubes" className="block">
            <Button variant="secondary" className="h-10 w-full text-xs uppercase tracking-wide">
              Abrir clubes
            </Button>
          </Link>
        </TabsContent>

        <TabsContent value="feed" className="mt-0">
          {feed.length ? (
            <ActivityFeed
              events={feed}
              deviceId={deviceId}
              kudosGiven={kudosGiven}
              onKudos={(id) => {
                setFeed((prev) => prev.map((x) => (x.id === id ? { ...x, kudosCount: x.kudosCount + 1 } : x)));
                setKudosGiven((g) => ({ ...g, [id]: true }));
              }}
              onKudosQuest={markQuestKudos}
            />
          ) : (
            <section className="surface-glass p-6 text-center">
              <p className="text-sm font-semibold">Feed quieto por enquanto</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Complete um treino ou entre num clube para ver atividade aqui.
              </p>
            </section>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
