import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { SoldiersSplash, type SplashStatus } from "@/components/soldiers-splash";
import { useAccessSession } from "@/components/access-session-provider";
import { useStore } from "@/lib/store";

const PUBLIC_PATHS = [
  "/acesso",
  "/welcome",
  "/admin",
  "/governance",
  "/cadastro",
  "/entrar",
  "/termos",
  "/privacidade",
  "/wearables",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Dual gate: Supabase Auth (identity) + Shopify paid window (cookie).
 * Auth/access bootstrap lives in AccessSessionProvider (once per session).
 * This component only applies route policy from cached session state.
 *
 * Admin / iframe: SameSite=None cookies (access-session.server) + anti-loop —
 * if grantAdmin succeeds but the next checkSession fails, show a clear error
 * instead of bouncing /acesso ↔ /onboarding forever.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const { state, hydrated, revokeAccessLocal } = useStore();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const {
    ready,
    hasAuth,
    shopifyOk,
    accountBlocked,
    connectionError,
    adminCookieLost,
    heldAccess,
  } = useAccessSession();

  // Path-aware revoke: keep onboarding if access was held this session (transient cookie blip).
  useEffect(() => {
    if (!hydrated || !ready) return;
    if (shopifyOk || adminCookieLost) return;
    if (!hasAuth) return;
    const onOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
    if (onOnboarding && heldAccess) return;
    revokeAccessLocal();
  }, [
    hydrated,
    ready,
    hasAuth,
    shopifyOk,
    adminCookieLost,
    heldAccess,
    pathname,
    revokeAccessLocal,
  ]);

  useEffect(() => {
    if (!hydrated || !ready) return;
    const isPublic = isPublicPath(pathname);
    const onOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
    if (!hasAuth && !isPublic) {
      void navigate({ to: "/welcome" });
      return;
    }
    if (hasAuth && accountBlocked && !isPublic) {
      return;
    }
    if (hasAuth && !shopifyOk && !accountBlocked && !isPublic) {
      if (adminCookieLost) return;
      // Keep wizard if access was held this session (transient cookie blip)
      if (onOnboarding && heldAccess) return;
      void navigate({
        to: "/acesso",
        search: {
          next: state.profile ? "/" : "/onboarding",
        },
      });
      return;
    }
    if (
      hasAuth &&
      shopifyOk &&
      (pathname === "/acesso" ||
        pathname === "/welcome" ||
        pathname === "/cadastro" ||
        pathname === "/entrar")
    ) {
      void navigate({ to: state.profile ? "/" : "/onboarding" });
      return;
    }
    if (hasAuth && !shopifyOk && pathname === "/welcome") {
      void navigate({
        to: "/acesso",
        search: {
          next: state.profile ? "/" : "/onboarding",
        },
      });
    }
  }, [
    hydrated,
    ready,
    hasAuth,
    shopifyOk,
    accountBlocked,
    adminCookieLost,
    heldAccess,
    state.profile,
    pathname,
    navigate,
  ]);

  const splashStatus = (): SplashStatus => {
    if (connectionError) return "connection_error";
    if (!hydrated || !ready) return "loading";
    if (hasAuth && !shopifyOk && !accountBlocked) return "access_invalid";
    if (hasAuth) return "authenticated";
    return "unauthenticated";
  };

  if (!hydrated || !ready) {
    return <SoldiersSplash status={splashStatus()} />;
  }

  const isPublic = isPublicPath(pathname);
  if (hasAuth && accountBlocked && !isPublic) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 text-center">
        <h1 className="text-display text-2xl">Conta suspensa</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta conta está bloqueada. O progresso é mantido; o acesso volta quando a suspensão terminar.
        </p>
        <a
          href="mailto:privacy@soldiersnutrition.com.br?subject=Conta%20suspensa%20Soldiers%20Training"
          className="mt-6 text-sm font-semibold text-primary"
        >
          Falar com o suporte
        </a>
        <button
          type="button"
          className="mt-3 text-sm text-muted-foreground underline"
          onClick={() => window.location.reload()}
        >
          Tentar de novo
        </button>
      </div>
    );
  }
  if (adminCookieLost && !shopifyOk && !isPublic) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 text-center">
        <h1 className="text-display text-2xl">Acesso de admin não guardado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Não foi possível guardar o acesso neste navegador. Abra o app em uma nova aba e entre de novo.
        </p>
        <a
          href="mailto:privacy@soldiersnutrition.com.br?subject=Acesso%20admin%20Soldiers%20Training"
          className="mt-6 text-sm font-semibold text-primary"
        >
          Falar com o suporte
        </a>
        <button
          type="button"
          className="mt-3 text-sm text-muted-foreground underline"
          onClick={() => window.location.reload()}
        >
          Tentar de novo
        </button>
      </div>
    );
  }
  const onOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const allowed =
    isPublic || (hasAuth && shopifyOk) || (hasAuth && onOnboarding && heldAccess);
  if (!allowed) {
    return <SoldiersSplash status={splashStatus()} />;
  }

  return <>{children}</>;
}
