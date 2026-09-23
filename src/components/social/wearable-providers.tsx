import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  connectWearableFn,
  getWearableProvidersFn,
  syncWearableFn,
  type WearableProvidersStatus,
} from "@/lib/wearables/wearable.functions";
import {
  nativeWearableAvailable,
  parseHealthExportJson,
  requestNativeHealthSync,
  watchNativeWearableMessages,
} from "@/lib/wearables/native-bridge";
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
): { line: string; action: "none" | "connect" | "sync" | "native" | "import" } {
  if (provider === "apple_health" || provider === "health_connect") {
    if (nativeWearableAvailable()) {
      return { line: "App nativo detectado — toque para sincronizar saúde.", action: "native" };
    }
    if (local === "connected") {
      return { line: "Dados importados. Importe de novo para atualizar.", action: "import" };
    }
    return {
      line: "No site: importe JSON do app nativo. No iOS/Android: sync direto.",
      action: "import",
    };
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
  const fileRef = useRef<HTMLInputElement>(null);
  const importProvider = useRef<"apple_health" | "health_connect">("apple_health");

  useEffect(() => {
    void getProviders()
      .then(setRemote)
      .catch(() => setRemote(null));
  }, [getProviders]);

  useEffect(() => {
    return watchNativeWearableMessages((provider, logs) => {
      if (!logs.length) return;
      ingestActivityLogs(logs);
      setWearableConnection({
        provider,
        status: "connected",
        connectedAt: new Date().toISOString(),
      });
      toast.success(`${LABELS[provider]}: ${logs.length} atividade(s)`);
    });
  }, [ingestActivityLogs, setWearableConnection]);

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

  const onNative = (provider: "apple_health" | "health_connect") => {
    setBusy(provider);
    const ok = requestNativeHealthSync(provider);
    if (!ok) {
      toast.message("Abra o app Soldiers no iOS/Android para sincronizar saúde.");
    } else {
      toast.message("Solicitando dados de saúde ao app nativo…");
      setWearableConnection({
        provider,
        status: "pending",
        connectedAt: new Date().toISOString(),
      });
    }
    setBusy(null);
  };

  const onPickImport = (provider: "apple_health" | "health_connect") => {
    importProvider.current = provider;
    fileRef.current?.click();
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    const provider = importProvider.current;
    setBusy(provider);
    try {
      const text = await file.text();
      const logs = parseHealthExportJson(text, provider);
      if (!logs.length) {
        toast.error("Arquivo sem atividades válidas (id, date, kind, value).");
        return;
      }
      ingestActivityLogs(logs);
      setWearableConnection({
        provider,
        status: "connected",
        connectedAt: new Date().toISOString(),
      });
      toast.success(`${LABELS[provider]}: ${logs.length} registro(s) importado(s)`);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const providers: WearableProviderId[] = ["strava", "garmin", "apple_health", "health_connect"];

  return (
    <section className="surface-glass space-y-3 p-4">
      <p className="eyebrow">Prova externa</p>
      <p className="text-xs text-muted-foreground">
        Auto-relato continua válido. Strava/Garmin via OAuth. Apple Health e Health Connect via app
        nativo ou importação JSON.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />
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
                <Button
                  size="sm"
                  disabled={busy === provider}
                  onClick={() => onNative(provider as "apple_health" | "health_connect")}
                >
                  Sync nativo
                </Button>
              ) : null}
              {info.action === "import" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === provider}
                  onClick={() => onPickImport(provider as "apple_health" | "health_connect")}
                >
                  Importar
                </Button>
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
