/**
 * Session-scoped auth + Shopify access bootstrap.
 * Validates once per app session; route changes reuse cache; stale/background revalidation only.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkAccessSession, grantAdminAppAccess } from "@/lib/access.functions";
import {
  ACCESS_SESSION_STALE_MS,
  isAuthUserSwitch,
  shouldSkipRevalidate,
  type RevalidateOptions,
} from "@/lib/access-session-cache";
import { getAuthSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

export type AccessSessionState = {
  ready: boolean;
  hasAuth: boolean;
  authUserId: string | null;
  shopifyOk: boolean;
  accountBlocked: boolean;
  connectionError: boolean;
  adminCookieLost: boolean;
  /** Once access was OK this session — soft protect onboarding on flaky re-check. */
  heldAccess: boolean;
  email: string | null;
  tier: "base" | "performance" | null;
  lastPaidAt: string | null;
  validatedAt: number | null;
  revalidate: (opts?: RevalidateOptions) => Promise<void>;
  invalidate: () => void;
};

const AccessSessionContext = createContext<AccessSessionState | null>(null);

type Invalidator = () => void;
type Revalidator = (opts?: RevalidateOptions) => Promise<void>;

let moduleInvalidator: Invalidator | null = null;
let moduleRevalidator: Revalidator | null = null;

/** Invalidate client access cache (logout / user switch). Safe if provider not mounted. */
export function invalidateAccessSession() {
  moduleInvalidator?.();
}

/** Force or soft revalidate from outside the React tree (e.g. after establishAccess). */
export function revalidateAccessSession(opts?: RevalidateOptions): Promise<void> {
  return moduleRevalidator?.(opts) ?? Promise.resolve();
}

export function useAccessSession(): AccessSessionState {
  const ctx = useContext(AccessSessionContext);
  if (!ctx) {
    throw new Error("useAccessSession must be used within AccessSessionProvider");
  }
  return ctx;
}

export function AccessSessionProvider({ children }: { children: ReactNode }) {
  const { hydrated, updateAccessFromSession, revokeAccessLocal } = useStore();
  const checkSession = useServerFn(checkAccessSession);
  const grantAdmin = useServerFn(grantAdminAppAccess);

  const [ready, setReady] = useState(false);
  const [hasAuth, setHasAuth] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [shopifyOk, setShopifyOk] = useState(false);
  const [accountBlocked, setAccountBlocked] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [adminCookieLost, setAdminCookieLost] = useState(false);
  const [heldAccess, setHeldAccess] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [tier, setTier] = useState<"base" | "performance" | null>(null);
  const [lastPaidAt, setLastPaidAt] = useState<string | null>(null);
  const [validatedAt, setValidatedAt] = useState<number | null>(null);

  const adminGrantedRef = useRef(false);
  const adminTriedRef = useRef(false);
  const authUserIdRef = useRef<string | null>(null);
  const validatedAtRef = useRef<number | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const bootstrappedRef = useRef(false);
  const updateAccessFromSessionRef = useRef(updateAccessFromSession);
  const revokeAccessLocalRef = useRef(revokeAccessLocal);
  updateAccessFromSessionRef.current = updateAccessFromSession;
  revokeAccessLocalRef.current = revokeAccessLocal;

  const runValidation = useCallback(async () => {
    try {
      const session = await getAuthSession();
      const nextUserId = session?.user?.id ?? null;
      setHasAuth(Boolean(session?.user));
      setAuthUserId(nextUserId);
      authUserIdRef.current = nextUserId;
      setConnectionError(false);
    } catch (e) {
      console.warn("getAuthSession failed", e);
      setHasAuth(false);
      setAuthUserId(null);
      authUserIdRef.current = null;
      setConnectionError(true);
    }

    try {
      let res = await checkSession();
      if (!res.ok && res.reason !== "account_blocked" && !adminTriedRef.current) {
        const s = await getAuthSession();
        if (s?.access_token) {
          adminTriedRef.current = true;
          const g = await grantAdmin({ data: { accessToken: s.access_token } }).catch(() => null);
          if (g?.ok) {
            adminGrantedRef.current = true;
            res = await checkSession();
          } else if (g && !g.ok && g.reason === "account_blocked") {
            res = { ok: false, reason: "account_blocked" };
          }
        }
      }

      if (res.ok) {
        setAccountBlocked(false);
        setShopifyOk(true);
        setHeldAccess(true);
        setAdminCookieLost(false);
        setEmail(res.email ?? null);
        setTier(res.tier ?? null);
        setLastPaidAt(res.lastPaidAt ?? null);
        updateAccessFromSessionRef.current({
          email: res.email,
          tier: res.tier,
          lastPaidAt: res.lastPaidAt,
        });
      } else {
        setShopifyOk(false);
        setAccountBlocked(res.reason === "account_blocked");
        setEmail(null);
        setTier(null);
        setLastPaidAt(null);
        setAdminCookieLost(adminGrantedRef.current && res.reason === "no_session");
        // revokeAccessLocal is path-aware — AccessGate decides (onboarding heldAccess).
      }
    } catch (e) {
      console.warn("checkAccessSession failed", e);
      setShopifyOk(false);
      setConnectionError(true);
    } finally {
      const now = Date.now();
      validatedAtRef.current = now;
      setValidatedAt(now);
      setReady(true);
    }
  }, [checkSession, grantAdmin]);

  const revalidate = useCallback(
    async (opts?: RevalidateOptions) => {
      const force = opts?.force === true;
      if (
        shouldSkipRevalidate(validatedAtRef.current, Date.now(), ACCESS_SESSION_STALE_MS, force)
      ) {
        return;
      }
      if (inFlightRef.current) return inFlightRef.current;
      const p = runValidation().finally(() => {
        inFlightRef.current = null;
      });
      inFlightRef.current = p;
      return p;
    },
    [runValidation],
  );

  const invalidate = useCallback(() => {
    validatedAtRef.current = null;
    setValidatedAt(null);
    setShopifyOk(false);
    setAccountBlocked(false);
    setHeldAccess(false);
    setEmail(null);
    setTier(null);
    setLastPaidAt(null);
    setAdminCookieLost(false);
    adminGrantedRef.current = false;
    adminTriedRef.current = false;
    revokeAccessLocalRef.current();
  }, []);

  useEffect(() => {
    moduleInvalidator = () => {
      invalidate();
      void revalidate({ force: true });
    };
    moduleRevalidator = revalidate;
    return () => {
      moduleInvalidator = null;
      moduleRevalidator = null;
    };
  }, [invalidate, revalidate]);

  // Initial bootstrap once store is hydrated — not on every route change.
  useEffect(() => {
    if (!hydrated || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    void runValidation();
  }, [hydrated, runValidation]);

  // Auth lifecycle: never reuse authorization across users; force refresh on sign-in/out.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const nextId = session?.user?.id ?? null;
      const switched = isAuthUserSwitch(authUserIdRef.current, nextId);
      if (event === "SIGNED_OUT" || switched) {
        invalidate();
        setHasAuth(Boolean(session?.user));
        setAuthUserId(nextId);
        authUserIdRef.current = nextId;
        void revalidate({ force: true });
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setHasAuth(Boolean(session?.user));
        setAuthUserId(nextId);
        authUserIdRef.current = nextId;
        void revalidate({ force: event === "SIGNED_IN" });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [invalidate, revalidate]);

  // Soft revalidation when tab becomes visible and cache is stale.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      void revalidate({ force: false });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [revalidate]);

  const value = useMemo<AccessSessionState>(
    () => ({
      ready,
      hasAuth,
      authUserId,
      shopifyOk,
      accountBlocked,
      connectionError,
      adminCookieLost,
      heldAccess,
      email,
      tier,
      lastPaidAt,
      validatedAt,
      revalidate,
      invalidate,
    }),
    [
      ready,
      hasAuth,
      authUserId,
      shopifyOk,
      accountBlocked,
      connectionError,
      adminCookieLost,
      heldAccess,
      email,
      tier,
      lastPaidAt,
      validatedAt,
      revalidate,
      invalidate,
    ],
  );

  return <AccessSessionContext.Provider value={value}>{children}</AccessSessionContext.Provider>;
}
