import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Radio, Users } from "lucide-react";
import { AppShell, LoadingPulse } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { HUBS } from "@/data/hubs";
import { listHubs, type Hub } from "@/lib/hubs";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/hubs")({
  head: () => ({
    meta: [
      { title: "Hubs — Soldiers Training" },
      {
        name: "description",
        content: "Performance Hubs Soldiers — entre no desafio do creator e evolua com ranking relativo.",
      },
    ],
  }),
  component: HubsListPage,
});

function HubsListPage() {
  const { state, hydrated } = useStore();
  const [hubs, setHubs] = useState<Hub[]>(HUBS);
  const joined = state.joinedHubIds ?? [];

  useEffect(() => {
    let cancelled = false;
    void listHubs().then((rows) => {
      if (!cancelled && rows.length) setHubs(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hydrated) {
    return (
      <AppShell title="Hubs">
        <LoadingPulse />
      </AppShell>
    );
  }

  return (
    <AppShell title="Hubs" subtitle="Hubs Soldiers">
      <header className="mb-6">
        <p className="eyebrow">Hub</p>
        <h2 className="mt-1 text-display text-3xl leading-none">Hubs</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Entre no hub, ative o desafio e compete por % de evolução — não por total bruto.
        </p>
      </header>

      <div className="space-y-4">
        {hubs.map((h) => {
          const active = joined.includes(h.id);
          return (
            <article key={h.id} className="surface-glass p-5">
              <p className="eyebrow">{h.creatorName}</p>
              <h3 className="mt-1 text-display text-2xl">{h.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{h.tagline}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Radio className="size-3.5" /> {h.challengeIds.length} desafio(s)
                </span>
                {typeof h.memberCount === "number" ? (
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" /> {h.memberCount} membro(s)
                  </span>
                ) : null}
                {active ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                    Inscrito
                  </span>
                ) : null}
              </div>
              <Link to="/hubs/$slug" params={{ slug: h.slug }} className="mt-4 block">
                <Button className="w-full gap-2" variant={active ? "secondary" : "default"}>
                  {active ? "Abrir hub" : "Ver hub"} <ArrowRight className="size-4" />
                </Button>
              </Link>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
