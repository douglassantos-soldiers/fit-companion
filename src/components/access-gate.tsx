import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkAccessSession } from "@/lib/access.functions";
import { useStore } from "@/lib/store";

const PUBLIC_PATHS = ["/acesso", "/welcome", "/admin"];

/**
 * Requires server-signed access cookie.
 * localStorage accessGranted alone is not enough after session check.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const { state, hydrated, updateAccessFromSession, revokeAccessLocal } = useStore();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const checkSession = useServerFn(checkAccessSession);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void checkSession()
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setSessionOk(true);
          updateAccessFromSession({ email: res.email, tier: res.tier });
        } else {
          setSessionOk(false);
          revokeAccessLocal();
        }
      })
      .catch((e) => {
        if (cancelled) return;
        console.warn("checkAccessSession failed", e);
        // Fail closed for protected routes when server unreachable after hydrate
        setSessionOk(false);
      })
      .finally(() => {
        if (!cancelled) setSessionChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, checkSession, updateAccessFromSession, revokeAccessLocal]);

  useEffect(() => {
    if (!hydrated || !sessionChecked) return;
    const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!sessionOk && !isPublic) {
      void navigate({ to: "/welcome" });
      return;
    }
    if (sessionOk && (pathname === "/acesso" || pathname === "/welcome")) {
      void navigate({ to: state.profile ? "/" : "/onboarding" });
    }
  }, [hydrated, sessionChecked, sessionOk, state.profile, pathname, navigate]);

  if (!hydrated || !sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-pulse rounded-full bg-primary/40" />
      </div>
    );
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!sessionOk && !isPublic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-pulse rounded-full bg-primary/40" />
      </div>
    );
  }

  return <>{children}</>;
}
