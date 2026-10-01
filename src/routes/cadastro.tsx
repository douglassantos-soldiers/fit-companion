import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AuthAccessShell } from "@/components/auth/auth-access-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompleteAccessGrant } from "@/hooks/use-complete-access-grant";
import { parseAccessEmail, parseAccessNext, peekAccessPrefillEmail } from "@/lib/access-funnel";
import { resendSignupConfirmation, signUpWithEmail } from "@/lib/auth";
import { useStore } from "@/lib/store";
import {
  MIN_PASSWORD_LENGTH,
  CADASTRO_CONFIRM_BODY,
  CADASTRO_CONFIRM_TITLE,
} from "@/lib/ui/platform-copy";
import { DisplayNameSchema, EmailSchema } from "@/lib/validation/common";

export const Route = createFileRoute("/cadastro")({
  validateSearch: (search: Record<string, unknown>) => {
    const email = parseAccessEmail(search["email"]);
    const next = parseAccessNext(search["next"]);
    const out: { email?: string; next?: "/" | "/onboarding" } = {};
    if (email) out.email = email;
    if (next) out.next = next;
    return out;
  },
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
  const { email: searchEmail, next } = Route.useSearch();
  const { acceptLegal } = useStore();
  const { applyGrant, busy: grantBusy, state, setAuthUserId } = useCompleteAccessGrant();
  const lockedEmail = Boolean(searchEmail);
  const [name, setName] = useState(state.shopifyDisplayName ?? state.profile?.name ?? "");
  const [email, setEmail] = useState(
    () => searchEmail ?? peekAccessPrefillEmail() ?? state.accessEmail ?? "",
  );
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingEmail, setAwaitingEmail] = useState(false);
  const loading = busy || grantBusy;

  const submit = async () => {
    setError(null);
    const nameParsed = DisplayNameSchema.safeParse(name);
    const emailParsed = EmailSchema.safeParse(email);
    if (!nameParsed.success || nameParsed.data.length < 2) {
      setError("Informe seu nome");
      return;
    }
    if (!emailParsed.success) {
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
    const trimmed = emailParsed.data;
    const displayName = nameParsed.data;
    setBusy(true);
    try {
      const auth = await signUpWithEmail(trimmed, password, displayName);
      const user = auth.user ?? auth.session?.user ?? null;
      if (!user) {
        setAwaitingEmail(true);
        return;
      }
      setAuthUserId(user.id);
      acceptLegal("terms");
      acceptLegal("privacy");
      const result = await applyGrant({
        email: trimmed,
        authUserId: user.id,
        displayName,
        isNewUser: true,
        ...(next ? { next } : {}),
      });
      if (result.ok) toast.success("Conta criada");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar a conta");
    } finally {
      setBusy(false);
    }
  };

  const resendConfirm = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) return;
    setBusy(true);
    try {
      await resendSignupConfirmation(trimmed);
      toast.success("Reenviamos o e-mail de confirmação");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível reenviar");
    } finally {
      setBusy(false);
    }
  };

  if (awaitingEmail) {
    return (
      <AuthAccessShell title={CADASTRO_CONFIRM_TITLE} subtitle={CADASTRO_CONFIRM_BODY}>
        <Button
          size="lg"
          className="h-14 w-full glow-primary font-bold uppercase tracking-wide"
          disabled={loading}
          onClick={() => void resendConfirm()}
        >
          Reenviar e-mail
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Já confirmou?{" "}
          <Link
            to="/entrar"
            {...(searchEmail || next ? { search: { email: searchEmail, next } } : {})}
            className="font-semibold text-primary"
          >
            Entrar
          </Link>
        </p>
      </AuthAccessShell>
    );
  }

  return (
    <AuthAccessShell
      title="Crie sua conta Soldiers"
      subtitle="Use o mesmo e-mail da compra na loja. Acesso por 40 dias após a última compra."
      footer={
        <>
          Já tem conta?{" "}
          <Link
            to="/entrar"
            {...(searchEmail || next ? { search: { email: searchEmail, next } } : {})}
            className="font-semibold text-primary"
          >
            Entrar
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="cad-nome">Nome</Label>
          <Input
            id="cad-nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            autoComplete="name"
          />
        </div>
        <div>
          <Label htmlFor="cad-email">E-mail da loja</Label>
          <Input
            id="cad-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            autoComplete="email"
            readOnly={lockedEmail}
            className={lockedEmail ? "opacity-90" : undefined}
          />
        </div>
        <div>
          <Label htmlFor="cad-senha">Senha</Label>
          <Input
            id="cad-senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
            autoComplete="new-password"
          />
        </div>
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
          />
          <span>
            Li e aceito os termos de uso e a política de privacidade.
          </span>
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          size="lg"
          className="h-14 w-full glow-primary font-bold uppercase tracking-wide"
          disabled={loading}
          onClick={() => void submit()}
        >
          {loading ? "Criando…" : "Criar conta"} <ArrowRight className="size-4" />
        </Button>
      </div>
    </AuthAccessShell>
  );
}
