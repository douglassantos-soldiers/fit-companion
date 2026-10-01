import type { ReactNode } from "react";
import { AppShell, LoadingPulse } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import type { Profile } from "@/lib/types";

export function PageLoadingCard({ variant = "glass" }: { variant?: "glass" | "card" }) {
  return (
    <div
      className={
        variant === "card" ? "surface-card h-40 animate-pulse" : "surface-glass h-40 animate-pulse"
      }
    />
  );
}

/** Unified post-hydration gate for profile-required routes. */
export function HydratedPageGate({
  hydrated,
  profile,
  title = "Carregando",
  subtitle,
  mode = "pulse",
  children,
}: {
  hydrated: boolean;
  profile: Profile | null | undefined;
  title?: string;
  subtitle?: string;
  mode?: "pulse" | "card" | "glass" | "skeleton";
  children: ReactNode;
}) {
  if (hydrated && profile) return <>{children}</>;

  if (mode === "skeleton") {
    return (
      <div className="mx-auto w-full max-w-md space-y-3 p-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <AppShell title={title} {...(subtitle ? { subtitle } : {})}>
      {mode === "pulse" ? (
        <LoadingPulse />
      ) : (
        <PageLoadingCard variant={mode === "card" ? "card" : "glass"} />
      )}
    </AppShell>
  );
}
