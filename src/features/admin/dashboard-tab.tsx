import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProductAnalytics } from "@/lib/analytics.server";

export function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-glass p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}

export function DashboardTab({
  analytics,
  busy,
  onRefresh,
}: {
  analytics: ProductAnalytics | null;
  busy: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <Button variant="secondary" className="gap-2" onClick={onRefresh} disabled={busy}>
        <RefreshCw className="size-4" /> {busy ? "Carregando…" : "Atualizar"}
      </Button>
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
        <p className="text-sm text-muted-foreground">Abra o dashboard para carregar as métricas (sem PII).</p>
      )}
    </div>
  );
}
