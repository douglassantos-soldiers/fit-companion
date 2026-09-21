import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Tabs } from "@heroui/react";
import {
  CalendarCheck,
  Dumbbell,
  Flame,
  TrendingUp,
  User,
  Users,
  Utensils,
} from "lucide-react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { SoldiersLogo } from "@/components/soldiers-logo";
import { cn } from "@/lib/utils";
import { resolveTabKey } from "@/lib/ui/app-nav";

const TABS = [
  { to: "/", label: "Hoje", icon: CalendarCheck },
  { to: "/treino", label: "Treino", icon: Dumbbell },
  { to: "/social", label: "Social", icon: Users },
  { to: "/progresso", label: "Progresso", icon: TrendingUp },
  { to: "/nutricao", label: "Nutri", icon: Utensils },
] as const;

export function AppShell({
  title,
  subtitle,
  headerBadge,
  headerAccessDays,
  hideTitle,
  dock,
  children,
}: {
  title: string;
  subtitle?: string;
  headerBadge?: ReactNode;
  headerAccessDays?: number | null;
  hideTitle?: boolean;
  dock?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const selected = resolveTabKey(pathname);
  const showAccess = headerAccessDays != null && headerAccessDays <= 7;

  return (
    <div
      className={cn(
        "relative min-h-screen bg-background",
        dock
          ? "pb-[calc(11.5rem+env(safe-area-inset-bottom))]"
          : "pb-[calc(6.5rem+env(safe-area-inset-bottom))]",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />

      <header className="sticky top-0 z-20 border-b border-white/5 bg-background/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 py-3">
          <SoldiersLogo />
          <div className="ml-auto flex items-center gap-1.5">
            {showAccess ? (
              <span className="badge badge-soldiers glow-primary gap-1 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider">
                acesso {headerAccessDays}d
              </span>
            ) : headerBadge ? (
              <span className="badge badge-soldiers glow-primary gap-1 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider">
                <Flame className="size-3.5" />
                {headerBadge}
              </span>
            ) : null}
            <Link
              to="/perfil"
              className="flex size-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-primary/30 to-white/5 text-primary transition-colors hover:border-primary/40"
              aria-label="Perfil"
            >
              <User className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-md px-4 pt-5">
        {!hideTitle ? (
          <div className="mb-5">
            <h1 className="text-3xl font-black text-foreground">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        ) : null}
        {children}
      </main>

      {dock ? (
        <div className="fixed inset-x-0 bottom-[calc(5.35rem+env(safe-area-inset-bottom))] z-20 px-3">
          <div className="mx-auto w-full max-w-md">{dock}</div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2">
        <div className="surface-glass mx-auto w-full max-w-md rounded-full border border-white/10 px-1.5 py-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.45)]">
          <Tabs
            selectedKey={selected}
            onSelectionChange={(key) => {
              const to = String(key) as (typeof TABS)[number]["to"];
              void navigate({ to });
            }}
            className="w-full"
            variant="secondary"
          >
            <Tabs.ListContainer className="w-full">
              <Tabs.List
                aria-label="Navegação principal"
                className="grid w-full grid-cols-5 gap-0.5 bg-transparent p-0"
              >
                {TABS.map(({ to, label, icon: Icon }) => (
                  <Tabs.Tab
                    key={to}
                    id={to}
                    className="relative flex h-auto min-h-12 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground transition-all data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:shadow-[0_0_20px_var(--glow-primary)]"
                  >
                    <Icon className="size-5" />
                    {label}
                    <Tabs.Indicator className="hidden" />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </div>
      </nav>
    </div>
  );
}

function EmptyIllustration({ variant }: { variant: "treino" | "progresso" | "social" | "default" }) {
  const accent = "currentColor";
  return (
    <svg viewBox="0 0 120 96" className="size-24 text-primary" aria-hidden>
      <rect x="8" y="12" width="104" height="72" rx="12" fill="currentColor" opacity="0.08" />
      {variant === "treino" || variant === "default" ? (
        <>
          <rect x="42" y="28" width="14" height="48" rx="4" fill={accent} opacity="0.9" />
          <rect x="64" y="28" width="14" height="48" rx="4" fill={accent} opacity="0.9" />
          <circle cx="49" cy="22" r="6" fill={accent} />
          <circle cx="71" cy="22" r="6" fill={accent} />
        </>
      ) : null}
      {variant === "progresso" ? (
        <>
          <polyline
            points="24,68 48,48 68,56 96,28"
            fill="none"
            stroke={accent}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="96" cy="28" r="5" fill={accent} />
        </>
      ) : null}
      {variant === "social" ? (
        <>
          <circle cx="40" cy="44" r="14" fill={accent} opacity="0.85" />
          <circle cx="72" cy="44" r="14" fill={accent} opacity="0.55" />
          <circle cx="56" cy="62" r="12" fill={accent} opacity="0.7" />
        </>
      ) : null}
    </svg>
  );
}

export function LoadingPulse({ label = "Carregando…" }: { label?: string }) {
  return (
    <div
      className="surface-glass flex h-40 flex-col items-center justify-center gap-2"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="size-8 animate-pulse rounded-full bg-primary/40" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  variant = "default",
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  variant?: "treino" | "progresso" | "social" | "default";
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="status"
      className={cn("surface-glass flex flex-col items-center px-6 py-10 text-center", className)}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <EmptyIllustration variant={variant} />
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5 w-full">{action}</div> : null}
    </motion.div>
  );
}
