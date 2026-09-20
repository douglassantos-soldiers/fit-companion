import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { syncWearableFn } from "@/lib/wearables/wearable.functions";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/wearables/callback")({
  validateSearch: (search: Record<string, unknown>): { code?: string; state?: string } => {
    const code = typeof search["code"] === "string" ? search["code"] : undefined;
    const state = typeof search["state"] === "string" ? search["state"] : undefined;
    return { ...(code ? { code } : {}), ...(state ? { state } : {}) };
  },
  component: WearableCallbackPage,
});

function WearableCallbackPage() {
  const { code, state } = Route.useSearch();
  const navigate = useNavigate();
  const sync = useServerFn(syncWearableFn);
  const { ingestActivityLogs, setWearableConnection, hydrated } = useStore();
  const ran = useRef(false);

  useEffect(() => {
    if (!hydrated || ran.current) return;
    ran.current = true;
    const provider = state === "garmin" ? "garmin" : "strava";
    void (async () => {
      if (!code) {
        toast.error("Código de autorização ausente");
        void navigate({ to: "/social", search: { tab: "desafios" } });
        return;
      }
      const res = await sync({ data: { provider, code } });
      if (res.ok) {
        ingestActivityLogs(res.logs);
        setWearableConnection({
          provider,
          status: "connected",
          connectedAt: new Date().toISOString(),
        });
        toast.success("Prova sincronizada");
      } else {
        toast.message(
          res.reason === "not_configured"
            ? "Provedor em configuração"
            : res.reason === "unauthorized"
              ? "Faça login para concluir"
              : "Não foi possível sincronizar",
        );
      }
      void navigate({ to: "/social", search: { tab: "desafios" } });
    })();
  }, [hydrated, code, state, ingestActivityLogs, navigate, setWearableConnection, sync]);

  return (
    <AppShell title="Wearables">
      <p className="text-sm text-muted-foreground">Concluindo conexão…</p>
    </AppShell>
  );
}
