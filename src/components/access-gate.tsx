import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SoldiersSplash, type SplashStatus } from "@/components/soldiers-splash";
import { checkAccessSession } from "@/lib/access.functions";
import { getAuthSession } from "@/lib/auth";
import { useStore } from "@/lib/store";

const PUBLIC_PATHS = ["/acesso", "/welcome", "/admin", "/cadastro", "/entrar", "/termos", "/privacidade", "/wearables"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Dual gate: Supabase Auth (identity) + Shopify paid window (cookie).
 * Device is a channel, not the person.
 * Brand splash while session/access resolve (OAuth social is out of scope).
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const { state, hydrated, updateAccessFromSession, revokeAccessLocal } = useStore();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const checkSession = useServerFn(checkAccessSession);
  const [ready, setReady] = useState(false);
  const [hasAuth, setHasAuth] = useState(false);
  const [shopifyOk, setShopifyOk] = useState(false);
  const [accountBlocked, setAccountBlocked] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const shopifyOkRef = useRef(shopifyOk);
  shopifyOkRef.current = shopifyOk;

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    if (!shopifyOkRef.current && !isPublicPath(pathname)) {
      setReady(false);
    }
    void (async () => {
      try {
        const session = await getAuthSession();
        if (cancelled) return;
        setHasAuth(Boolean(session?.user));
        setConnectionError(false);
      } catch (e) {
        if (cancelled) return;
        console.warn("getAuthSession failed", e);
        setHasAuth(false);
        setConnectionError(true);
      }
      try {
        const res = await checkSession();
        if (cancelled) return;
        if (res.ok) {
          setAccountBlocked(false);
          setShopifyOk(true);
          updateAccessFromSession({
            email: res.email,
            tier: res.tier,
            lastPaidAt: res.lastPaidAt,
          });
        } else {
          setShopifyOk(false);
          setAccountBlocked(res.reason === "account_blocked");
          revokeAccessLocal();
        }
      } catch (e) {
        if (cancelled) return;
        console.warn("checkAccessSession failed", e);
        setShopifyOk(false);
        setConnectionError(true);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, pathname, checkSession, updateAccessFromSession, revokeAccessLocal]);

  useEffect(() => {
    if (!hydrated || !ready) return;
    const isPublic = isPublicPath(pathname);
    if (!hasAuth && !isPublic) {
      void navigate({ to: "/welcome" });
      return;
    }
    if (hasAuth && accountBlocked && !isPublic) {
      return;
    }
    if (hasAuth && !shopifyOk && !accountBlocked && !isPublic) {
      void navigate({ to: "/acesso", search: { token: undefined } });
      return;
    }
    if (hasAuth && shopifyOk && (pathname === "/acesso" || pathname === "/welcome" || pathname === "/cadastro" || pathname === "/entrar")) {
      void navigate({ to: state.profile ? "/" : "/onboarding" });
      return;
    }
    if (hasAuth && !shopifyOk && pathname === "/welcome") {
      void navigate({ to: "/acesso", search: { token: undefined } });
    }
  }, [hydrated, ready, hasAuth, shopifyOk, accountBlocked, state.profile, pathname, navigate]);

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
      </div>
    );
  }
  const allowed = isPublic || (hasAuth && shopifyOk);
  if (!allowed) {
    return <SoldiersSplash status={splashStatus()} />;
  }

  return <>{children}</>;
}
