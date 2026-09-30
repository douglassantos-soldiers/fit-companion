import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState, LoadingPulse } from "@/components/app-shell";
import { ActivityFeed } from "@/components/social/activity-feed";
import { FollowActions } from "@/components/social/follow-actions";
import { SocialAvatar } from "@/components/social/social-avatar";
import { ConfirmOverlay } from "@/components/confirm-overlay";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ACHIEVEMENTS, achievementById } from "@/data/achievements";
import { challengeById } from "@/data/challenges";
import { reportSocialContent, type ActivityEvent } from "@/lib/social";
import { getSocialProfileFn } from "@/lib/social/graph.functions";
import { useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";
import { EMPTY_PROFILE_BODY, EMPTY_PROFILE_TITLE } from "@/lib/ui/platform-copy";

export const Route = createFileRoute("/social/$userId")({
  head: () => ({
    meta: [{ title: "Perfil social — Soldiers Training" }],
  }),
  component: SocialProfilePage,
});

type ProfilePayload =
  | { ok: false }
  | { ok: true; unavailable: true; viewerUserId?: string }
  | {
      ok: true;
      unavailable: false;
      displayName: string;
      bio: string;
      avatarUrl: string | null;
      followerCount: number;
      followingCount: number;
      isSelf: boolean;
      viewerFollows: boolean;
      muted: boolean;
      blocked: boolean;
      events: ActivityEvent[];
      earnedBadges: string[];
      challenges: string[];
      evolution: { sessionCount: number; prCount: number };
    };

function SocialProfilePage() {
  const { userId } = Route.useParams();
  const { state } = useStore();
  const deviceId = getDeviceId();
  const [tab, setTab] = useState("atividades");
  const [data, setData] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);

  const reload = useCallback(() => {
    if (!deviceId || !userId) return;
    setLoading(true);
    void getSocialProfileFn({ data: { deviceId, userId } })
      .then((res) => setData(res as ProfilePayload))
      .catch(() => setData({ ok: false }))
      .finally(() => setLoading(false));
  }, [deviceId, userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loading) {
    return (
      <AppShell title="Perfil">
        <LoadingPulse />
      </AppShell>
    );
  }

  if (!data || !data.ok || data.unavailable) {
    return (
      <AppShell title="Perfil">
        <EmptyState
          variant="social"
          title={EMPTY_PROFILE_TITLE}
          description={EMPTY_PROFILE_BODY}
          action={
            <Link to="/social" search={{ tab: "feed" }}>
              <Button className="w-full">Voltar ao feed</Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  const events = (data.events ?? []) as ActivityEvent[];
  const badges = (data.earnedBadges ?? []) as string[];
  const challenges = (data.challenges ?? []) as string[];

  return (
    <AppShell title={data.displayName} subtitle="Perfil social">
      <section className="surface-glass space-y-4 p-4">
        <div className="flex flex-col items-center text-center">
          <SocialAvatar name={data.displayName} src={data.avatarUrl} size="lg" />
          <p className="mt-3 text-display text-2xl">{data.displayName}</p>
          {data.bio ? <p className="mt-1 text-xs text-muted-foreground">{data.bio}</p> : null}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Link
            to="/social/seguidores"
            search={{ dir: "followers", userId }}
            className="rounded-xl bg-muted/30 px-2 py-2"
          >
            <p className="text-lg font-bold text-foreground">{data.followerCount}</p>
            <p className="text-[0.65rem] text-muted-foreground">Seguidores</p>
          </Link>
          <Link
            to="/social/seguidores"
            search={{ dir: "following", userId }}
            className="rounded-xl bg-muted/30 px-2 py-2"
          >
            <p className="text-lg font-bold text-foreground">{data.followingCount}</p>
            <p className="text-[0.65rem] text-muted-foreground">Seguindo</p>
          </Link>
          <div className="rounded-xl bg-muted/30 px-2 py-2">
            <p className="text-lg font-bold text-foreground">{events.length}</p>
            <p className="text-[0.65rem] text-muted-foreground">Atividades</p>
          </div>
        </div>
        <FollowActions
          deviceId={deviceId}
          displayName={state.profile?.name ?? "Soldado"}
          targetUserId={userId}
          isSelf={data.isSelf}
          viewerFollows={data.viewerFollows}
          muted={data.muted}
          blocked={data.blocked}
          onChanged={reload}
        />
        {!data.isSelf ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[0.65rem] text-muted-foreground"
            onClick={() => setReportOpen(true)}
          >
            <Flag className="size-3" /> Denunciar perfil
          </button>
        ) : null}
      </section>

      <Tabs value={tab} onValueChange={setTab} className="mt-4 w-full">
        <TabsList className="mb-3 w-full rounded-full bg-muted/40 p-1">
          <TabsTrigger value="atividades" className="flex-1 rounded-full text-[0.65rem]">
            Atividades
          </TabsTrigger>
          <TabsTrigger value="evolucao" className="flex-1 rounded-full text-[0.65rem]">
            Evolução
          </TabsTrigger>
          <TabsTrigger value="conquistas" className="flex-1 rounded-full text-[0.65rem]">
            Conquistas
          </TabsTrigger>
          <TabsTrigger value="desafios" className="flex-1 rounded-full text-[0.65rem]">
            Desafios
          </TabsTrigger>
        </TabsList>
        <TabsContent value="atividades" className="mt-0">
          <ActivityFeed
            events={events}
            deviceId={deviceId}
            kudosGiven={{}}
            onKudos={() => undefined}
            interactive={!data.isSelf}
          />
        </TabsContent>
        <TabsContent value="evolucao" className="mt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <article className="surface-glass p-4 text-center">
              <p className="text-display text-3xl text-primary">{data.evolution.sessionCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Treinos publicados</p>
            </article>
            <article className="surface-glass p-4 text-center">
              <p className="text-display text-3xl text-primary">{data.evolution.prCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">PRs visíveis</p>
            </article>
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            Peso, medidas e fotos de corpo não aparecem aqui.
          </p>
        </TabsContent>
        <TabsContent value="conquistas" className="mt-0">
          {badges.length ? (
            <div className="grid grid-cols-2 gap-2">
              {badges.map((id) => {
                const a = achievementById(id as (typeof ACHIEVEMENTS)[number]["id"]) ?? {
                  id,
                  title: id,
                  emoji: "🏅",
                  description: "",
                };
                return (
                  <article key={id} className="surface-card flex flex-col items-center gap-2 p-3 text-center">
                    <span className="text-2xl" aria-hidden>
                      {a.emoji}
                    </span>
                    <p className="text-sm font-semibold leading-tight">{a.title}</p>
                    {a.description ? (
                      <p className="text-[0.65rem] text-muted-foreground line-clamp-2">{a.description}</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda sem badges públicas.</p>
          )}
        </TabsContent>
        <TabsContent value="desafios" className="mt-0 space-y-2">
          {challenges.length ? (
            challenges.map((id) => {
              const c = challengeById(id);
              return (
                <article key={id} className="surface-card p-3 text-sm">
                  {c?.title ?? id}
                </article>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum desafio ativo visível.</p>
          )}
        </TabsContent>
      </Tabs>
      <ConfirmOverlay
        open={reportOpen}
        title="Denunciar este perfil?"
        description="A denúncia vai para moderação. Não é banimento automático."
        confirmLabel="Denunciar"
        destructive
        onClose={() => setReportOpen(false)}
        onConfirm={() => {
          void reportSocialContent(deviceId, "user", userId, "inappropriate")
            .then(() => toast.success("Denúncia enviada"))
            .catch(() => toast.error("Não foi possível denunciar"));
        }}
      />
    </AppShell>
  );
}
