import { Link } from "@tanstack/react-router";
import { Activity, CalendarCheck, Dumbbell, MessageSquare, Pill, TrendingUp, Trophy, User } from "lucide-react";
import type { ReactNode } from "react";
import { SoldiersLogo } from "@/components/soldiers-logo";

const TABS = [
  { to: "/", label: "Hoje", icon: CalendarCheck },
  { to: "/treino", label: "Treino", icon: Dumbbell },
  { to: "/progresso", label: "Progresso", icon: TrendingUp },
  { to: "/desafios", label: "Desafios", icon: Trophy },
  { to: "/coach", label: "Coach", icon: MessageSquare },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
          <SoldiersLogo />
          <div className="flex items-center gap-1">
            <Link
              to="/suplementos"
              className="rounded-full p-2 text-muted-foreground transition-colors hover:text-primary"
              aria-label="Suplementos"
            >
              <Pill className="size-5" />
            </Link>
            <Link
              to="/perfil"
              className="rounded-full p-2 text-muted-foreground transition-colors hover:text-primary"
              aria-label="Perfil"
            >
              <User className="size-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pt-5">
        <div className="mb-5">
          <h1 className="text-3xl font-black text-foreground">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-md grid-cols-5">
          {TABS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-col items-center gap-1 py-3 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="surface-card flex flex-col items-center gap-3 p-8 text-center">
      <Activity className="size-8 text-primary" />
      <h2 className="text-lg">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
