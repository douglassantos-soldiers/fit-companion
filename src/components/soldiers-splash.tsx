import logo from "@/assets/soldiers-logo.png.asset.json";

export type SplashStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "access_invalid"
  | "connection_error";

const STATUS_HINT: Record<SplashStatus, string> = {
  loading: "Carregando sua evolução…",
  authenticated: "Entrando…",
  unauthenticated: "Preparando acesso…",
  access_invalid: "Validando compra…",
  connection_error: "Sem conexão — tentando de novo…",
};

/**
 * Brand splash (§6) — logo + short pulse while AccessGate resolves session/access.
 * OAuth social providers are intentionally out of scope.
 */
export function SoldiersSplash({
  status = "loading",
  message,
}: {
  status?: SplashStatus;
  message?: string;
}) {
  const hint = message ?? STATUS_HINT[status];
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/20 via-background to-background" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative flex flex-col items-center gap-5 animate-in fade-in duration-500">
        <img
          src={logo.url}
          alt="Soldiers"
          className="h-14 w-auto animate-pulse drop-shadow-[0_0_24px_hsl(var(--primary)/0.35)]"
        />
        <p className="text-display text-[0.65rem] tracking-[0.32em] text-primary">TRAINING</p>
        <p className="mt-2 max-w-[16rem] text-center text-xs text-muted-foreground">{hint}</p>
        {status === "connection_error" ? (
          <p className="text-[0.65rem] uppercase tracking-wider text-destructive/80">Erro de conexão</p>
        ) : null}
      </div>
    </div>
  );
}
