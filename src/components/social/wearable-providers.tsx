import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  connectWearableFn,
  getWearableProvidersFn,
  syncWearableFn,
  type WearableProvidersStatus,
} from "@/lib/wearables/wearable.functions";
import { useStore } from "@/lib/store";
import type { WearableLinkStatus, WearableProviderId } from "@/lib/types";

const LABELS: Record<WearableProviderId, string> = {
  strava: "Strava",
  garmin: "Garmin",
  apple_health: "Apple Health",
  health_connect: "Health Connect",
};

function statusCopy(
  provider: WearableProviderId,
  remote: WearableProvidersStatus | null,
  local?: WearableLinkStatus,
): { line: string; action: "none" | "connect" | "sync" | "native" } {
  if (provider === "apple_health" || provider === "health_connect") {
    return { line: "Requer app iOS/Android — não verifica neste site.", action: "native" };
  }
  const ready = remote?.[provider];
  if (ready === "not_configured") return { line: "Em configuração (sem credencial OAuth).", action: "none" };
  if (local === "connected") return { line: "Conectado. Sincronize atividades recentes.", action: "sync" };
  if (ready === "ready") return { line: "Pronto para conectar.", action: "connect" };
  return { line: "Desconectado.", action: "connect" };
}

export function WearableProvidersPanel() {
  const { state, ingestActivityLogs, setWearableConnection } = useStore();
  const getProviders = useServerFn(getWearableProvidersFn);
  const connect = useServerFn(connectWearableFn);
  const sync = useServerFn(syncWearableFn);
  const [remote, setRemote] = useState<WearableProvidersStatus | null>(null);
  const [busy, setBusy] = useState<WearableProviderId | null>(null);

  useEffect(() => {
    void getProviders()
      .then(setRemote)
      .catch(() => setRemote(null));
  }, [getProviders]);

  const localOf = (provider: WearableProviderId) =>
    state.wearableConnections?.find((c) => c.provider === provider)?.status;

  const onConnect = async (provider: "strava" | "garmin") => {
    setBusy(provider);
    try {
      const res = await connect({ data: { provider } });
      if (!res.ok) {
        toast.message(
          res.reason === "not_configured"
            ? "Em configuração — credencial do provedor ausente"
            : res.reason === "unauthorized"
              ? "Faça login para conectar"
              : "Não foi possível iniciar a conexão",
        );
        return;
      }
      window.location.assign(res.authUrl);
    } finally {
      setBusy(null);
    }
  };

  const onSync = async (provider: "strava" | "garmin") => {
    setBusy(provider);
    try {
      const res = await sync({ data: { provider } });
      if (!res.ok) {
        toast.message(
          res.reason === "not_configured"
            ? "Em configuração"
            : res.reason === "unauthorized"
              ? "Faça login para sincronizar"
              : "Sincronização indisponível",
        );
        return;
      }
      ingestActivityLogs(res.logs);
      setWearableConnection({
        provider,
        status: "connected",
        connectedAt: new Date().toISOString(),
      });
      toast.success(`${LABELS[provider]} sincronizado`);
    } finally {
      setBusy(null);
    }
  };

  const providers: WearableProviderId[] = ["strava", "garmin", "apple_health", "health_connect"];

  return (
    <section className="surface-glass space-y-3 p-4">
      <p className="eyebrow">Prova externa</p>
      <p className="text-xs text-muted-foreground">
        Auto-relato continua válido. Strava/Garmin verificam quando houver OAuth. Apple Health e Health
        Connect não verificam neste site.
      </p>
      <ul className="space-y-2">
        {providers.map((provider) => {
          const local = localOf(provider);
          const info = statusCopy(provider, remote, local);
          return (
            <li key={provider} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{LABELS[provider]}</p>
                <p className="text-[0.65rem] text-muted-foreground">{info.line}</p>
              </div>
              {info.action === "connect" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === provider}
                  onClick={() => void onConnect(provider as "strava" | "garmin")}
                >
                  Conectar
                </Button>
              ) : null}
              {info.action === "sync" ? (
                <Button size="sm" disabled={busy === provider} onClick={() => void onSync(provider as "strava" | "garmin")}>
                  Sincronizar
                </Button>
              ) : null}
              {info.action === "native" ? (
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Nativo
                </span>
              ) : null}
              {info.action === "none" ? (
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Em config.
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
