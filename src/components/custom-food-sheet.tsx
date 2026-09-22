import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import { validateCustomFoodEan, type CustomFoodInput } from "@/lib/nutrition/custom-foods";
import type { FoodCategory } from "@/lib/nutrition/types";
import type { CustomFood } from "@/lib/types";

const CATEGORIES: FoodCategory[] = [
  "outros",
  "industrializados",
  "carnes",
  "aves",
  "peixes",
  "ovos",
  "laticinios",
  "cereais",
  "leguminosas",
  "hortalicas",
  "frutas",
  "bebidas",
  "suplementos",
];

type FormState = {
  name: string;
  brand: string;
  category: FoodCategory;
  kcal: string;
  proteinG: string;
  carbG: string;
  fatG: string;
  fiberG: string;
  sodiumMg: string;
  ironMg: string;
  vitaminDUcg: string;
  servingLabel: string;
  servingGrams: string;
  ean: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    brand: "",
    category: "outros",
    kcal: "",
    proteinG: "",
    carbG: "",
    fatG: "",
    fiberG: "",
    sodiumMg: "",
    ironMg: "",
    vitaminDUcg: "",
    servingLabel: "1 porção",
    servingGrams: "100",
    ean: "",
  };
}

function fromFood(f: CustomFood): FormState {
  return {
    name: f.name,
    brand: f.brand ?? "",
    category: f.category,
    kcal: String(f.kcal),
    proteinG: String(f.proteinG),
    carbG: String(f.carbG),
    fatG: String(f.fatG),
    fiberG: f.fiberG != null ? String(f.fiberG) : "",
    sodiumMg: f.sodiumMg != null ? String(f.sodiumMg) : "",
    ironMg: f.ironMg != null ? String(f.ironMg) : "",
    vitaminDUcg: f.vitaminDUcg != null ? String(f.vitaminDUcg) : "",
    servingLabel: f.servingLabel,
    servingGrams: String(f.servingGrams),
    ean: f.ean ?? "",
  };
}

function num(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function optNum(s: string): number | undefined {
  if (!s.trim()) return undefined;
  const n = num(s);
  return n > 0 ? n : undefined;
}

export function CustomFoodSheet({
  open,
  onClose,
  foods,
  editing,
  onSave,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  foods: CustomFood[];
  editing: CustomFood | null;
  onSave: (input: CustomFoodInput) => void;
  onRemove: (id: string) => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    editing ? fromFood(editing) : emptyForm(),
  );
  const [mode, setMode] = useState<"list" | "form">(editing ? "form" : "list");
  const [editingId, setEditingId] = useState<string | null>(editing?.id ?? null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm(fromFood(editing));
      setMode("form");
      setEditingId(editing.id);
    } else {
      setForm(emptyForm());
      setMode("list");
      setEditingId(null);
    }
  }, [open, editing]);

  const reset = (food?: CustomFood | null) => {
    setForm(food ? fromFood(food) : emptyForm());
    setMode(food ? "form" : "list");
    setEditingId(food?.id ?? null);
  };

  if (!open) return null;

  const save = () => {
    if (!form.name.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    if (form.ean.trim() && !validateCustomFoodEan(form.ean)) {
      toast.error("EAN inválido (use 8, 12 ou 13 dígitos)");
      return;
    }
    const grams = Math.max(1, num(form.servingGrams) || 100);
    const input: CustomFoodInput = {
      name: form.name,
      category: form.category,
      kcal: num(form.kcal),
      proteinG: num(form.proteinG),
      carbG: num(form.carbG),
      fatG: num(form.fatG),
      servingLabel: form.servingLabel || "1 porção",
      servingGrams: grams,
    };
    if (editingId) input.id = editingId;
    if (form.brand.trim()) input.brand = form.brand;
    const fiber = optNum(form.fiberG);
    const sodium = optNum(form.sodiumMg);
    const iron = optNum(form.ironMg);
    const vitD = optNum(form.vitaminDUcg);
    if (fiber != null) input.fiberG = fiber;
    if (sodium != null) input.sodiumMg = sodium;
    if (iron != null) input.ironMg = iron;
    if (vitD != null) input.vitaminDUcg = vitD;
    if (form.ean.trim()) input.ean = form.ean.trim();
    onSave(input);
    toast.success(editingId ? "Alimento atualizado" : "Alimento criado");
    reset(null);
    onClose();
  };

  return (
    <SoldiersOverlay
      open={open}
      onClose={onClose}
      title="Meu alimento"
      description="Cadastro pessoal com porção e EAN opcional"
      panelClassName="max-h-[85vh]"
    >
      {mode === "list" ? (
        <div className="space-y-3">
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              setForm(emptyForm());
              setEditingId(null);
              setMode("form");
            }}
          >
            Novo alimento
          </Button>
          {foods.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum alimento personalizado ainda.
            </p>
          ) : (
            <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
              {foods.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => reset(f)}
                  >
                    <span className="block text-sm font-semibold">{f.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {f.kcal} kcal/100 g · {f.servingLabel} ({f.servingGrams} g)
                      {f.ean ? ` · EAN ${f.ean}` : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Excluir"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      onRemove(f.id);
                      toast.success("Removido");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            placeholder="Nome"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            placeholder="Marca (opcional)"
            value={form.brand}
            onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
          />
          <label className="block text-xs text-muted-foreground">
            Categoria
            <select
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value as FoodCategory }))
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Por 100 g
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["kcal", "Kcal"],
                ["proteinG", "Proteína g"],
                ["carbG", "Carb g"],
                ["fatG", "Gordura g"],
                ["fiberG", "Fibra g"],
                ["sodiumMg", "Sódio mg"],
                ["ironMg", "Ferro mg"],
                ["vitaminDUcg", "Vit. D µg"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-xs text-muted-foreground">
                {label}
                <Input
                  className="mt-1"
                  inputMode="decimal"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Porção padrão
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Rótulo (ex. 1 unidade)"
              value={form.servingLabel}
              onChange={(e) => setForm((f) => ({ ...f, servingLabel: e.target.value }))}
            />
            <Input
              placeholder="Gramas"
              inputMode="decimal"
              value={form.servingGrams}
              onChange={(e) => setForm((f) => ({ ...f, servingGrams: e.target.value }))}
            />
          </div>
          <Input
            placeholder="EAN / código de barras (opcional)"
            inputMode="numeric"
            value={form.ean}
            onChange={(e) => setForm((f) => ({ ...f, ean: e.target.value }))}
          />
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => reset(null)}>
              Voltar
            </Button>
            <Button type="button" className="flex-1" onClick={save}>
              Salvar
            </Button>
          </div>
        </div>
      )}
    </SoldiersOverlay>
  );
}
