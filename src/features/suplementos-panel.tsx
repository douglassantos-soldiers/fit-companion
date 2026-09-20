import { useEffect, useState } from "react";
import { NumberInput } from "@mantine/core";
import { Check, Clock, ExternalLink, Plus, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PRODUCTS } from "@/data/products";
import { SoldiersMediaThumb } from "@/components/soldiers-media-frame";
import { resolveProductMedia } from "@/lib/soldiers-media";
import { reorderUrlForProduct } from "@/data/shopify-product-map";
import { restockSoftMessage } from "@/lib/engine/supplement-inventory";
import {
  dosesTakenToday,
  expectedDosesToday,
  monthlyDoseAdherence,
  timingSlot,
} from "@/lib/engine/supplements";
import { fetchStorefrontCatalog, trackAppEvent, type StorefrontProduct } from "@/lib/shopify.functions";
import { todaySupplements, useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";
import type { DoseFrequency, DoseUnit } from "@/lib/types";

export function SupplementsPanel() {
  const {
    state,
    hydrated,
    toggleSupplement,
    setRoutine,
    dismissRoutineFromPurchase,
    logSupplementDose,
  } = useStore();
  const loadCatalog = useServerFn(fetchStorefrontCatalog);
  const track = useServerFn(trackAppEvent);
  const [storeProducts, setStoreProducts] = useState<StorefrontProduct[]>([]);
  const [catalogConfigured, setCatalogConfigured] = useState(false);
  const [doseProductId, setDoseProductId] = useState<string | null>(null);

  useEffect(() => {
    void loadCatalog().then((res) => {
      setStoreProducts(res.products);
      setCatalogConfigured(res.configured);
    });
  }, [loadCatalog]);

  if (!hydrated) {
    return <div className="surface-card h-40 animate-pulse" />;
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
  const doseProduct = doseProductId ? PRODUCTS.find((p) => p.id === doseProductId) : null;

  return (
    <div>
      <p className="mb-4 text-xs text-muted-foreground">
        Aderência do mês: {month.pct}% · hoje {takenToday}/{expectedToday || "—"} doses
      </p>
      {showPurchaseBanner ? (
        <div className="surface-glass mb-4 flex items-start gap-3 border-primary/30 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sua compra</p>
            <p className="mt-1 text-sm font-semibold">Rotina sugerida a partir da compra</p>
            <p className="text-xs text-muted-foreground">
              Compra não significa consumo — ajuste a rotina e registre as doses.
            </p>
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
            const soft = restock ? restockSoftMessage({ ...restock, daysLeft: Math.max(0, daysLeft ?? 0) }) : null;
            const productUrl = reorderUrlForProduct(p.id);
            return (
              <article key={p.id} className="surface-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <SoldiersMediaThumb
                    media={resolveProductMedia(p.id)}
                    alt={p.name}
                    className="size-14 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base">{p.name}</h2>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" /> {p.timing} · slot {slot} · {p.serving}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{p.use}</p>
                    {daysLeft != null && daysLeft <= 14 && soft ? (
                      <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5">
                        <p className="text-xs font-semibold text-primary">{soft.headline}</p>
                        <p className="text-[0.65rem] text-muted-foreground">{soft.detail}</p>
                        {productUrl ? (
                          <a
                            href={productUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-[0.65rem] text-muted-foreground underline"
                            onClick={() => {
                              const id = getDeviceId();
                              if (id) {
                                void track({
                                  data: {
                                    deviceId: id,
                                    kind: "restock_clicked",
                                    payload: { source: "suplementos", productId: p.id },
                                    entityType: "product",
                                    entityId: p.id,
                                  },
                                });
                              }
                            }}
                          >
                            Ver produto <ExternalLink className="size-3" />
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button
                      size="icon"
                      variant={done ? "default" : "secondary"}
                      onClick={() => toggleSupplement(p.id)}
                      aria-label="Marcar dose"
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setDoseProductId(p.id)}
                      aria-label="Registrar dose detalhada"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
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
                  <SoldiersMediaThumb
                    media={resolveProductMedia(p.id)}
                    alt={p.name}
                    className="size-14 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
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
            <p className="text-sm text-muted-foreground">Catálogo da loja não configurado neste ambiente.</p>
          ) : (
            storeProducts.map((p) => (
              <a
                key={p.handle}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="surface-card flex items-center justify-between gap-3 p-4"
              >
                <div>
                  <h2 className="text-base">{p.title}</h2>
                  <p className="text-xs text-muted-foreground">{p.price ?? ""}</p>
                </div>
                <ExternalLink className="size-4 text-muted-foreground" />
              </a>
            ))
          )}
        </TabsContent>
      </Tabs>

      {doseProduct ? (
        <DoseLogSheet
          productId={doseProduct.id}
          productName={doseProduct.name}
          defaultServing={doseProduct.serving}
          defaultFrequency={(state.supplementFrequencies?.[doseProduct.id] ?? "1x_day") as DoseFrequency}
          onClose={() => setDoseProductId(null)}
          onSave={(opts) => {
            logSupplementDose(opts);
            setDoseProductId(null);
            toast.success("Dose registrada");
          }}
        />
      ) : null}
    </div>
  );
}

function DoseLogSheet({
  productId,
  productName,
  defaultServing,
  defaultFrequency,
  onClose,
  onSave,
}: {
  productId: string;
  productName: string;
  defaultServing: string;
  defaultFrequency: DoseFrequency;
  onClose: () => void;
  onSave: (opts: {
    productId: string;
    dose: number;
    unit: DoseUnit;
    frequency: DoseFrequency;
    takenAt?: string;
  }) => void;
}) {
  const parsed = Number.parseFloat(defaultServing.replace(",", "."));
  const [dose, setDose] = useState(Number.isFinite(parsed) && parsed > 0 ? parsed : 1);
  const [unit, setUnit] = useState<DoseUnit>(() => {
    const s = defaultServing.toLowerCase();
    if (s.includes("cápsula") || s.includes("capsula")) return "caps";
    if (s.includes("ml")) return "ml";
    if (s.includes("g")) return "g";
    return "serving";
  });
  const [frequency, setFrequency] = useState<DoseFrequency>(defaultFrequency);
  const [takenAtLocal, setTakenAtLocal] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  return (
    <SoldiersOverlay open onClose={onClose} title="Registrar dose" description={productName}>
      <div className="space-y-4">
        <NumberInput
          label="Dose"
          value={dose}
          onChange={(v) => setDose(typeof v === "number" ? v : 1)}
          min={0.25}
          max={100}
          step={0.25}
          decimalScale={2}
        />
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Unidade</label>
          <select
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={unit}
            onChange={(e) => setUnit(e.target.value as DoseUnit)}
          >
            <option value="serving">serving</option>
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="caps">caps</option>
            <option value="scoop">scoop</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Frequência</label>
          <select
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as DoseFrequency)}
          >
            <option value="1x_day">1× ao dia</option>
            <option value="2x_day">2× ao dia</option>
            <option value="as_needed">Conforme necessário</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Horário (taken_at)</label>
          <input
            type="datetime-local"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={takenAtLocal}
            onChange={(e) => setTakenAtLocal(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Compra ≠ consumo. Só o registro de dose reduz o estoque estimado.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() =>
              onSave({
                productId,
                dose,
                unit,
                frequency,
                takenAt: new Date(takenAtLocal).toISOString(),
              })
            }
          >
            Salvar dose
          </Button>
        </div>
      </div>
    </SoldiersOverlay>
  );
}
