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
import { resetPassword, signInWithPassword } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/ui/platform-copy";
import { EmailSchema } from "@/lib/validation/common";

export const Route = createFileRoute("/entrar")({
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
  const { email: searchEmail, next } = Route.useSearch();
  const { applyGrant, busy: grantBusy, state, setAuthUserId } = useCompleteAccessGrant();
  const lockedEmail = Boolean(searchEmail);
  const [email, setEmail] = useState(
    () => searchEmail ?? peekAccessPrefillEmail() ?? state.accessEmail ?? "",
  );
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = busy || grantBusy;

  const submit = async () => {
    setError(null);
    const emailParsed = EmailSchema.safeParse(email);
    if (!emailParsed.success || password.length < MIN_PASSWORD_LENGTH) {
      setError(`Informe e-mail e senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`);
      return;
    }
    const trimmed = emailParsed.data;
    setBusy(true);
    try {
      const auth = await signInWithPassword(trimmed, password);
      const user = auth.user;
      if (!user) {
        setError("Não foi possível entrar");
        return;
      }
      setAuthUserId(user.id);
      const result = await applyGrant({
        email: trimmed,
        authUserId: user.id,
        displayName: state.profile?.name || user.email || "Soldado",
        isNewUser: false,
        ...(next ? { next } : {}),
      });
      if (result.ok) toast.success("Bem-vindo de volta");
    } catch (e) {
      setError(e instanceof Error ? e.message : "E-mail ou senha inválidos");
    } finally {
      setBusy(false);
    }
  };

  const recover = async () => {
    const emailParsed = EmailSchema.safeParse(email);
    if (!emailParsed.success) {
      setError("Informe o e-mail para recuperar a senha");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(emailParsed.data);
      toast.success("Se existir conta, enviamos o link de recuperação");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar o e-mail");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthAccessShell
      title="Acesse com e-mail e senha"
      subtitle={
        lockedEmail
          ? "Use a senha desta conta — o e-mail veio do link da compra."
          : "A janela de 40 dias é conferida de novo no login. Compra antiga? Compre de novo no mesmo e-mail."
      }
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link
            to="/cadastro"
            {...(searchEmail || next ? { search: { email: searchEmail, next } } : {})}
            className="font-semibold text-primary"
          >
            Criar conta
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="entrar-email">E-mail</Label>
          <Input
            id="entrar-email"
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
          disabled={loading}
          onClick={() => void submit()}
        >
          {loading ? "Entrando…" : "Entrar"} <ArrowRight className="size-4" />
        </Button>
        <Button variant="ghost" className="w-full" disabled={loading} onClick={() => void recover()}>
          Esqueci a senha
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          O link de recuperação vai para o e-mail da conta — use o mesmo da loja.
        </p>
      </div>
    </AuthAccessShell>
  );
}
