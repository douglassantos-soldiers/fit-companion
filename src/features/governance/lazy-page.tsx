import type { ComponentType, ReactNode } from "react";
import { lazy, Suspense } from "react";

type PageComponent = ComponentType<Record<string, never>>;

export function lazyGovernancePage(
  importer: () => Promise<{ default: PageComponent } | Record<string, PageComponent>>,
  exportName?: string,
) {
  const Page = lazy(async () => {
    const mod = await importer();
    if ("default" in mod && mod.default) return { default: mod.default };
    if (exportName && exportName in mod) {
      return { default: (mod as Record<string, PageComponent>)[exportName]! };
    }
    const first = Object.values(mod).find((v) => typeof v === "function");
    if (!first) throw new Error("lazyGovernancePage: no component export");
    return { default: first as PageComponent };
  });

  return function LazyGovernanceRoute() {
    return (
      <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Carregando…</div>}>
        <Page />
      </Suspense>
    );
  };
}

export function GovernanceSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Carregando…</div>}>
      {children}
    </Suspense>
  );
}
