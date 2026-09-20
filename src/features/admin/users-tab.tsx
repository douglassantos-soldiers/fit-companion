import { RefreshCw, Search, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminUserLookup } from "@/lib/admin.server";

export function UsersTab({
  lookupEmail,
  setLookupEmail,
  lookup,
  busy,
  onLookup,
  onResync,
  onGrant,
  onRevoke,
  onStatus,
}: {
  lookupEmail: string;
  setLookupEmail: (v: string) => void;
  lookup: AdminUserLookup | null;
  busy: boolean;
  onLookup: () => void;
  onResync: () => void;
  onGrant: (tier: "base" | "performance") => void;
  onRevoke: () => void;
  onStatus: (status: "active" | "suspended" | "banned") => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          value={lookupEmail}
          onChange={(e) => setLookupEmail(e.target.value)}
          placeholder="email@cliente.com"
          onKeyDown={(e) => {
            if (e.key === "Enter") onLookup();
          }}
        />
        <Button className="gap-2 sm:w-40" onClick={onLookup} disabled={busy}>
          <Search className="size-4" /> Buscar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Lookup por e-mail. Sem peso, medidas ou treinos.
      </p>

      {lookup ? (
        <div className="surface-glass space-y-4 p-4">
          <div className="flex items-start gap-2">
            <Shield className="mt-0.5 size-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">{lookup.email}</p>
              <p className="text-xs text-muted-foreground">
                userId: {lookup.userId ?? "—"} · tier efetivo:{" "}
                {lookup.profile?.accessTier ?? lookup.entitlement?.accessTier ?? "nenhum"}
              </p>
              <p className="mt-1 text-xs">
                Status:{" "}
                <span className="font-semibold">
                  {lookup.accountStatus?.status ?? "active"}
                  {lookup.accountStatus?.blocked ? " · bloqueado" : ""}
                </span>
                {lookup.accountStatus?.statusUntil
                  ? ` até ${new Date(lookup.accountStatus.statusUntil).toLocaleDateString("pt-BR")}`
                  : ""}
              </p>
              {lookup.accountStatus?.statusReason ? (
                <p className="text-xs text-muted-foreground">{lookup.accountStatus.statusReason}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <p>
              Pedidos (perfil):{" "}
              <span className="font-semibold">{lookup.profile?.orderCount ?? 0}</span>
            </p>
            <p>
              Shopify customer:{" "}
              <span className="font-semibold">
                {lookup.profile?.customerId ?? lookup.entitlement?.customerId ?? "—"}
              </span>
            </p>
            <p>
              Last sync:{" "}
              <span className="font-semibold">{lookup.entitlement?.updatedAt ?? "—"}</span>
            </p>
            <p>
              Devices: <span className="font-semibold">{lookup.devices.length}</span>
            </p>
          </div>

          {lookup.devices.length > 0 ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {lookup.devices.map((d) => (
                <li key={d.deviceId} className="truncate">
                  {d.deviceId}
                  {d.lastSeenAt ? ` · ${new Date(d.lastSeenAt).toLocaleString("pt-BR")}` : ""}
                </li>
              ))}
            </ul>
          ) : null}

          {lookup.orders.length > 0 ? (
            <ul className="space-y-2 text-xs">
              {lookup.orders.map((o) => (
                <li key={o.shopifyOrderId} className="rounded-lg border border-white/10 p-2">
                  <p className="font-semibold">#{o.shopifyOrderId}</p>
                  <p className="text-muted-foreground">
                    {o.financialStatus ?? "—"} · {o.total != null ? `R$ ${o.total.toFixed(2)}` : "—"} ·{" "}
                    {o.orderedAt ? new Date(o.orderedAt).toLocaleDateString("pt-BR") : "—"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum pedido local.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={onResync} disabled={busy}>
              <RefreshCw className="size-3.5" /> Resync
            </Button>
            <Button size="sm" onClick={() => onGrant("base")} disabled={busy}>
              Liberar base
            </Button>
            <Button size="sm" onClick={() => onGrant("performance")} disabled={busy}>
              Liberar performance
            </Button>
            <Button size="sm" variant="outline" onClick={onRevoke} disabled={busy}>
              Revogar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onStatus("suspended")} disabled={busy}>
              Suspender 7d
            </Button>
            <Button size="sm" variant="outline" onClick={() => onStatus("banned")} disabled={busy}>
              Banir
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onStatus("active")} disabled={busy}>
              Reativar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Busque um e-mail para ver acesso e pedidos.</p>
      )}
    </div>
  );
}
