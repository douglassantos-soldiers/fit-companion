/**
 * Shared shell for /governance/* — admin session gate, read-only notice.
 */
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkAdminSession, loginAdmin, logoutAdmin } from "@/lib/access.functions";
import { GOVERNANCE_NAV } from "@/features/governance/nav";

export function GovernanceShell(props: {
  active: string;
  children: React.ReactNode;
}) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const doCheck = useServerFn(checkAdminSession);
  const doLogin = useServerFn(loginAdmin);
  const doLogout = useServerFn(logoutAdmin);

  useEffect(() => {
    void doCheck()
      .then((r) => setAuthed(Boolean(r.ok)))
      .finally(() => setChecking(false));
  }, [doCheck]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        Verificando sessão…
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <form
          className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            void doLogin({ data: { email, password } })
              .then((r) => {
                if (r.ok) setAuthed(true);
                else setError(r.reason === "rate_limited" ? "Muitas tentativas" : "Credenciais inválidas");
              })
              .catch(() => setError("Falha no login"));
          }}
        >
          <h1 className="text-lg font-semibold text-zinc-100">AI Governance</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Acesso admin/analyst — somente leitura. Não altera Decision Engine.
          </p>
          <label className="mt-4 block text-xs text-zinc-400" htmlFor="gov-email">
            E-mail
          </label>
          <input
            id="gov-email"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <label className="mt-3 block text-xs text-zinc-400" htmlFor="gov-password">
            Senha
          </label>
          <input
            id="gov-password"
            type="password"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
          <button
            type="submit"
            className="mt-4 w-full rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900"
          >
            Entrar
          </button>
          <Link to="/admin" search={{ tab: "dashboard" }} className="mt-3 block text-center text-xs text-zinc-500 underline">
            Ir para Admin Console
          </Link>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-wide">AI Governance Console</p>
            <p className="text-[11px] text-zinc-500">Observabilidade read-only · sem mutação de Decision</p>
          </div>
          <button
            type="button"
            className="text-xs text-zinc-400 underline"
            onClick={() => {
              void doLogout().then(() => setAuthed(false));
            }}
          >
            Sair
          </button>
        </div>
        <nav className="mx-auto mt-3 flex max-w-6xl flex-wrap gap-1">
          {GOVERNANCE_NAV.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              className={`rounded px-2.5 py-1 text-xs ${
                props.active === item.id
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{props.children}</main>
    </div>
  );
}

export function MetricCard(props: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{props.label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-100">{props.value}</p>
    </div>
  );
}

export function pct(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}
