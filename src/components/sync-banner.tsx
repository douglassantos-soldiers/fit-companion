import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStoreState } from "@/lib/store";
import { getDeviceId, pushState } from "@/lib/sync";
import {
  clearPersistentSyncFailure,
  readPersistentSyncFailure,
  type PersistentSyncFailure,
} from "@/lib/sync/critical";

/** Sticky banner when critical push left a persistent failure on disk. */
export function SyncBanner() {
  const { state, hydrated } = useStoreState();
  const [failure, setFailure] = useState<PersistentSyncFailure | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setFailure(readPersistentSyncFailure());
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    refresh();
    const timer = window.setInterval(refresh, 2500);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", refresh);
    };
  }, [hydrated, refresh]);

  if (!failure) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm"
    >
      <p className="font-semibold text-foreground">Sincronização pendente</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Alguns dados ficaram só neste aparelho. Toque para tentar de novo.
      </p>
      <Button
        size="sm"
        variant="secondary"
        className="mt-2"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void (async () => {
            try {
              const deviceId = getDeviceId() || failure.deviceId;
              const result = await pushState(deviceId, state);
              if (result.ok && !result.persistentFailed) {
                clearPersistentSyncFailure();
                setFailure(null);
                toast.success("Sincronizado");
              } else {
                refresh();
                toast.error("Ainda não sincronizou");
              }
            } catch {
              toast.error("Falha ao sincronizar");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {busy ? "Tentando…" : "Tentar agora"}
      </Button>
    </div>
  );
}
