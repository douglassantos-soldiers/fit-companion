import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SoldiersLogo } from "@/components/soldiers-logo";

/** Shared visual shell for /entrar and /cadastro. */
export function AuthAccessShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.18),_transparent_55%)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <SoldiersLogo />
          <h1 className="mt-6 text-display text-3xl text-primary">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
        {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
      </div>
      <p className="relative z-10 pb-6 text-center text-xs text-muted-foreground">
        <Link to="/acesso" className="underline-offset-2 hover:underline">
          Verificar compra
        </Link>
      </p>
    </div>
  );
}
