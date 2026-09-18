import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { SoldiersLogo } from "@/components/soldiers-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DENY_MSG, redeemMagicToken, trackAppEvent, verifyShopifyPurchase } from "@/lib/shopify.functions";
import { getDeviceId } from "@/lib/sync";
import { useStore } from "@/lib/store";
import { getStorefrontBaseUrl, performanceUpgradeUrl } from "@/data/shopify-product-map";

const STORE_URL = getStorefrontBaseUrl();
const PERFORMANCE_URL = performanceUpgradeUrl();

export const Route = createFileRoute("/acesso")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Liberar acesso — Soldiers Training" },
      {
        name: "description",
        content: "Use o e-mail da sua compra na Soldiers para liberar o app.",
      },
    ],
  }),
  component: AccessPage,
});

function AccessPage() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const { state, hydrated, setAccessGranted } = useStore();
  const verify = useServerFn(verifyShopifyPurchase);
  const redeem = useServerFn(redeemMagicToken);
  const track = useServerFn(trackAppEvent);
  const [email, setEmail] = useState(state.accessEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenTried, setTokenTried] = useState(false);

  useEffect(() => {
    if (!hydrated || state.accessGranted || !token || tokenTried) return;
    setTokenTried(true);
    setBusy(true);
    void (async () => {
      try {
        const result = await redeem({ data: { token } });
        if (!result.ok) {
          setError(
            result.reason === "not_configured"
              ? "Link indisponível no momento. Use o e-mail da compra."
              : "Link inválido ou expirado. Use o e-mail da compra.",
          );
          return;
        }
        await setAccessGranted({
          email: result.email,
          shopifyCustomerId: result.customerId,
          orderCount: result.orderCount,
          productIds: result.productIds,
          accessTier: result.accessTier,
          restockEstimates: result.restockEstimates,
        });
        const deviceId = getDeviceId();
        if (deviceId) {
          void track({ data: { deviceId, kind: "access_granted", payload: { via: "magic_token" } } });
        }
        toast.success("Acesso liberado");
        navigate({ to: state.profile ? "/" : "/onboarding" });
      } catch {
        setError("Não foi possível validar o link. Tente o e-mail.");
      } finally {
        setBusy(false);
      }
    })();
  }, [hydrated, state.accessGranted, state.profile, token, tokenTried, redeem, setAccessGranted, track, navigate]);

  if (hydrated && state.accessGranted) {
    void navigate({ to: state.profile ? "/" : "/onboarding" });
  }

  const submit = async () => {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setError("Informe um e-mail válido");
      return;
    }
    setBusy(true);
    try {
      const result = await verify({ data: { email: trimmed } });
      if (!result.ok) {
        if (result.reason === "not_configured") {
          setError("Verificação indisponível no momento. Tente mais tarde.");
        } else if (result.reason === "upstream") {
          setError("Não foi possível consultar a loja agora. Tente de novo.");
        } else {
          setError(DENY_MSG);
        }
        return;
      }
      await setAccessGranted({
        email: trimmed,
        shopifyCustomerId: result.customerId,
        orderCount: result.orderCount,
        productIds: result.productIds,
        accessTier: result.accessTier,
        restockEstimates: result.restockEstimates,
      });
      const deviceId = getDeviceId();
      if (deviceId) {
        void track({ data: { deviceId, kind: "access_granted", payload: { via: "email" } } });
      }
      toast.success("Acesso liberado");
      navigate({ to: state.profile ? "/" : "/onboarding" });
    } catch {
      setError("Não foi possível verificar agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <SoldiersLogo />
        <div className="surface-glass mt-8 p-6">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Lock className="size-6" />
          </div>
          <h1 className="text-display text-3xl leading-none">Acesso Soldiers</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {token
              ? "Validando seu link de compra…"
              : "Digite o e-mail usado na compra na loja. Qualquer pedido pago libera o app de forma permanente."}
          </p>

          {!token ? (
            <ul className="mt-5 space-y-2.5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">Treino do dia</strong>
                  <span className="text-muted-foreground"> — plano com carga e progressão</span>
                </span>
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">Coach + nutrição</strong>
                  <span className="text-muted-foreground"> — próximo passo sem planilha</span>
                </span>
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">Desafios e clubes</strong>
                  <span className="text-muted-foreground"> — ranking e pressão saudável</span>
                </span>
              </li>
            </ul>
          ) : null}

          <div className="mt-6 space-y-3">
            <div>
              <Label htmlFor="access-email">E-mail da compra</Label>
              <Input
                id="access-email"
                type="email"
                autoComplete="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
                disabled={busy}
                className="mt-1.5"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button className="h-12 w-full font-bold uppercase tracking-wide" disabled={busy} onClick={() => void submit()}>
              <ShieldCheck className="size-4" />
              {busy ? "Verificando…" : "Liberar acesso"}
            </Button>
          </div>

          <a
            href={PERFORMANCE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-primary"
          >
            Ainda não comprei — ver kit Performance <ExternalLink className="size-3.5" />
          </a>
          <a
            href={STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex items-center justify-center gap-1.5 text-[0.65rem] text-muted-foreground"
          >
            Ou ir à loja completa
          </a>
        </div>
        <p className="mt-4 text-center text-[0.7rem] text-muted-foreground">
          Usamos só o e-mail para confirmar pedidos pagos na Shopify. Seus dados de treino ficam no seu aparelho.
        </p>
      </div>
    </div>
  );
}
