import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState } from "@/components/app-shell";
import { ActivityFeed } from "@/components/social/activity-feed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { streak } from "@/lib/engine/dimensions";
import {
  createClub,
  ensureFriendQuest,
  fetchClubFeed,
  fetchClubLeague,
  fetchClubStories,
  hasGivenKudos,
  joinClubByCode,
  listMyClubs,
  publishClubStory,
  uploadCheckinImage,
  type ActivityEvent,
  type ClubStory,
  type ClubSummary,
  type FriendQuest,
  type LeagueRow,
} from "@/lib/social";
import { useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clubes")({
  head: () => ({
    meta: [
      { title: "Clubes — Soldiers Performance OS" },
      {
        name: "description",
        content: "Feed de check-ins, ranking semanal e convite do seu clube Soldiers.",
      },
      { property: "og:title", content: "Clubes Soldiers" },
      { property: "og:description", content: "Loop social: feed, kudos, ranking e streak." },
    ],
  }),
  component: ClubsPage,
});

function ClubsPage() {
  const { state, hydrated, markQuestKudos } = useStore();
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [activeClubId, setActiveClubId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [feed, setFeed] = useState<ActivityEvent[]>([]);
  const [league, setLeague] = useState<LeagueRow[]>([]);
  const [friendQuest, setFriendQuest] = useState<FriendQuest | null>(null);
  const [stories, setStories] = useState<ClubStory[]>([]);
  const [feedOffline, setFeedOffline] = useState(false);
  const [kudosGiven, setKudosGiven] = useState<Record<string, boolean>>({});

  const deviceId = getDeviceId();
  const activeClub = useMemo(
    () => clubs.find((c) => c.id === activeClubId) ?? clubs[0] ?? null,
    [clubs, activeClubId],
  );

  const refreshClubs = async () => {
    try {
      const rows = await listMyClubs(deviceId);
      setClubs(rows);
      setOffline(false);
      setActiveClubId((prev) => {
        if (prev && rows.some((c) => c.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (err) {
      console.warn("refreshClubs failed", err);
      setOffline(true);
    }
  };

  const refreshClubSocial = async (club: ClubSummary) => {
    const ids = club.members.map((m) => m.deviceId);
    const [feedRows, leagueRows, fq, st] = await Promise.all([
      fetchClubFeed(ids, 40),
      fetchClubLeague(club.id, ids, deviceId),
      ensureFriendQuest(deviceId, club, state.profile?.name?.trim() || "Soldado"),
      fetchClubStories(club.id),
    ]);
    if (feedRows == null) {
      setFeedOffline(true);
      setFeed([]);
    } else {
      setFeedOffline(false);
      setFeed(feedRows);
      const given: Record<string, boolean> = {};
      for (const e of feedRows) given[e.id] = hasGivenKudos(deviceId, e.id);
      setKudosGiven(given);
    }
    setLeague(leagueRows ?? []);
    setFriendQuest(fq);
    setStories(st);
  };

  useEffect(() => {
    if (!hydrated) return;
    void refreshClubs();
  }, [hydrated]);

  useEffect(() => {
    if (!activeClub) {
      setFeed([]);
      setLeague([]);
      setFriendQuest(null);
      setStories([]);
      return;
    }
    void refreshClubSocial(activeClub);
  }, [activeClub?.id, activeClub?.memberCount]);

  if (!hydrated) {
    return (
      <AppShell title="Clubes">
        <div className="surface-card h-40 animate-pulse" />
      </AppShell>
    );
  }

  const displayName = state.profile?.name?.trim() || "Soldado";
  const myStreak = streak(state.sessions);
  const shareOn = state.shareProgress !== false;

  const invite = async (club: ClubSummary) => {
    const text = `Entre no clube ${club.name} · código ${club.code} · meu streak: ${myStreak}d — Soldiers Performance`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: club.name, text });
        toast.success("Convite compartilhado");
        return;
      }
    } catch {
      /* fall through to clipboard */
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Convite copiado");
    } catch {
      toast.message(text);
    }
  };

  return (
    <AppShell title="Clubes" subtitle="Feed, ranking da semana e convite com streak">
      {offline ? (
        <p className="mb-4 surface-card p-4 text-sm text-muted-foreground">
          Clubs indisponíveis no momento. Tente de novo quando estiver online.
        </p>
      ) : null}

      {!shareOn ? (
        <p className="mb-4 surface-card p-3 text-xs text-muted-foreground">
          Progresso público desligado — seus check-ins não aparecem no feed. Ative em{" "}
          <Link to="/perfil" className="font-semibold text-primary underline">
            Perfil
          </Link>
          .
        </p>
      ) : null}

      <section className="surface-card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Criar ou entrar</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Nome do clube"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="flex-1"
          />
          <Button
            disabled={loading || !name.trim()}
            onClick={() => {
              if (!state.profile?.name?.trim()) {
                toast.error("Defina seu nome no Perfil antes");
                return;
              }
              setLoading(true);
              void createClub(deviceId, name, displayName)
                .then((club) => {
                  setName("");
                  setActiveClubId(club.id);
                  toast.success(`Clube criado · ${club.code}`);
                  return refreshClubs();
                })
                .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao criar"))
                .finally(() => setLoading(false));
            }}
          >
            Criar
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Código"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="flex-1 font-mono tracking-widest"
          />
          <Button
            variant="secondary"
            disabled={loading || code.trim().length < 4}
            onClick={() => {
              if (!state.profile?.name?.trim()) {
                toast.error("Defina seu nome no Perfil antes");
                return;
              }
              setLoading(true);
              void joinClubByCode(deviceId, code, displayName)
                .then((club) => {
                  setCode("");
                  setActiveClubId(club.id);
                  toast.success("Você entrou no clube");
                  return refreshClubs();
                })
                .catch((e) => toast.error(e instanceof Error ? e.message : "Código inválido"))
                .finally(() => setLoading(false));
            }}
          >
            Entrar
          </Button>
        </div>
      </section>

      {clubs.length === 0 ? (
        <EmptyState
          className="mt-4"
          variant="social"
          title="Nenhum clube ainda"
          description="Crie um clube ou entre com código para ver feed, ranking e convites."
          action={
            <p className="text-xs text-muted-foreground">Use os campos acima para criar ou entrar.</p>
          }
        />
      ) : (
        <>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {clubs.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveClubId(c.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  activeClub?.id === c.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          {activeClub ? (
            <div className="mt-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-display text-xl">{activeClub.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3.5" /> {activeClub.memberCount} membro(s) · {activeClub.code}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => void invite(activeClub)}>
                  <Share2 className="size-3.5" /> Convidar
                </Button>
              </div>

              <Tabs defaultValue="feed">
                <TabsList className="w-full">
                  <TabsTrigger value="feed" className="flex-1">
                    Feed
                  </TabsTrigger>
                  <TabsTrigger value="liga" className="flex-1">
                    Liga
                  </TabsTrigger>
                  <TabsTrigger value="membros" className="flex-1">
                    Membros
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="feed" className="mt-3 space-y-3">
                  {stories.length ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {stories.map((s) => (
                        <div key={s.id} className="shrink-0 text-center">
                          <img
                            src={s.imageUrl}
                            alt={s.displayName}
                            className="size-14 rounded-full border-2 border-primary object-cover"
                          />
                          <p className="mt-1 max-w-14 truncate text-[0.6rem] text-muted-foreground">
                            {s.displayName}
                          </p>
                        </div>
                      ))}
                      <label className="flex size-14 shrink-0 cursor-pointer flex-col items-center justify-center rounded-full border border-dashed border-border text-[0.55rem] text-muted-foreground">
                        + Story
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file || !activeClub) return;
                            void uploadCheckinImage(deviceId, file)
                              .then(async (url) => {
                                if (!url) throw new Error("Upload falhou");
                                await publishClubStory(activeClub.id, deviceId, url);
                                toast.success("Story publicado");
                                return refreshClubSocial(activeClub);
                              })
                              .catch(() => toast.error("Não foi possível publicar o story"));
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="surface-card flex cursor-pointer items-center justify-center gap-2 p-3 text-xs text-muted-foreground">
                      Publicar story 24h
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file || !activeClub) return;
                          void uploadCheckinImage(deviceId, file)
                            .then(async (url) => {
                              if (!url) throw new Error("Upload falhou");
                              await publishClubStory(activeClub.id, deviceId, url);
                              toast.success("Story publicado");
                              return refreshClubSocial(activeClub);
                            })
                            .catch(() => toast.error("Não foi possível publicar o story"));
                        }}
                      />
                    </label>
                  )}
                  {friendQuest ? (
                    <p className="text-xs text-muted-foreground">
                      Dupla: {friendQuest.nameA} + {friendQuest.nameB} ·{" "}
                      {friendQuest.progressA + friendQuest.progressB}/{friendQuest.target} treinos
                    </p>
                  ) : null}
                  {feedOffline ? (
                    <p className="surface-card p-4 text-sm text-muted-foreground">Feed indisponível no momento.</p>
                  ) : null}
                  {!feedOffline ? (
                    <ActivityFeed
                      events={feed}
                      deviceId={deviceId}
                      kudosGiven={kudosGiven}
                      onKudos={(id) => {
                        setFeed((prev) =>
                          prev.map((x) => (x.id === id ? { ...x, kudosCount: x.kudosCount + 1 } : x)),
                        );
                        setKudosGiven((g) => ({ ...g, [id]: true }));
                      }}
                      onKudosQuest={markQuestKudos}
                    />
                  ) : null}
                </TabsContent>

                <TabsContent value="liga" className="mt-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Liga semanal · top 3 promovidos · últimos 3 em risco
                  </p>
                  {league.every((r) => r.points === 0) ? (
                    <p className="surface-card p-4 text-sm text-muted-foreground">
                      Ninguém pontuou nesta semana ainda.
                    </p>
                  ) : (
                    <ul className="surface-card divide-y divide-border">
                      {league.map((r) => (
                        <li
                          key={r.deviceId}
                          className={cn(
                            "flex items-center justify-between gap-3 px-4 py-3 text-sm",
                            r.isYou && "bg-primary/5",
                            r.zone === "promo" && "border-l-2 border-l-primary",
                            r.zone === "risk" && "border-l-2 border-l-destructive/60",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-display w-6 text-primary">#{r.rank}</span>
                            <span className="font-semibold">
                              {r.displayName}
                              {r.isYou ? " (você)" : ""}
                            </span>
                            {r.zone === "promo" ? (
                              <span className="text-[0.6rem] uppercase text-primary">promo</span>
                            ) : null}
                            {r.zone === "risk" ? (
                              <span className="text-[0.6rem] uppercase text-destructive">risco</span>
                            ) : null}
                          </span>
                          <span className="text-xs text-muted-foreground">{r.points} pts</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="membros" className="mt-3 space-y-3">
                  <ul className="surface-card divide-y divide-border">
                    {activeClub.members.map((m) => (
                      <li key={m.deviceId} className="px-4 py-3 text-sm font-medium">
                        {m.displayName}
                        {m.deviceId === deviceId ? (
                          <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1 font-mono"
                      onClick={() => {
                        void navigator.clipboard.writeText(activeClub.code).then(
                          () => toast.success("Código copiado"),
                          () => toast.message(activeClub.code),
                        );
                      }}
                    >
                      <Copy className="size-3.5" /> {activeClub.code}
                    </Button>
                    <Button className="flex-1" onClick={() => void invite(activeClub)}>
                      <Share2 className="size-3.5" /> Compartilhar streak
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
