import { Copy, ExternalLink, RefreshCw, Search, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminUserLookup } from "@/lib/admin.server";
import {
  accessDaysRemaining,
  accessExpiresAtIso,
  formatAccessDate,
  isPurchaseWithinWindow,
} from "@/lib/access-window";

export function UsersTab({
  lookupEmail,
  setLookupEmail,
  lookup,
  busy,
  lastMagicUrl,
  lastError,
  onLookup,
  onResync,
  onGrant,
  onGrantTrial,
  onRevoke,
  onStatus,
}: {
  lookupEmail: string;
  setLookupEmail: (v: string) => void;
  lookup: AdminUserLookup | null;
  busy: boolean;
  lastMagicUrl: string | null;
  lastError: string | null;
  onLookup: () => void;
  onResync: () => void;
  onGrant: (tier: "base" | "performance") => void;
  onGrantTrial: () => void;
  onRevoke: () => void;
  onStatus: (status: "active" | "suspended" | "banned") => void;
}) {
  const lastPaid = lookup?.entitlement?.lastOrderAt ?? lookup?.orders[0]?.orderedAt ?? null;
  const isTrial = lookup?.entitlement?.isTrial === true;
  const windowDays = lookup?.entitlement?.windowDays ?? 40;
  const expiresAt = lastPaid ? accessExpiresAtIso(lastPaid, Date.now(), windowDays) : null;
  const daysLeft = accessDaysRemaining(expiresAt);
  const inWindow = lastPaid ? isPurchaseWithinWindow(lastPaid, Date.now(), windowDays) : false;

  const copyText = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // toast via parent would be nicer; keep silent fail ok
      const { toast } = await import("sonner");
      toast.success(okMsg);
    } catch {
      /* ignore */
    }
  };

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
        Lookup por e-mail. Sem peso, medidas ou treinos. Deep-link:{" "}
        <code className="text-[0.65rem]">/admin?tab=usuarios&amp;email=…</code>
      </p>
      {lastError ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {lastError}
        </p>
      ) : null}

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

          <div className="rounded-xl border border-white/10 px-3 py-2 text-xs">
            <p className="font-semibold">
              {isTrial
                ? `Trial · janela ${windowDays}d`
                : `Janela de acesso (${windowDays}d)`}
            </p>
            {lastPaid ? (
              <p className="mt-1 text-muted-foreground">
                {isTrial ? "Início do trial" : "Última compra"} {formatAccessDate(lastPaid)}
                {expiresAt ? ` · expira ${formatAccessDate(expiresAt)}` : ""}
                {daysLeft != null
                  ? isTrial
                    ? ` · expira em ${daysLeft}d`
                    : ` · ${daysLeft}d restantes`
                  : ""}
                {" · "}
                <span className={inWindow ? "text-primary" : "text-destructive"}>
                  {inWindow ? "dentro da janela" : "fora da janela"}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground">Sem lastPaid conhecido neste lookup.</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() =>
                  void copyText(
                    `${typeof window !== "undefined" ? window.location.origin : ""}/acesso`,
                    "Link /acesso copiado",
                  )
                }
              >
                <Copy className="size-3.5" /> Copiar /acesso
              </Button>
              {lastMagicUrl ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() => void copyText(lastMagicUrl, "Magic link copiado")}
                >
                  <Copy className="size-3.5" /> Copiar magic link
                </Button>
              ) : null}
              <a href="/acesso" target="_blank" rel="noreferrer">
                <Button size="sm" variant="ghost" className="gap-1.5">
                  Abrir /acesso <ExternalLink className="size-3.5" />
                </Button>
              </a>
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

          <p className="text-xs text-muted-foreground">
            Trial 7 dias: libera base neste e-mail. A pessoa entra/cria conta com o mesmo endereço e
            usa o magic link.
          </p>
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
            <Button size="sm" variant="secondary" onClick={onGrantTrial} disabled={busy}>
              Trial 7 dias
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
