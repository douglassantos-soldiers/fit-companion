import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell, EmptyState } from "@/components/app-shell";
import { FollowActions } from "@/components/social/follow-actions";
import { Button } from "@/components/ui/button";
import { EMPTY_FOLLOW_BODY, EMPTY_FOLLOW_TITLE } from "@/lib/ui/platform-copy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listFollowsFn } from "@/lib/social/graph.functions";
import { useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";

export const Route = createFileRoute("/social/seguidores")({
  validateSearch: (search: Record<string, unknown>) => {
    const dir = search["dir"] === "followers" ? ("followers" as const) : ("following" as const);
    const userId = typeof search["userId"] === "string" && search["userId"] ? search["userId"] : "";
    return userId ? { dir, userId } : { dir };
  },
  head: () => ({
    meta: [{ title: "Seguidores — Soldiers Training" }],
  }),
  component: FollowersPage,
});

function FollowersPage() {
  const search = Route.useSearch();
  const dir = search.dir;
  const searchUserId = "userId" in search ? search.userId : "";
  const { state } = useStore();
  const deviceId = getDeviceId();
  const targetId = searchUserId || state.userId || "";
  const [people, setPeople] = useState<Array<{ userId: string; displayName: string }>>([]);
  const [tab, setTab] = useState(dir);

  const load = useCallback(
    (nextDir: "followers" | "following") => {
      if (!deviceId || !targetId) return;
      void listFollowsFn({ data: { deviceId, userId: targetId, dir: nextDir } })
        .then((res) => setPeople(res.people ?? []))
        .catch(() => setPeople([]));
    },
    [deviceId, targetId],
  );

  useEffect(() => {
    load(tab);
  }, [load, tab]);

  return (
    <AppShell title="Grafo" subtitle="Seguidores, seguindo, bloquear e silenciar">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v === "followers" ? "followers" : "following")}
        className="w-full"
      >
        <TabsList className="mb-3 w-full rounded-full bg-muted/40 p-1" aria-label="Seguindo ou seguidores">
          <TabsTrigger value="following" className="flex-1 rounded-full">
            Seguindo
          </TabsTrigger>
          <TabsTrigger value="followers" className="flex-1 rounded-full">
            Seguidores
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-0 space-y-2">
          {!people.length ? (
            <EmptyState
              variant="social"
              title={EMPTY_FOLLOW_TITLE}
              description={EMPTY_FOLLOW_BODY}
              action={
                <Link to="/social" search={{ tab: "feed" }}>
                  <Button className="w-full">Voltar ao feed</Button>
                </Link>
              }
            />
          ) : (
            people.map((p) => (
              <article key={p.userId} className="surface-card space-y-2 p-3">
                <Link to="/social/$userId" params={{ userId: p.userId }} className="text-sm font-semibold">
                  {p.displayName}
                </Link>
                <FollowActions
                  deviceId={deviceId}
                  displayName={state.profile?.name ?? "Soldado"}
                  targetUserId={p.userId}
                  isSelf={p.userId === state.userId}
                  viewerFollows={tab === "following"}
                  onChanged={() => load(tab)}
                />
              </article>
            ))
          )}
        </TabsContent>
      </Tabs>
      <Link to="/social" search={{ tab: "feed" }} className="mt-4 block">
        <Button variant="secondary" className="w-full">
          Voltar ao feed
        </Button>
      </Link>
    </AppShell>
  );
}
