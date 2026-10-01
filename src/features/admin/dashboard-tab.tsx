import { AdminErrorBanner, AdminReloadButton } from "@/features/admin/ui";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { ProductAnalytics } from "@/lib/analytics.server";
import type { ShopifyOpsSnapshot } from "@/lib/admin.server";
import { cn } from "@/lib/utils";

export function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-glass p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}

const STALE_WEBHOOK_MS = 24 * 60 * 60 * 1000;

export function DashboardTab({
  analytics,
  busy,
  onRefresh,
  ops,
  opsBusy,
  onOpenSistema,
  loadError,
}: {
  analytics: ProductAnalytics | null;
  busy: boolean;
  onRefresh: () => void;
  ops: ShopifyOpsSnapshot | null;
  opsBusy: boolean;
  onOpenSistema: () => void;
  loadError: string | null;
}) {
  const lastWebhook = ops?.webhooks[0] ?? null;
  const lastWebhookMs = lastWebhook ? Date.parse(lastWebhook.processedAt) : NaN;
  const webhookStale =
    !lastWebhook ||
    !Number.isFinite(lastWebhookMs) ||
    Date.now() - lastWebhookMs > STALE_WEBHOOK_MS;
  const lastCursor = ops?.cursors[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <AdminReloadButton busy={busy} onReload={onRefresh} label="Atualizar métricas" />
      </div>

      <AdminErrorBanner message={loadError} />

      <div className="surface-glass space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Saúde Shopify</p>
          <Button size="sm" variant="outline" onClick={onOpenSistema} disabled={opsBusy}>
            Ver Sistema
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 font-semibold",
              webhookStale
                ? "border-destructive/40 text-destructive"
                : "border-primary/40 text-primary",
            )}
          >
            {opsBusy
              ? "Webhooks…"
              : lastWebhook
                ? webhookStale
                  ? `Webhook stale · ${lastWebhook.topic}`
                  : `Webhook ok · ${lastWebhook.topic}`
                : "Sem webhooks"}
          </span>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-muted-foreground">
            {lastWebhook
              ? new Date(lastWebhook.processedAt).toLocaleString("pt-BR")
              : "—"}
          </span>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-muted-foreground">
            Cursor: {lastCursor?.id ?? "—"}
          </span>
        </div>
        <p className="text-[0.65rem] text-muted-foreground">
          Chip vermelho se o último webhook tiver mais de 24h.{" "}
          <Link to="/admin" search={{ tab: "sistema" }} className="font-semibold text-primary">
            Abrir Sistema
          </Link>
        </p>
      </div>

      {analytics ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Usuários" value={analytics.ops.users} />
            <MetricCard label="Ativos 7d" value={analytics.ops.active7d} />
            <MetricCard label="Novos 7d" value={analytics.ops.new7d} />
            <MetricCard label="Treinos 7d" value={analytics.ops.workouts7d} />
            <MetricCard label="PRs 7d" value={analytics.ops.prs7d} />
            <MetricCard label="Joins desafio" value={analytics.ops.challengeJoins7d} />
            <MetricCard label="Completes" value={analytics.ops.challengeCompletes7d} />
            <MetricCard label="Posts 7d" value={analytics.ops.posts7d} />
          </div>
          <div className="surface-glass overflow-x-auto p-4">
            <p className="text-sm font-semibold">Tendência 7 dias</p>
            <table className="mt-2 w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 font-medium">Dia</th>
                  <th className="py-1 font-medium">Treinos</th>
                  <th className="py-1 font-medium">Ativos</th>
                </tr>
              </thead>
              <tbody>
                {analytics.ops.trend.map((row) => (
                  <tr key={row.date} className="border-t border-white/5">
                    <td className="py-1">{row.date.slice(5)}</td>
                    <td className="py-1">{row.workouts}</td>
                    <td className="py-1">{row.actives}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Cadastros" value={analytics.funnel.created} />
            <MetricCard label="Onboarding" value={analytics.funnel.onboarded} />
            <MetricCard label="1º treino" value={analytics.funnel.firstWorkout} />
            <MetricCard label="2º treino" value={analytics.funnel.secondWorkout} />
          </div>
          <div className="surface-glass p-4">
            <p className="text-sm font-semibold">Retenção (coorte user_created)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Coorte {analytics.retention.cohortSize} · D1 {analytics.retention.d1} · D7{" "}
              {analytics.retention.d7} · D30 {analytics.retention.d30}
            </p>
          </div>
          <div className="surface-glass p-4">
            <p className="text-sm font-semibold">North star</p>
            <p className="mt-1 text-2xl font-bold text-primary">{analytics.northStar.users}</p>
            <p className="text-xs text-muted-foreground">
              Users com ≥3 treinos nos últimos {analytics.northStar.windowDays} dias
            </p>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {busy ? "Carregando métricas…" : "Abra o dashboard para carregar as métricas (sem PII)."}
        </p>
      )}
    </div>
  );
}
