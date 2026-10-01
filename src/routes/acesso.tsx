import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Lock } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { SoldiersLogo } from "@/components/soldiers-logo";
import { Button } from "@/components/ui/button";
import { completeAccountAccess, grantAdminAppAccess } from "@/lib/access.functions";
import { getAuthUser, getAuthSession, signOutAuth } from "@/lib/auth";
import {
  ACCESS_PURCHASE_WINDOW_DAYS,
  daysSincePaid,
  formatAccessDate,
} from "@/lib/access-window";
import {
  consumeOpenedShopForRetry,
  markOpenedShopForRetry,
  parseAccessNext,
  resolveAccessUiState,
  stashAccessPrefillEmail,
  type AccessNextPath,
} from "@/lib/access-funnel";
import { getDeviceId } from "@/lib/sync";
import { useStore } from "@/lib/store";
import {
  getStorefrontBaseUrl,
  performanceUpgradeUrl,
  primaryReorderProductId,
  primaryReorderUrl,
} from "@/data/shopify-product-map";
import { parseMagicTokenInput, redeemMagicToken, fetchStorefrontCatalog } from "@/lib/shopify.functions";
import { EmptyState } from "@/components/app-shell";
import {
  ACCESS_PAYWALL_BENEFITS,
  ACCESS_PAYWALL_BODY_NONE,
  ACCESS_PAYWALL_BODY_STALE,
  ACCESS_PAYWALL_BODY_NEED_AUTH,
  ACCESS_PAYWALL_BODY_CONFIG,
  ACCESS_PAYWALL_TITLE_NONE,
  ACCESS_PAYWALL_TITLE_STALE,
  ACCESS_PAYWALL_TITLE_NEED_AUTH,
  ACCESS_PAYWALL_TITLE_CONFIG,
  ACCESS_EMAIL_MISMATCH,
  ACCESS_NOT_CONFIGURED,
  ACCESS_SUPPORT_MAILTO,
  ACCESS_SUPPORT_LABEL,
  ACCESS_SWITCH_EMAIL_LABEL,
  ACCESS_VERIFY_PRIMARY,
  ACCESS_VERIFY_RETURN,
  MAGIC_TOKEN_INVALID_BODY,
  MAGIC_TOKEN_INVALID_TITLE,
} from "@/lib/ui/platform-copy";
import { productById } from "@/data/products";

const STORE_URL = getStorefrontBaseUrl();
const PERFORMANCE_URL = performanceUpgradeUrl();

export const Route = createFileRoute("/acesso")({
  validateSearch: (search: Record<string, unknown>) => {
    const out: { token?: string; next?: AccessNextPath } = {};
    if (typeof search["token"] === "string" && search["token"]) out.token = search["token"];
    const next = parseAccessNext(search["next"]);
    if (next) out.next = next;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Libere o treino do dia — Soldiers Training" },
      {
        name: "description",
        content: "O acesso vale 40 dias a partir da última compra paga na loja Soldiers.",
      },
    ],
  }),
  component: AccessPage,
});

function AccessPage() {
  const navigate = useNavigate();
  const { token, next } = Route.useSearch();
  const { state, setAccessGranted, setAuthUserId } = useStore();
  const complete = useServerFn(completeAccountAccess);
  const redeem = useServerFn(redeemMagicToken);
  const grantAdmin = useServerFn(grantAdminAppAccess);
  const adminTried = useRef(false);
  const shopRetryUsed = useRef(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [tokenError, setTokenError] = useState(false);
  const [redeemedEmail, setRedeemedEmail] = useState<string | null>(null);
  const [hasAuthUser, setHasAuthUser] = useState(false);
  const [denyReason, setDenyReason] = useState<"stale_purchase" | "no_purchase" | "not_configured" | null>(
    null,
  );
  const [denyLastPaidAt, setDenyLastPaidAt] = useState<string | null>(null);
  const [catalogPrice, setCatalogPrice] = useState<string | null>(null);
  const [openedShop, setOpenedShop] = useState(false);
  const loadCatalog = useServerFn(fetchStorefrontCatalog);

  const postGrantPath = (): AccessNextPath => {
    if (next === "/" || next === "/onboarding") return next;
    return state.profile ? "/" : "/onboarding";
  };

  const authSearch = (email?: string | null) => {
    const out: { email?: string; next?: AccessNextPath } = {};
    const e = email?.trim().toLowerCase();
    if (e?.includes("@")) out.email = e;
    const n = next ?? (state.profile ? ("/" as const) : ("/onboarding" as const));
    out.next = n;
    return out;
  };

  const applyGrant = async (result: {
    email: string;
    shopifyCustomerId: string | null;
    orderCount: number;
    productIds: string[];
    tier: "base" | "performance";
    restockEstimates: typeof state.restockEstimates;
    lastPaidAt: string;
    accessExpiresAt: string;
    shopifyDisplayName: string | null;
  }) => {
    const grant = await setAccessGranted({
      email: result.email,
      shopifyCustomerId: result.shopifyCustomerId,
      orderCount: result.orderCount,
      productIds: result.productIds,
      accessTier: result.tier,
      restockEstimates: result.restockEstimates,
      lastPaidAt: result.lastPaidAt,
      accessExpiresAt: result.accessExpiresAt,
      shopifyDisplayName: result.shopifyDisplayName,
    });
    if (!grant.ok) {
      if (grant.reason === "rate_limited") {
        toast.error("Muitas tentativas, aguarde alguns minutos");
      }
      return;
    }
    toast.success("Acesso liberado");
    navigate({ to: postGrantPath() });
  };

  const verifyPurchase = async (email: string, authUserId: string) => {
    const session = adminTried.current ? null : await getAuthSession().catch(() => null);
    if (session?.access_token) {
      adminTried.current = true;
      const admin = await grantAdmin({ data: { accessToken: session.access_token } }).catch(() => null);
      if (admin?.ok) {
        toast.success("Acesso de admin liberado");
        const { revalidateAccessSession } = await import(
          "@/components/access-session-provider"
        );
        await revalidateAccessSession({ force: true });
        navigate({ to: postGrantPath() });
        return true;
      }
    }
    const result = await complete({
      data: {
        email,
        deviceId: getDeviceId(),
        authUserId,
        displayName: state.profile?.name || email,
        isNewUser: false,
      },
    });
    if (result.ok) {
      await applyGrant(result);
      return true;
    }
    if (result.reason === "stale_purchase" || result.reason === "no_purchase" || result.reason === "not_configured") {
      setDenyReason(result.reason);
    } else {
      setDenyReason("no_purchase");
    }
    setDenyLastPaidAt(result.lastPaidAt ?? null);
    return false;
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (token) {
        try {
          parseMagicTokenInput({ token });
        } catch {
          if (!cancelled) {
            setTokenError(true);
            setChecked(true);
          }
          return;
        }
        setBusy(true);
        try {
          const res = await redeem({ data: { token } });
          if (cancelled) return;
          if (!res.ok) {
            setTokenError(true);
            setChecked(true);
            return;
          }
          setRedeemedEmail(res.email);
          stashAccessPrefillEmail(res.email);
          const user = await getAuthUser();
          if (cancelled) return;
          if (user) {
            setHasAuthUser(true);
            setAuthUserId(user.id);
            await verifyPurchase(res.email, user.id);
          } else {
            setHasAuthUser(false);
          }
        } catch (e) {
          console.warn("magic token redeem failed", e);
          if (!cancelled) setTokenError(true);
        } finally {
          if (!cancelled) {
            setBusy(false);
            setChecked(true);
          }
        }
        return;
      }

      const user = await getAuthUser();
      if (cancelled) return;
      if (!user?.email) {
        setHasAuthUser(false);
        setChecked(true);
        return;
      }
      setHasAuthUser(true);
      setAuthUserId(user.id);
      setBusy(true);
      try {
        await verifyPurchase(user.email, user.id);
      } catch (e) {
        console.warn("acesso retry failed", e);
      } finally {
        if (!cancelled) {
          setBusy(false);
          setChecked(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Initial gate check only — verifyPurchase is re-run via the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, redeem, navigate, setAccessGranted, setAuthUserId, state.profile, token]);

  useEffect(() => {
    const id = primaryReorderProductId(state.purchaseProductIds);
    void loadCatalog()
      .then((res) => {
        const match = res.products.find((p) => p.productId === id) ?? res.products[0];
        setCatalogPrice(match?.price ?? null);
      })
      .catch(() => undefined);
  }, [loadCatalog, state.purchaseProductIds]);

  const ui = resolveAccessUiState({
    checked,
    tokenError,
    redeemedEmail,
    hasAuthUser,
    denyReason,
  });

  const stale = ui === "denied_stale";
  const daysAgo = daysSincePaid(denyLastPaidAt ?? state.lastPurchaseAt);
  const reorderUrl = primaryReorderUrl(state.purchaseProductIds) ?? STORE_URL;
  const reorderId = primaryReorderProductId(state.purchaseProductIds);
  const reorderName = reorderId ? (productById(reorderId)?.name ?? null) : null;
  const buyHref = stale ? reorderUrl : STORE_URL;
  const prefillEmail = redeemedEmail ?? state.accessEmail;

  const retryVerify = (opts?: { silent?: boolean }) => {
    void (async () => {
      const user = await getAuthUser();
      if (!user?.email) {
        navigate({ to: "/entrar", search: authSearch(prefillEmail) });
        return;
      }
      setHasAuthUser(true);
      setBusy(true);
      try {
        const ok = await verifyPurchase(user.email, user.id);
        if (!ok && !opts?.silent) {
          toast.error(
            denyReason === "stale_purchase" || stale
              ? "Ainda fora da janela de 40 dias."
              : denyReason === "not_configured"
                ? "Loja indisponível — tente de novo em instantes."
                : "Não encontramos compra paga neste e-mail.",
          );
        }
      } catch {
        if (!opts?.silent) toast.error("Não foi possível conferir agora.");
      } finally {
        setBusy(false);
      }
    })();
  };

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (!consumeOpenedShopForRetry() && !openedShop) return;
      if (shopRetryUsed.current || busy) return;
      if (ui !== "denied_stale" && ui !== "denied_none" && ui !== "idle_auth") return;
      shopRetryUsed.current = true;
      setOpenedShop(false);
      retryVerify({ silent: true });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui, busy, openedShop]);

  const openShop = (href: string) => {
    markOpenedShopForRetry();
    setOpenedShop(true);
    shopRetryUsed.current = false;
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const switchEmail = () => {
    void (async () => {
      await signOutAuth();
      setAuthUserId(null);
      navigate({ to: "/entrar", search: authSearch(undefined) });
    })();
  };

  const title =
    ui === "denied_stale"
      ? ACCESS_PAYWALL_TITLE_STALE
      : ui === "need_auth" || ui === "token_invalid"
        ? ACCESS_PAYWALL_TITLE_NEED_AUTH
        : ui === "denied_config"
          ? ACCESS_PAYWALL_TITLE_CONFIG
          : ACCESS_PAYWALL_TITLE_NONE;

  const body =
    ui === "denied_stale"
      ? ACCESS_PAYWALL_BODY_STALE
      : ui === "need_auth"
        ? ACCESS_PAYWALL_BODY_NEED_AUTH
        : ui === "denied_config"
          ? ACCESS_PAYWALL_BODY_CONFIG
          : ACCESS_PAYWALL_BODY_NONE;

  const showBenefits = ui === "denied_none" || ui === "denied_stale" || ui === "idle_auth";
  const showShopBlock = ui === "denied_none" || ui === "denied_stale" || ui === "idle_auth";
  const verifyIsPrimary =
    hasAuthUser && (ui === "denied_stale" || ui === "denied_none" || ui === "idle_auth" || ui === "denied_config");

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/20 via-background to-background" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8 pb-8">
        <SoldiersLogo />
        <div className="mt-10 flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Lock className="size-7" />
        </div>

        {ui === "verifying" ? (
          <>
            <h1 className="mt-5 text-display text-3xl leading-none">Conferindo sua compra…</h1>
            <p className="mt-4 text-sm text-muted-foreground">Isso leva poucos segundos.</p>
          </>
        ) : ui === "token_invalid" ? (
          <div className="mt-6">
            <EmptyState
              title={MAGIC_TOKEN_INVALID_TITLE}
              description={MAGIC_TOKEN_INVALID_BODY}
              action={
                <Link to="/entrar" search={authSearch(prefillEmail)}>
                  <Button className="w-full">Entrar com o e-mail da compra</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <h1 className="mt-5 text-display text-3xl leading-none">{title}</h1>
            {redeemedEmail && ui === "need_auth" ? (
              <p className="mt-4 text-sm">
                Compra encontrada para <span className="font-semibold">{redeemedEmail}</span>. Continue com
                este e-mail.
              </p>
            ) : null}
            <p className="mt-4 text-sm text-muted-foreground">{body}</p>
            {ui === "denied_none" ? (
              <p className="mt-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm">
                {ACCESS_EMAIL_MISMATCH}
              </p>
            ) : null}
            {ui === "denied_config" ? (
              <p className="mt-3 rounded-xl border border-white/10 px-3 py-2 text-sm text-muted-foreground">
                {ACCESS_NOT_CONFIGURED}
              </p>
            ) : null}
            {showBenefits ? (
              <ul className="mt-4 space-y-2">
                {ACCESS_PAYWALL_BENEFITS.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
            {state.accessEmail || denyLastPaidAt ? (
              <p className="mt-3 text-sm">
                {state.accessEmail ? (
                  <>
                    Conta <span className="font-semibold">{state.accessEmail}</span>
                  </>
                ) : null}
                {daysAgo != null ? ` · última compra há ${daysAgo} dia${daysAgo === 1 ? "" : "s"}` : null}
                {state.accessExpiresAt ? ` · valia até ${formatAccessDate(state.accessExpiresAt)}` : ""}
              </p>
            ) : null}
          </>
        )}

        <div className="sticky bottom-0 mt-auto -mx-5 bg-background/90 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur">
          {ui === "verifying" ? (
            <p className="text-center text-sm text-muted-foreground">Aguarde…</p>
          ) : null}

          {ui === "need_auth" ? (
            <>
              <Link to="/cadastro" search={authSearch(prefillEmail)} className="block">
                <Button size="lg" className="h-14 w-full glow-primary font-bold uppercase tracking-wide">
                  Continuar com este e-mail
                </Button>
              </Link>
              <Link to="/entrar" search={authSearch(prefillEmail)} className="mt-3 block">
                <Button size="lg" variant="secondary" className="h-12 w-full font-bold uppercase tracking-wide">
                  Já tenho conta — entrar
                </Button>
              </Link>
            </>
          ) : null}

          {showShopBlock ? (
            <>
              {verifyIsPrimary ? (
                <Button
                  size="lg"
                  className="mb-3 h-14 w-full glow-primary font-bold uppercase tracking-wide"
                  disabled={busy}
                  onClick={() => retryVerify()}
                >
                  {openedShop ? ACCESS_VERIFY_RETURN : ACCESS_VERIFY_PRIMARY}
                </Button>
              ) : null}
              {catalogPrice && !verifyIsPrimary ? (
                <p className="mb-2 text-center text-sm text-muted-foreground">
                  A partir de <span className="font-semibold text-foreground">{catalogPrice}</span>
                </p>
              ) : null}
              <Button
                size="lg"
                variant={verifyIsPrimary ? "secondary" : "default"}
                className={
                  verifyIsPrimary
                    ? "h-12 w-full font-bold uppercase tracking-wide"
                    : "h-14 w-full glow-primary font-bold uppercase tracking-wide"
                }
                onClick={() => openShop(buyHref)}
              >
                {stale && reorderName ? `Recomprar ${reorderName}` : "Comprar na loja"}{" "}
                <ExternalLink className="size-4" />
              </Button>
              {!verifyIsPrimary ? (
                <Button variant="ghost" className="mt-3 w-full" disabled={busy} onClick={() => retryVerify()}>
                  {ACCESS_VERIFY_PRIMARY}
                </Button>
              ) : null}
              <p className="mt-3 text-center text-xs">
                <a href={PERFORMANCE_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary">
                  Kit Performance — liga e desafios
                </a>
              </p>
            </>
          ) : null}

          {ui === "denied_config" ? (
            <Button
              size="lg"
              className="h-14 w-full glow-primary font-bold uppercase tracking-wide"
              disabled={busy}
              onClick={() => retryVerify()}
            >
              Tentar de novo
            </Button>
          ) : null}

          {ui === "denied_none" && hasAuthUser ? (
            <Button variant="ghost" className="mt-2 w-full" onClick={switchEmail}>
              {ACCESS_SWITCH_EMAIL_LABEL}
            </Button>
          ) : null}

          {ui !== "verifying" && ui !== "need_auth" ? (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Acesso vale {ACCESS_PURCHASE_WINDOW_DAYS} dias após a última compra paga.
            </p>
          ) : null}

          {ui === "denied_none" || ui === "denied_stale" || ui === "idle_auth" ? (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Sem conta?{" "}
              <Link to="/cadastro" search={authSearch(prefillEmail)} className="font-semibold text-primary">
                Criar cadastro
              </Link>
              {" · "}
              <Link to="/entrar" search={authSearch(prefillEmail)} className="font-semibold text-primary">
                Entrar
              </Link>
            </p>
          ) : null}

          {ui === "denied_config" || ui === "denied_none" ? (
            <p className="mt-3 text-center text-sm">
              <a href={ACCESS_SUPPORT_MAILTO} className="font-semibold text-primary">
                {ACCESS_SUPPORT_LABEL}
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
