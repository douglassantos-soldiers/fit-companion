import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Medal, MessageSquare, Pill, RotateCcw, ShieldCheck, Trophy, Users } from "lucide-react";
import { NumberInput } from "@mantine/core";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { challengeById } from "@/data/challenges";
import { cosmeticById } from "@/lib/engine/rewards";
import { performanceDimensions, performanceScore, streak } from "@/lib/engine/dimensions";
import {
  getAuthUser,
  linkAuthToSocial,
  signInWithGoogle,
  signInWithMagicLink,
  signOutAuth,
  watchAuth,
} from "@/lib/auth";
import { requestNotificationPermission } from "@/lib/notifications";
import { DENY_MSG, verifyShopifyPurchase } from "@/lib/shopify.functions";
import { useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";
import { GOAL_LABEL, LEVEL_LABEL } from "@/lib/types";
import { trackEngagementEvent, uploadCheckinImage } from "@/lib/social";
import { registerPushWorker } from "@/lib/push";

const ATALHOS = [
  { to: "/coach" as const, search: undefined, label: "Coach", hint: "Pergunte ao AI sobre treino e comida", icon: MessageSquare },
  {
    to: "/social" as const,
    search: { tab: "desafios" as const },
    label: "Social",
    hint: "Desafios, clubes e feed",
    icon: Users,
  },
  { to: "/desafios" as const, search: undefined, label: "Desafios", hint: "Ranking e badges", icon: Trophy },
  { to: "/suplementos" as const, search: undefined, label: "Suplementos", hint: "Rotina e doses do dia", icon: Pill },
];

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Soldiers Training" },
      {
        name: "description",
        content: "Seus dados, objetivo, nível e preferências do plano de treino.",
      },
      { property: "og:title", content: "Perfil de performance" },
      { property: "og:description", content: "Objetivo, nível, medidas e histórico do app." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const {
    state,
    hydrated,
    reset,
    setTheme,
    setShareProgress,
    setSessionFx,
    setRemindersEnabled,
    setReminderHour,
    setBio,
    setAvatarUrl,
    setAuthUserId,
    setAccessGranted,
  } = useStore();
  const [email, setEmail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [reverifyEmail, setReverifyEmail] = useState(state.accessEmail ?? "");
  const [reverifyBusy, setReverifyBusy] = useState(false);
  const verifyShopify = useServerFn(verifyShopifyPurchase);

  useEffect(() => {
    void getAuthUser().then((u) => {
      if (u) setAuthUserId(u.id);
    });
    return watchAuth((id) => setAuthUserId(id));
  }, [setAuthUserId]);

  useEffect(() => {
    if (state.accessEmail) setReverifyEmail(state.accessEmail);
  }, [state.accessEmail]);

  if (!hydrated || !state.profile) {
    return (
      <AppShell title="Perfil">
        <div className="surface-card h-40 animate-pulse" />
      </AppShell>
    );
  }

  const p = state.profile;
  const dims = performanceDimensions(state, p);
  const badges = state.earnedBadges
    .map((id) => challengeById(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const cosmetics = (state.cosmeticBadges ?? [])
    .map((id) => cosmeticById(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const rows: Array<[string, string]> = [
    ["Objetivo", GOAL_LABEL[p.goal]],
    ["Nível", LEVEL_LABEL[p.level]],
    ["Dias por semana", `${p.daysPerWeek}`],
    ["Onde treina", p.equipment === "casa" ? "Casa" : "Academia"],
    ["Idade", `${p.age} anos`],
    ["Altura", `${p.heightCm} cm`],
    ["Peso atual", `${p.weightKg} kg`],
    ["Limitações", p.restrictions.length ? p.restrictions.join(", ") : "Nenhuma"],
    ["Freezes", `${state.streakFreezes ?? 0}`],
  ];

  const bindAuth = async (authUuid: string) => {
    setAuthUserId(authUuid);
    await linkAuthToSocial(getDeviceId(), p.name, authUuid);
    void trackEngagementEvent(getDeviceId(), "auth_linked", { authUuid });
  };

  const reverifyPurchase = async () => {
    const trimmed = reverifyEmail.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      toast.error("Informe um e-mail válido");
      return;
    }
    setReverifyBusy(true);
    try {
      const result = await verifyShopify({ data: { email: trimmed } });
      if (!result.ok) {
        toast.error(
          result.reason === "not_configured"
            ? "Verificação indisponível"
            : result.reason === "upstream"
              ? "Loja indisponível agora"
              : DENY_MSG,
        );
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
      toast.success("Acesso confirmado");
    } catch {
      toast.error("Falha ao verificar");
    } finally {
      setReverifyBusy(false);
    }
  };

  return (
    <AppShell
      title={p.name}
      subtitle={`Score ${performanceScore(dims)}/100 · streak de ${streak(state.sessions, { freezeUsedDates: state.freezeUsedDates })} dia(s)`}
    >
      <section className="surface-card mb-4 space-y-3 p-4">
        <p className="eyebrow">Acesso Shopify</p>
        <p className="text-sm text-muted-foreground">
          {state.accessGranted
            ? `Liberado com ${state.accessEmail ?? "e-mail da compra"} · plano ${state.accessTier === "performance" ? "Performance" : "Base"}`
            : "Ainda sem compra verificada"}
        </p>
        {state.cosmeticBadges?.includes("cliente-soldiers") ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Cliente Soldiers</p>
        ) : null}
        <Input
          type="email"
          value={reverifyEmail}
          onChange={(e) => setReverifyEmail(e.target.value)}
          placeholder="e-mail da compra"
        />
        <Button
          variant="secondary"
          className="w-full"
          disabled={reverifyBusy}
          onClick={() => void reverifyPurchase()}
        >
          <ShieldCheck className="size-4" />
          {reverifyBusy ? "Verificando…" : "Trocar e-mail / reverificar"}
        </Button>
      </section>

      <section className="surface-card mb-4 space-y-3 p-4">
        <div className="flex items-center gap-3">
          {state.avatarUrl ? (
            <img src={state.avatarUrl} alt="" className="size-14 rounded-full object-cover" />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">
              {p.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{p.name}</p>
            <p className="text-xs text-muted-foreground">
              {state.authUserId ? "Conta vinculada" : "Identidade local (device)"}
            </p>
          </div>
          <label className="cursor-pointer text-xs text-primary">
            Avatar
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void uploadCheckinImage(getDeviceId(), file).then((url) => {
                  if (url) {
                    setAvatarUrl(url);
                    toast.success("Avatar atualizado");
                  }
                });
              }}
            />
          </label>
        </div>
        <div>
          <Label className="text-xs">Bio</Label>
          <Input
            value={state.bio ?? ""}
            maxLength={160}
            placeholder="Curta bio do soldado"
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        {!state.authUserId ? (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Vincule e-mail ou Google para não perder o progresso.</p>
            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={authBusy || !email.includes("@")}
                onClick={() => {
                  setAuthBusy(true);
                  void signInWithMagicLink(email)
                    .then(() => toast.success("Link enviado — confira o e-mail"))
                    .catch((e) => toast.error(e instanceof Error ? e.message : "Falha no login"))
                    .finally(() => setAuthBusy(false));
                }}
              >
                Magic link
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                disabled={authBusy}
                onClick={() => {
                  setAuthBusy(true);
                  void signInWithGoogle()
                    .catch((e) => toast.error(e instanceof Error ? e.message : "OAuth indisponível"))
                    .finally(() => setAuthBusy(false));
                }}
              >
                Google
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              void signOutAuth().then(() => {
                setAuthUserId(null);
                toast.success("Sessão encerrada");
              });
            }}
          >
            Sair da conta
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            void getAuthUser().then(async (u) => {
              if (u) {
                await bindAuth(u.id);
                toast.success("Conta sincronizada");
              } else toast.message("Faça login pelo link do e-mail primeiro");
            });
            void registerPushWorker().then((ok) => {
              if (ok) toast.success("Push worker registrado");
            });
          }}
        >
          Sincronizar conta + push
        </Button>
      </section>

      <section className="mt-0">
        <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Coach e Social</h2>
        <ul className="surface-glass divide-y divide-white/10">
          {ATALHOS.map(({ to, search, label, hint, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                {...(search ? { search } : {})}
                className="flex items-center gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-muted/40"
              >
                <Icon className="size-5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Link to="/admin" className="surface-glass mt-3 flex items-center justify-between px-5 py-3.5 text-sm">
        <span>
          <span className="block font-semibold">Admin CMS</span>
          <span className="block text-xs text-muted-foreground">Treinos, vídeos e imagens</span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>

      <section className="surface-card mt-4 divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold">{value}</span>
          </div>
        ))}
      </section>

      <section className="surface-card mt-4 flex items-center justify-between px-5 py-4">
        <div>
          <Label htmlFor="theme-toggle" className="text-sm font-semibold">
            Tema claro
          </Label>
          <p className="text-xs text-muted-foreground">Alterna entre preto Soldiers e fundo claro</p>
        </div>
        <Switch
          id="theme-toggle"
          checked={state.theme === "light"}
          onCheckedChange={(checked) => setTheme(checked ? "light" : "dark")}
        />
      </section>

      <section className="surface-card mt-4 flex items-center justify-between px-5 py-4">
        <div>
          <Label htmlFor="share-progress" className="text-sm font-semibold">
            Compartilhar progresso
          </Label>
          <p className="text-xs text-muted-foreground">
            Nome e progresso de desafios no ranking/feed. Peso e refeições nunca saem.
          </p>
        </div>
        <Switch
          id="share-progress"
          checked={state.shareProgress !== false}
          onCheckedChange={(checked) => {
            setShareProgress(checked);
            toast.success(checked ? "Progresso público ligado" : "Progresso público desligado");
          }}
        />
      </section>

      <section className="surface-card mt-4 flex items-center justify-between px-5 py-4">
        <div>
          <Label htmlFor="session-fx" className="text-sm font-semibold">
            Sons e vibração no treino
          </Label>
          <p className="text-xs text-muted-foreground">
            Feedback ao concluir série e ao terminar o descanso.
          </p>
        </div>
        <Switch
          id="session-fx"
          checked={state.sessionFx !== false}
          onCheckedChange={(checked) => {
            setSessionFx(checked);
            toast.success(checked ? "Feedback ligado" : "Feedback desligado");
          }}
        />
      </section>

      <section className="surface-card mt-4 space-y-4 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="reminders" className="text-sm font-semibold">
              Lembretes do dia
            </Label>
            <p className="text-xs text-muted-foreground">
              Notificação local na hora do treino, streak e meta de XP.
            </p>
          </div>
          <Switch
            id="reminders"
            checked={state.remindersEnabled === true}
            onCheckedChange={(checked) => {
              if (checked) {
                void requestNotificationPermission().then((perm) => {
                  if (perm === "granted") {
                    setRemindersEnabled(true);
                    void registerPushWorker();
                    toast.success("Lembretes ligados");
                  } else if (perm === "unsupported") {
                    toast.error("Notificações não suportadas neste aparelho");
                  } else {
                    toast.error("Permissão de notificação negada");
                  }
                });
              } else {
                setRemindersEnabled(false);
                toast.success("Lembretes desligados");
              }
            }}
          />
        </div>
        {state.remindersEnabled ? (
          <NumberInput
            label="Horário (0–23)"
            value={state.reminderHour ?? 18}
            onChange={(v) => setReminderHour(typeof v === "number" ? v : 18)}
            min={6}
            max={22}
            step={1}
            clampBehavior="strict"
          />
        ) : null}
      </section>

      {badges.length > 0 || cosmetics.length > 0 ? (
        <section className="surface-card mt-4 p-5">
          <div className="flex items-center gap-2">
            <Medal className="size-4 text-primary" />
            <h2 className="text-lg">Conquistas</h2>
          </div>
          <ul className="mt-3 space-y-2">
            {badges.map((b) => (
              <li key={b.id} className="flex items-center gap-2 text-sm">
                <Medal className="size-4 text-primary" />
                <span>{b.title}</span>
              </li>
            ))}
            {cosmetics.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm">
                <Medal className="size-4 text-amber-400" />
                <span>
                  {c.title}{" "}
                  <span className="text-[0.65rem] uppercase text-muted-foreground">({c.rarity})</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="surface-card mt-4 grid grid-cols-3 gap-3 p-5 text-center">
        <Stat label="Treinos" value={state.sessions.length} />
        <Stat label="Desafios" value={state.challenges.length} />
        <Stat
          label="Volume total"
          value={Math.round(state.sessions.reduce((s, x) => s + x.volumeKg, 0) / 1000)}
          suffix="t"
        />
      </section>

      <div className="mt-4 space-y-2">
        <Button variant="secondary" className="h-12 w-full" onClick={() => navigate({ to: "/onboarding" })}>
          Refazer meu perfil
        </Button>
        <Button
          variant="secondary"
          className="h-12 w-full text-destructive"
          onClick={() => {
            if (window.confirm("Apagar todos os dados salvos neste aparelho?")) {
              reset();
              toast.success("Dados apagados");
              navigate({ to: "/onboarding" });
            }
          }}
        >
          <RotateCcw className="size-4" /> Reiniciar dados
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Dados ficam no aparelho e sincronizam via Supabase. Conta opcional protege a identidade.
      </p>
    </AppShell>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <p className="text-display text-2xl text-primary">
        {value}
        {suffix ?? ""}
      </p>
      <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

