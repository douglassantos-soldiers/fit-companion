import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ExternalLink, Lock } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { SoldiersLogo } from "@/components/soldiers-logo";
import { Button } from "@/components/ui/button";
import { completeAccountAccess } from "@/lib/access.functions";
import { getAuthUser } from "@/lib/auth";
import {
  ACCESS_PURCHASE_WINDOW_DAYS,
  daysSincePaid,
  formatAccessDate,
} from "@/lib/access-window";
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
  ACCESS_PAYWALL_TITLE_NONE,
  ACCESS_PAYWALL_TITLE_STALE,
  ACCESS_EMAIL_MISMATCH,
  MAGIC_TOKEN_INVALID_BODY,
  MAGIC_TOKEN_INVALID_TITLE,
} from "@/lib/ui/platform-copy";
import { productById } from "@/data/products";

const STORE_URL = getStorefrontBaseUrl();
const PERFORMANCE_URL = performanceUpgradeUrl();

export const Route = createFileRoute("/acesso")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : undefined,
  }),
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
  const { token } = Route.useSearch();
  const { state, setAccessGranted, setAuthUserId } = useStore();
  const complete = useServerFn(completeAccountAccess);
  const redeem = useServerFn(redeemMagicToken);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [tokenError, setTokenError] = useState(false);
  const [redeemedEmail, setRedeemedEmail] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState<"stale_purchase" | "no_purchase" | "not_configured" | null>(
    null,
  );
  const [denyLastPaidAt, setDenyLastPaidAt] = useState<string | null>(null);
  const [catalogPrice, setCatalogPrice] = useState<string | null>(null);
  const loadCatalog = useServerFn(fetchStorefrontCatalog);

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
    await setAccessGranted({
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
    toast.success("Acesso liberado");
    navigate({ to: state.profile ? "/" : "/onboarding" });
  };

  const verifyPurchase = async (email: string, authUserId: string) => {
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
          const user = await getAuthUser();
          if (cancelled) return;
          if (user) {
            setAuthUserId(user.id);
            await verifyPurchase(res.email, user.id);
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
        setChecked(true);
        return;
      }
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

  const stale = denyReason === "stale_purchase";
  const daysAgo = daysSincePaid(denyLastPaidAt ?? state.lastPurchaseAt);
  const reorderUrl = primaryReorderUrl(state.purchaseProductIds) ?? STORE_URL;
  const reorderId = primaryReorderProductId(state.purchaseProductIds);
  const reorderName = reorderId ? (productById(reorderId)?.name ?? null) : null;
  const buyHref = stale && reorderUrl ? reorderUrl : STORE_URL;

  const retryVerify = () => {
    void (async () => {
      const user = await getAuthUser();
      if (!user?.email) {
        navigate({ to: "/entrar" });
        return;
      }
      setBusy(true);
      try {
        const ok = await verifyPurchase(user.email, user.id);
        if (!ok) toast.error(stale ? "Ainda fora da janela de 40 dias." : "Não encontramos compra paga neste e-mail.");
      } catch {
        toast.error("Não foi possível conferir agora.");
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/20 via-background to-background" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8 pb-8">
        <SoldiersLogo />
        <div className="mt-10 flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Lock className="size-7" />
        </div>
        <h1 className="mt-5 text-display text-3xl leading-none">
          {stale ? ACCESS_PAYWALL_TITLE_STALE : ACCESS_PAYWALL_TITLE_NONE}
        </h1>
        {tokenError ? (
          <div className="mt-6">
            <EmptyState
              title={MAGIC_TOKEN_INVALID_TITLE}
              description={MAGIC_TOKEN_INVALID_BODY}
              action={
                <Link to="/entrar">
                  <Button className="w-full">Entrar com o e-mail da compra</Button>
                </Link>
              }
            />
          </div>
        ) : null}
        {redeemedEmail && !tokenError ? (
          <p className="mt-4 text-sm">
            Compra encontrada para <span className="font-semibold">{redeemedEmail}</span>. Entre ou crie a
            conta com este e-mail.
          </p>
        ) : null}
        <p className="mt-4 text-sm text-muted-foreground">
          {stale ? ACCESS_PAYWALL_BODY_STALE : ACCESS_PAYWALL_BODY_NONE}
        </p>
        {denyReason === "no_purchase" ? (
          <p className="mt-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm">
            {ACCESS_EMAIL_MISMATCH}
          </p>
        ) : null}
        <ul className="mt-4 space-y-2">
          {ACCESS_PAYWALL_BENEFITS.map((line) => (
            <li key={line} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              {line}
            </li>
          ))}
        </ul>
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
        {busy && !checked ? (
          <p className="mt-4 text-sm text-muted-foreground">Conferindo sua compra…</p>
        ) : null}

        <div className="sticky bottom-0 mt-auto -mx-5 bg-background/90 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur">
          {catalogPrice ? (
            <p className="mb-2 text-center text-sm text-muted-foreground">
              A partir de <span className="font-semibold text-foreground">{catalogPrice}</span>
            </p>
          ) : null}
          <a href={buyHref} target="_blank" rel="noreferrer" className="block">
            <Button size="lg" className="h-14 w-full glow-primary font-bold uppercase tracking-wide">
              {stale && reorderName ? `Recomprar ${reorderName}` : "Comprar na loja"}{" "}
              <ExternalLink className="size-4" />
            </Button>
          </a>
          <a href={PERFORMANCE_URL} target="_blank" rel="noreferrer" className="mt-3 block">
            <Button size="lg" variant="secondary" className="h-12 w-full font-bold uppercase tracking-wide">
              Kit Performance — liga e desafios
            </Button>
          </a>
          <Button variant="ghost" className="mt-3 w-full" disabled={busy} onClick={retryVerify}>
            Já comprei — verificar de novo
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Acesso vale {ACCESS_PURCHASE_WINDOW_DAYS} dias após a última compra paga.
          </p>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Sem conta?{" "}
            <Link to="/cadastro" className="font-semibold text-primary">
              Criar cadastro
            </Link>
            {" · "}
            <Link to="/entrar" className="font-semibold text-primary">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
