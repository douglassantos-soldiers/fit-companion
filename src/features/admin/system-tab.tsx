import { RefreshCw, Square, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ShopifyOpsSnapshot } from "@/lib/admin.server";
import { CUSTOMERS_LIST_CURSOR_ID, type ShopifyCustomerImportTotals } from "@/lib/shopify-customers";

export function SystemTab({
  ops,
  busy,
  onReload,
  importRunning,
  importTotals,
  onImport,
  onImportStop,
}: {
  ops: ShopifyOpsSnapshot | null;
  busy: boolean;
  onReload: () => void;
  importRunning: boolean;
  importTotals: ShopifyCustomerImportTotals | null;
  onImport: (reset: boolean) => void;
  onImportStop: () => void;
}) {
  const listCursor = ops?.cursors.find((c) => c.id === CUSTOMERS_LIST_CURSOR_ID);

  return (
    <div className="space-y-4">
      <Button variant="secondary" className="gap-2" onClick={onReload} disabled={busy || importRunning}>
        <RefreshCw className="size-4" /> {busy ? "Carregando…" : "Atualizar"}
      </Button>

      <div className="surface-glass space-y-3 p-4">
        <p className="text-sm font-semibold">Clientes Shopify</p>
        <p className="text-xs text-muted-foreground">
          Importa ficha e pedidos pagos em lotes. Não libera acesso ao app — a janela de 40 dias
          continua valendo.
        </p>
        <div className="flex flex-wrap gap-2">
          {importRunning ? (
            <Button variant="secondary" className="gap-2" onClick={onImportStop}>
              <Square className="size-4" /> Parar
            </Button>
          ) : (
            <>
              <Button className="gap-2" onClick={() => onImport(false)} disabled={busy}>
                <Users className="size-4" /> Importar clientes Shopify
              </Button>
              <Button variant="secondary" onClick={() => onImport(true)} disabled={busy}>
                Do início
              </Button>
            </>
          )}
        </div>
        {importRunning ? (
          <p className="text-xs text-muted-foreground">Importando lotes…</p>
        ) : null}
        {importTotals ? (
          <div className="grid gap-1 text-xs sm:grid-cols-2">
            <p>
              Processados: <span className="font-semibold">{importTotals.processed}</span>
            </p>
            <p>
              Criados: <span className="font-semibold">{importTotals.created}</span>
            </p>
            <p>
              Vinculados: <span className="font-semibold">{importTotals.linked}</span>
            </p>
            <p>
              Sem e-mail: <span className="font-semibold">{importTotals.skippedNoEmail}</span>
            </p>
            <p>
              Pedidos: <span className="font-semibold">{importTotals.ordersUpserted}</span>
            </p>
            <p>
              Erros: <span className="font-semibold">{importTotals.errorCount}</span>
            </p>
            {!importRunning ? (
              <p className="sm:col-span-2">
                {importTotals.hasMore ? "Há mais páginas na Shopify." : "Listagem concluída."}
              </p>
            ) : null}
          </div>
        ) : null}
        {listCursor ? (
          <p className="truncate text-xs text-muted-foreground">
            Cursor da listagem: {listCursor.cursorValue ?? "—"}
          </p>
        ) : null}
      </div>

      <div className="surface-glass p-4">
        <p className="text-sm font-semibold">Webhooks recentes</p>
        {!ops?.webhooks.length ? (
          <p className="mt-2 text-xs text-muted-foreground">Nenhum evento ainda.</p>
        ) : (
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-xs">
            {ops.webhooks.map((w) => (
              <li key={w.id} className="flex flex-wrap justify-between gap-2 border-b border-white/5 pb-2">
                <span className="font-medium">{w.topic}</span>
                <span className="text-muted-foreground">
                  {new Date(w.processedAt).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="surface-glass p-4">
        <p className="text-sm font-semibold">Sync cursors</p>
        {!ops?.cursors.length ? (
          <p className="mt-2 text-xs text-muted-foreground">Nenhum cursor.</p>
        ) : (
          <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto text-xs">
            {ops.cursors.map((c) => (
              <li key={c.id} className="border-b border-white/5 pb-2">
                <p className="truncate font-medium">{c.id}</p>
                <p className="text-muted-foreground">
                  {c.cursorValue ?? "—"} · {new Date(c.updatedAt).toLocaleString("pt-BR")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
