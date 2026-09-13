import { createFileRoute } from "@tanstack/react-router";
import { Check, Clock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PRODUCTS } from "@/data/products";
import { todaySupplements, useStore } from "@/lib/store";

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
  const { state, hydrated, toggleSupplement, setRoutine } = useStore();

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

  const logDays = Object.entries(state.supplementLogs).filter(([, v]) => v.length > 0).length;
  const adherence = Math.min(100, Math.round((logDays / 30) * 100));

  return (
    <AppShell title="Suplementos" subtitle={`Aderência do mês: ${adherence}%`}>
      <Tabs defaultValue="rotina">
        <TabsList className="w-full">
          <TabsTrigger value="rotina" className="flex-1">
            Minha rotina
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="flex-1">
            Catálogo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rotina" className="mt-4 space-y-3">
          {routine.map((p) => {
            const done = taken.includes(p.id);
            return (
              <article key={p.id} className="surface-card flex items-center justify-between gap-3 p-4">
                <div>
                  <h2 className="text-base">{p.name}</h2>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" /> {p.timing} · {p.serving}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{p.use}</p>
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
      </Tabs>
    </AppShell>
  );
}
