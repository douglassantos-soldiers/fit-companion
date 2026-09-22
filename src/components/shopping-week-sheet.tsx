import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import type { DailyMealPlan } from "@/lib/nutrition/meal-planner";
import {
  shoppingListFromWeekPlan,
  shoppingListToText,
  type ShoppingLine,
} from "@/lib/nutrition/shopping-list";
import type { MealEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isoWeekKey } from "@/lib/engine/nutrition/weekly-kcal-adapt";

function storageKey(weekKey: string) {
  return `soldiers-shopping-checked:${weekKey}`;
}

const CATEGORY_LABEL: Record<string, string> = {
  hortalicas: "Hortaliças",
  frutas: "Frutas",
  carnes: "Carnes",
  aves: "Aves",
  peixes: "Peixes",
  ovos: "Ovos",
  laticinios: "Laticínios",
  cereais: "Cereais",
  tuberculos: "Tubérculos",
  leguminosas: "Leguminosas",
  oleaginosas: "Oleaginosas",
  oleos: "Óleos",
  bebidas: "Bebidas",
  suplementos: "Suplementos",
  industrializados: "Industrializados",
  outros: "Outros",
};

function lineQtyLabel(line: ShoppingLine): string {
  if (line.foodId && line.grams > 0) return `${Math.round(line.grams)} g`;
  const q = line.quantity ?? 1;
  const unit = line.unit ?? "refeição";
  return q > 1 ? `${q} × ${unit}` : `1 × ${unit}`;
}

export function ShoppingWeekSheet({
  open,
  onClose,
  weekPlan,
  meals,
}: {
  open: boolean;
  onClose: () => void;
  weekPlan: DailyMealPlan[];
  meals: MealEntry[];
}) {
  const start = weekPlan[0]?.date ?? new Date().toISOString().slice(0, 10);
  const weekKey = isoWeekKey(start);
  const lines = useMemo(
    () => shoppingListFromWeekPlan(weekPlan, meals),
    [weekPlan, meals],
  );

  const grouped = useMemo(() => {
    const groups: Array<{ key: string; label: string; lines: ShoppingLine[] }> = [];
    let current: (typeof groups)[number] | null = null;
    for (const line of lines) {
      const cat = line.category ?? "outros";
      if (!current || current.key !== cat) {
        current = {
          key: cat,
          label: CATEGORY_LABEL[cat] ?? cat,
          lines: [],
        };
        groups.push(current);
      }
      current.lines.push(line);
    }
    return groups;
  }, [lines]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    try {
      const raw = sessionStorage.getItem(storageKey(weekKey));
      if (raw) setChecked(JSON.parse(raw) as Record<string, boolean>);
      else setChecked({});
    } catch {
      setChecked({});
    }
  }, [open, weekKey]);

  const persist = (next: Record<string, boolean>) => {
    setChecked(next);
    try {
      sessionStorage.setItem(storageKey(weekKey), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const toggle = (line: ShoppingLine) => {
    persist({ ...checked, [line.key]: !checked[line.key] });
  };

  const markAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const l of lines) next[l.key] = value;
    persist(next);
  };

  const copy = async () => {
    const text = shoppingListToText(lines);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Lista copiada");
    } catch {
      toast.message(text);
    }
  };

  if (!open) return null;

  return (
    <SoldiersOverlay
      open={open}
      onClose={onClose}
      title="Preparar a semana"
      description="Lista agregada das sugestões e refeições registradas"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => void copy()}>
            <Copy className="mr-1 size-3.5" /> Copiar
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => markAll(true)}>
            <Check className="mr-1 size-3.5" /> Marcar todos
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => markAll(false)}>
            Limpar
          </Button>
        </div>
        {lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem itens — registre refeições ou mantenha sugestões na semana.
          </p>
        ) : (
          <div className="max-h-[55vh] space-y-3 overflow-y-auto">
            {grouped.map((group) => (
              <div key={group.key}>
                <p className="mb-1 px-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.lines.map((line) => {
                    const on = Boolean(checked[line.key]);
                    return (
                      <li key={line.key}>
                        <button
                          type="button"
                          onClick={() => toggle(line)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left",
                            on ? "border-primary/40 bg-primary/5" : "border-border",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border",
                              on
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/40",
                            )}
                          >
                            {on ? <Check className="size-3" /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block text-sm font-semibold",
                                on && "line-through opacity-70",
                              )}
                            >
                              {line.name}
                            </span>
                            <span className="text-xs text-muted-foreground">{lineQtyLabel(line)}</span>
                          </span>
                          <ShoppingCart className="size-3.5 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </SoldiersOverlay>
  );
}
