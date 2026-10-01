import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function AdminErrorBanner({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

export function AdminReloadButton({
  busy,
  onReload,
  label = "Atualizar",
}: {
  busy?: boolean;
  onReload: () => void;
  label?: string;
}) {
  return (
    <Button variant="secondary" className="gap-2" onClick={onReload} disabled={busy}>
      <RefreshCw className="size-4" /> {busy ? "Carregando…" : label}
    </Button>
  );
}

export function AdminCrudShell({
  toolbar,
  error,
  draft,
  children,
}: {
  toolbar?: ReactNode;
  error?: string | null;
  draft?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {toolbar ? <div className="flex flex-wrap gap-2">{toolbar}</div> : null}
      <AdminErrorBanner message={error} />
      {draft}
      {children}
    </div>
  );
}

export function parseCommaList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parsePipeList(raw: string): string[] {
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}
