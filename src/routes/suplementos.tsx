import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Clock, ExternalLink, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PRODUCTS, productById } from "@/data/products";
import { reorderUrlForProduct } from "@/data/shopify-product-map";
import {
  dosesTakenToday,
  expectedDosesToday,
  monthlyDoseAdherence,
  timingSlot,
} from "@/lib/engine/supplements";
import { fetchStorefrontCatalog, trackAppEvent, type StorefrontProduct } from "@/lib/shopify.functions";
import { todaySupplements, useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";

export const Route = createFileRoute("/suplementos")({
  head: () => ({
    meta: [
      { title: "Suplementos — Soldiers Performance OS" },
      {
        name: "description",
        content: "Monte sua rotina de suplementação, marque as doses do dia e acompanhe a aderência.",
      },
      { property: "og:title", content: "Suplementação contextual" },
      { property: "og:description", content: "Rotina diária, horários e catálogo Soldiers." },
    ],
  }),
  component: SupplementsPage,
});

function SupplementsPage() {
  const { state, hydrated, toggleSupplement, setRoutine, dismissRoutineFromPurchase } = useStore();
  const loadCatalog = useServerFn(fetchStorefrontCatalog);
  const track = useServerFn(trackAppEvent);
  const [storeProducts, setStoreProducts] = useState<StorefrontProduct[]>([]);
  const [catalogConfigured, setCatalogConfigured] = useState(false);

  useEffect(() => {
    void loadCatalog().then((res) => {
      setStoreProducts(res.products);
      setCatalogConfigured(res.configured);
    });
  }, [loadCatalog]);

  if (!hydrated) {
    return (
      <AppShell title="Suplementos">
        <div className="surface-card h-40 animate-pulse" />
      </AppShell>
    );
  }

  const goal = state.profile?.goal;
  const routineIds = state.supplementRoutine.length
    ? state.supplementRoutine
    : PRODUCTS.filter((p) => (goal ? p.goals.includes(goal) : true))
        .slice(0, 3)
        .map((p) => p.id);
  const routine = PRODUCTS.filter((p) => routineIds.includes(p.id));
  const taken = todaySupplements(state);
  const expectedToday = expectedDosesToday(routineIds);
  const takenToday = dosesTakenToday(state.supplementLogs, routineIds);
  const month = monthlyDoseAdherence(state.supplementLogs, routineIds);
  const showPurchaseBanner = state.routineFromPurchase && !state.routineFromPurchaseDismissed;

  return (
    <AppShell
      title="Suplementos"
      subtitle={`Aderência do mês: ${month.pct}% · hoje ${takenToday}/${expectedToday || "—"} doses`}
    >
      {showPurchaseBanner ? (
        <div className="surface-glass mb-4 flex items-start gap-3 border-primary/30 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sua compra</p>
            <p className="mt-1 text-sm font-semibold">Rotina montada a partir da sua compra</p>
            <p className="text-xs text-muted-foreground">Você pode ajustar os itens abaixo a qualquer momento.</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-muted-foreground"
            aria-label="Dispensar"
            onClick={() => dismissRoutineFromPurchase()}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <section className="surface-card mb-4 p-4">
        <div className="flex justify-between text-sm">
          <span>Doses hoje</span>
          <span className="font-semibold text-primary">
            {takenToday}/{expectedToday}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${expectedToday ? Math.min(100, (takenToday / expectedToday) * 100) : 0}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Mês: {month.taken}/{month.expected} doses em {month.days} dias
        </p>
      </section>

      <Tabs defaultValue="rotina">
        <TabsList className="w-full">
          <TabsTrigger value="rotina" className="flex-1">
            Minha rotina
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="flex-1">
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="loja" className="flex-1">
            Loja
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rotina" className="mt-4 space-y-3">
          {routine.map((p) => {
            const done = taken.includes(p.id);
            const slot = timingSlot(p.timing);
            const restock = state.restockEstimates?.[p.id];
            const daysLeft = restock
              ? Math.ceil((new Date(restock.emptyAt).getTime() - Date.now()) / 86_400_000)
              : null;
            const reorder = reorderUrlForProduct(p.id);
            return (
              <article key={p.id} className="surface-card flex items-center justify-between gap-3 p-4">
                <div>
                  <h2 className="text-base">{p.name}</h2>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" /> {p.timing} · slot {slot} · {p.serving}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{p.use}</p>
                  {daysLeft != null && daysLeft <= 14 ? (
                    <p className="mt-1 text-xs text-primary">
                      Reposição em ~{Math.max(0, daysLeft)}d
                      {reorder ? (
                        <>
                          {" · "}
                          <a
                            href={reorder}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                            onClick={() => {
                              const id = getDeviceId();
                              if (id) {
                                void track({
                                  data: {
                                    deviceId: id,
                                    kind: "restock_cta_click",
                                    payload: { source: "suplementos", productId: p.id },
                                  },
                                });
                              }
                            }}
                          >
                            reordenar
                          </a>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <Button size="icon" variant={done ? "default" : "secondary"} onClick={() => toggleSupplement(p.id)}>
                  <Check className="size-4" />
                </Button>
              </article>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Suplementos complementam a alimentação. Em caso de condição de saúde, fale com um profissional.
          </p>
        </TabsContent>

        <TabsContent value="catalogo" className="mt-4 space-y-3">
          {PRODUCTS.map((p) => {
            const inRoutine = routineIds.includes(p.id);
            return (
              <article key={p.id} className="surface-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-primary">{p.category}</p>
                    <h2 className="mt-1 text-base">{p.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {p.timing} · {p.serving}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{p.use}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={inRoutine ? "secondary" : "default"}
                    onClick={() =>
                      setRoutine(inRoutine ? routineIds.filter((x) => x !== p.id) : [...routineIds, p.id])
                    }
                  >
                    {inRoutine ? "Remover" : "Adicionar"}
                  </Button>
                </div>
              </article>
            );
          })}
        </TabsContent>

        <TabsContent value="loja" className="mt-4 space-y-3">
          {!catalogConfigured ? (
            <p className="text-xs text-muted-foreground">
              Preços ao vivo quando `SHOPIFY_STOREFRONT_TOKEN` estiver configurado. Links abaixo abrem a loja.
            </p>
          ) : null}
          {storeProducts.map((sp) => {
            const local = sp.productId ? productById(sp.productId) : undefined;
            return (
              <article key={sp.handle} className="surface-card flex gap-3 p-4">
                {sp.imageUrl ? (
                  <img src={sp.imageUrl} alt="" className="size-16 rounded-lg object-cover" />
                ) : (
                  <div className="size-16 rounded-lg bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-base">{sp.title || local?.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {sp.price ?? "Ver preço na loja"}
                    {sp.available ? "" : " · indisponível"}
                  </p>
                  <a
                    href={sp.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary"
                    onClick={() => {
                      const id = getDeviceId();
                      if (id) {
                        void track({
                          data: {
                            deviceId: id,
                            kind: "restock_cta_click",
                            payload: { source: "loja_tab", handle: sp.handle },
                          },
                        });
                      }
                    }}
                  >
                    Abrir na Soldiers <ExternalLink className="size-3" />
                  </a>
                </div>
              </article>
            );
          })}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
