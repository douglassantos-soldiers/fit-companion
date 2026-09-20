import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { SoldiersLogo } from "@/components/soldiers-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeAccountAccess } from "@/lib/access.functions";
import { signUpWithEmail } from "@/lib/auth";
import { getDeviceId } from "@/lib/sync";
import { useStore } from "@/lib/store";
import { MIN_PASSWORD_LENGTH, CADASTRO_CONFIRM_BODY, CADASTRO_CONFIRM_TITLE } from "@/lib/ui/platform-copy";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Soldiers Training" },
      {
        name: "description",
        content: "Cadastre-se com o e-mail da loja Soldiers. Acesso por 40 dias após a última compra.",
      },
    ],
  }),
  component: CadastroPage,
});

function CadastroPage() {
  const navigate = useNavigate();
  const { state, setAccessGranted, setAuthUserId, acceptLegal } = useStore();
  const complete = useServerFn(completeAccountAccess);
  const [name, setName] = useState(state.shopifyDisplayName ?? state.profile?.name ?? "");
  const [email, setEmail] = useState(state.accessEmail ?? "");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingEmail, setAwaitingEmail] = useState(false);

  const submit = async () => {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (name.trim().length < 2) {
      setError("Informe seu nome");
      return;
    }
    if (!trimmed.includes("@")) {
      setError("Informe um e-mail válido");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`);
      return;
    }
    if (!terms) {
      setError("Aceite os termos e a política de privacidade para continuar");
      return;
    }
    setBusy(true);
    try {
      const auth = await signUpWithEmail(trimmed, password, name);
      const user = auth.user ?? auth.session?.user ?? null;
      if (!user) {
        setAwaitingEmail(true);
        return;
      }
      setAuthUserId(user.id);
      acceptLegal("terms");
      acceptLegal("privacy");
      const deviceId = getDeviceId();
      const result = await complete({
        data: {
          email: trimmed,
          deviceId,
          authUserId: user.id,
          displayName: name.trim(),
          isNewUser: true,
        },
      });
      if (!result.ok) {
        toast.error(
          result.reason === "no_purchase"
            ? "Não achamos compra neste e-mail. Use o endereço da loja."
            : "Acesso ainda bloqueado — confira a compra.",
        );
        navigate({ to: "/acesso", search: { token: undefined } });
        return;
      }
      await setAccessGranted({
        email: result.email,
        shopifyCustomerId: result.shopifyCustomerId,
        orderCount: result.orderCount,
        productIds: result.productIds,
        accessTier: result.tier,
        restockEstimates: result.restockEstimates,
        lastPaidAt: result.lastPaidAt,
        accessExpiresAt: result.accessExpiresAt,
        shopifyDisplayName: result.shopifyDisplayName ?? name.trim(),
      });
      toast.success("Conta criada");
      navigate({ to: state.profile ? "/" : "/onboarding" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar a conta");
    } finally {
      setBusy(false);
    }
  };

  if (awaitingEmail) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/20 via-background to-background" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8">
          <SoldiersLogo />
          <h1 className="mt-10 text-display text-3xl leading-none">{CADASTRO_CONFIRM_TITLE}</h1>
          <p className="mt-4 text-sm text-muted-foreground">{CADASTRO_CONFIRM_BODY}</p>
          <p className="mt-2 text-sm">
            Enviamos para <span className="font-semibold">{email.trim().toLowerCase()}</span>
          </p>
          <Link to="/entrar" className="mt-8 block">
            <Button className="h-14 w-full glow-primary font-bold uppercase tracking-wide">
              Já confirmei — entrar <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/20 via-background to-background" />
      <div className="relative mx-auto flex w-full max-w-md flex-col px-5 py-8">
        <SoldiersLogo />
        <p className="eyebrow mt-10">Cadastro</p>
        <h1 className="mt-3 text-display text-3xl leading-none">
          Crie sua conta
          <span className="mt-1 block text-primary text-glow">com o e-mail da loja</span>
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Usamos este e-mail para achar sua compra na Soldiers. O acesso vale 40 dias a partir da última
          compra paga.
        </p>

        <div className="mt-8 space-y-4">
          <div>
            <Label htmlFor="cadastro-nome">Nome</Label>
            <Input
              id="cadastro-nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como te chamamos"
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="cadastro-email">E-mail da loja</Label>
            <Input
              id="cadastro-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="cadastro-senha">Senha</Label>
            <Input
              id="cadastro-senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 8 caracteres"
              autoComplete="new-password"
            />
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
            />
            <span>
              Li e aceito os{" "}
              <Link to="/termos" className="text-primary underline">
                Termos
              </Link>{" "}
              e a{" "}
              <Link to="/privacidade" className="text-primary underline">
                Política de privacidade
              </Link>
              .
            </span>
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            size="lg"
            className="h-14 w-full glow-primary font-bold uppercase tracking-wide"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Criando…" : "Criar conta"} <ArrowRight className="size-4" />
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/entrar" className="font-semibold text-primary">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
