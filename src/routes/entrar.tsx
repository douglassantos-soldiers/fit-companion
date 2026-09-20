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
import { resetPassword, signInWithPassword } from "@/lib/auth";
import { getDeviceId } from "@/lib/sync";
import { useStore } from "@/lib/store";
import { MIN_PASSWORD_LENGTH } from "@/lib/ui/platform-copy";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Soldiers Training" },
      {
        name: "description",
        content: "Entre com e-mail e senha. O acesso é revalidado pela última compra (40 dias).",
      },
    ],
  }),
  component: EntrarPage,
});

function EntrarPage() {
  const navigate = useNavigate();
  const { state, setAccessGranted, setAuthUserId } = useStore();
  const complete = useServerFn(completeAccountAccess);
  const [email, setEmail] = useState(state.accessEmail ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@") || password.length < MIN_PASSWORD_LENGTH) {
      setError(`Informe e-mail e senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`);
      return;
    }
    setBusy(true);
    try {
      const auth = await signInWithPassword(trimmed, password);
      const user = auth.user;
      if (!user) {
        setError("Não foi possível entrar");
        return;
      }
      setAuthUserId(user.id);
      const deviceId = getDeviceId();
      const result = await complete({
        data: {
          email: trimmed,
          deviceId,
          authUserId: user.id,
          displayName: state.profile?.name || user.email || "Soldado",
          isNewUser: false,
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
        shopifyDisplayName: result.shopifyDisplayName,
      });
      toast.success("Bem-vindo de volta");
      navigate({ to: state.profile ? "/" : "/onboarding" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "E-mail ou senha inválidos");
    } finally {
      setBusy(false);
    }
  };

  const recover = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setError("Informe o e-mail para recuperar a senha");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(trimmed);
      toast.success("Se existir conta, enviamos o link de recuperação");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar o e-mail");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/20 via-background to-background" />
      <div className="relative mx-auto flex w-full max-w-md flex-col px-5 py-8">
        <SoldiersLogo />
        <p className="eyebrow mt-10">Entrar</p>
        <h1 className="mt-3 text-display text-3xl leading-none">
          Acesse com
          <span className="mt-1 block text-primary text-glow">e-mail e senha</span>
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          A janela de 40 dias é conferida de novo no login. Compra antiga? Compre de novo no mesmo e-mail.
        </p>

        <div className="mt-8 space-y-4">
          <div>
            <Label htmlFor="entrar-email">E-mail</Label>
            <Input
              id="entrar-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="entrar-senha">Senha</Label>
            <Input
              id="entrar-senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
              autoComplete="current-password"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            size="lg"
            className="h-14 w-full glow-primary font-bold uppercase tracking-wide"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Entrando…" : "Entrar"} <ArrowRight className="size-4" />
          </Button>
          <Button variant="ghost" className="w-full" disabled={busy} onClick={() => void recover()}>
            Esqueci a senha
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            O link de recuperação vai para o e-mail da conta — use o mesmo da loja.
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link to="/cadastro" className="font-semibold text-primary">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
