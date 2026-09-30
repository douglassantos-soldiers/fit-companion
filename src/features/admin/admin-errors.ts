/**
 * Typed admin UI errors + tab-data load policy (lazy per tab).
 * Keep fetch triggers in AdminPage.selectTab — this module owns messaging only.
 */
export function adminErrorMessage(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : "";
  if (/not.?configured|não configurado/i.test(msg)) return "Admin/loja não configurado no servidor";
  if (/db|database|indispon/i.test(msg)) return "Banco indisponível — tente de novo";
  if (msg) return msg;
  return fallback;
}

export type AdminLoadState = "idle" | "loading" | "ready" | "error";

export function adminEmptyCopy(kind: "metrics" | "ops" | "reports" | "lookup"): string {
  switch (kind) {
    case "metrics":
      return "Sem métricas ainda — atualize o dashboard.";
    case "ops":
      return "Sem eventos Shopify ainda.";
    case "reports":
      return "Fila de moderação vazia.";
    case "lookup":
      return "Busque um e-mail para ver acesso e pedidos.";
  }
}
