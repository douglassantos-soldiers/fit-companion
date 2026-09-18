import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Droplets, Pencil, Plus, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { MealEditSheet } from "@/components/meal-edit-sheet";
import { MealPickerSheet } from "@/components/meal-picker-sheet";
import { MealPresetThumb } from "@/components/meal-preset-thumb";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { lessonForToday } from "@/data/habit-lessons";
import type { MealPreset } from "@/data/meal-presets";
import { computeLearningInsights } from "@/lib/engine/learning";
import {
  buildDailyMealPlan,
  dayNutritionTotals,
  nutritionGoals,
  QUALITY_LABEL,
  addMealFromPreset,
} from "@/lib/engine/nutrition";
import { useStore } from "@/lib/store";
import { MEAL_SLOT_LABEL, todayKey, type MealEntry, type MealSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/nutricao")({
  head: () => ({
    meta: [
      { title: "Nutrição — Soldiers Training" },
      {
        name: "description",
        content: "Diário alimentar com proteína, kcal e água — estilo MyFitnessPal.",
      },
      { property: "og:title", content: "Nutrição Soldiers" },
      { property: "og:description", content: "Diário do dia, porções e macros." },
    ],
  }),
  component: NutritionPage,
});

const SLOTS: MealSlot[] = ["cafe", "almoco", "lanche", "jantar"];

function MacroBar({
  label,
  current,
  goal,
  unit = "",
}: {
  label: string;
  current: number;
  goal: number;
  unit?: string;
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">
          {current}
          {unit} / {goal}
          {unit} · {pct}%
        </span>
      </div>
      <Progress value={pct} className="h-2.5" />
    </div>
  );
}

function NutritionPage() {
  const { state, hydrated, addMealEntry, removeMealEntry, updateMealEntry, addWater } = useStore();
  const [pickerSlot, setPickerSlot] = useState<MealSlot | null>(null);
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const [focusSlot, setFocusSlot] = useState<MealSlot | "todos">("todos");
  const lesson = lessonForToday();

  if (!hydrated || !state.profile) {
    return (
      <AppShell title="Nutrição">
        <div className="surface-glass h-40 animate-pulse" />
      </AppShell>
    );
  }

  const insights = computeLearningInsights(state);
  const goals = nutritionGoals(state.profile, insights);
  const totals = dayNutritionTotals(state.meals ?? []);
  const mealPlan = buildDailyMealPlan(state.profile, state, todayKey(), insights);
  const metrics = state.days[todayKey()] ?? { date: todayKey(), waterMl: 0, meals: 0 };
  const visibleSlots = focusSlot === "todos" ? mealPlan.slots : mealPlan.slots.filter((s) => s.slot === focusSlot);

  const addPreset = (preset: MealPreset, slot: MealSlot, servings = 1) => {
    addMealEntry(addMealFromPreset(preset, slot, servings));
    setPickerSlot(null);
    toast.success(`${preset.label} registrado`);
  };

  return (
    <AppShell title="Nutrição" subtitle={`Meta ${goals.proteinG} g proteína · ${goals.kcal} kcal`}>
      {insights?.reasons[0] ? (
        <p className="surface-glass mb-3 p-3 text-xs text-muted-foreground">{insights.reasons[0]}</p>
      ) : null}

      <section className="surface-glass space-y-4 p-4">
        <div>
          <p className="text-display text-2xl">Hoje</p>
          <p className="text-xs text-muted-foreground">
            Diário · {totals.count} registro{totals.count === 1 ? "" : "s"}
          </p>
        </div>
        <MacroBar label="Proteína" current={totals.proteinG} goal={goals.proteinG} unit=" g" />
        <MacroBar label="Kcal" current={totals.kcal} goal={goals.kcal} />
        <MacroBar label="Água" current={metrics.waterMl} goal={goals.waterMl} unit=" ml" />
      </section>

      <Button
        variant="secondary"
        className="mt-3 h-11 w-full"
        onClick={() => {
          addWater(500);
          toast.success("Hidratação registrada");
        }}
      >
        <Droplets className="size-4" /> Água +500 ml
      </Button>

      <div className="hide-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFocusSlot("todos")}
          className={cn(
            "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
            focusSlot === "todos"
              ? "border-primary bg-primary text-primary-foreground glow-primary"
              : "border-white/10 bg-card/40 text-muted-foreground",
          )}
        >
          Todos
        </button>
        {SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => setFocusSlot(slot)}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
              focusSlot === slot
                ? "border-primary bg-primary text-primary-foreground glow-primary"
                : "border-white/10 bg-card/40 text-muted-foreground",
            )}
          >
            {MEAL_SLOT_LABEL[slot]}
          </button>
        ))}
      </div>

      <section className="mt-4 space-y-2">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-lg">Plano de hoje</h2>
          <p className="text-[0.65rem] text-muted-foreground">
            Projeção {mealPlan.projectedProteinG} g · {mealPlan.projectedKcal} kcal
          </p>
        </div>
        {visibleSlots.map((row) => (
          <article key={row.slot} className="surface-glass p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-display text-base">{MEAL_SLOT_LABEL[row.slot]}</p>
              <Button size="sm" variant="outline" onClick={() => setPickerSlot(row.slot)}>
                <Plus className="size-3.5" /> Outro
              </Button>
            </div>

            {row.logged.length ? (
              <ul className="mt-3 space-y-2">
                {row.logged.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-2 border-t border-white/10 pt-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{e.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.proteinG} g · {e.kcal} kcal · {QUALITY_LABEL[e.quality]}
                        {(e.servings ?? 1) !== 1 ? ` · ${e.servings}×` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Editar"
                        onClick={() => setEditing(e)}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                        aria-label="Remover"
                        onClick={() => {
                          removeMealEntry(e.id);
                          toast.success("Removido");
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : row.preset ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <MealPresetThumb preset={row.preset} />
                  <p className="text-sm text-muted-foreground">
                    Sugerido: {row.preset.label} · {row.preset.proteinG}g · {QUALITY_LABEL[row.preset.quality]}
                  </p>
                </div>
                <Button size="sm" className="glow-primary shrink-0" onClick={() => addPreset(row.preset!, row.slot, 1)}>
                  <Utensils className="size-3.5" /> Aplicar
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Nada registrado</p>
            )}
          </article>
        ))}
      </section>

      <section className="surface-glass mt-4 p-5">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-primary" />
          <h2 className="text-lg">Lição de hoje</h2>
        </div>
        <p className="mt-2 text-display text-xl">{lesson.title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{lesson.body}</p>
        <p className="mt-3 text-xs font-semibold text-primary">Dica: {lesson.tip}</p>
        <Link to="/coach" className="mt-3 inline-block text-xs font-semibold text-muted-foreground underline">
          Falar com o coach sobre isso
        </Link>
      </section>

      {pickerSlot ? (
        <MealPickerSheet
          slot={pickerSlot}
          onClose={() => setPickerSlot(null)}
          onPick={(p, servings) => addPreset(p, pickerSlot, servings)}
          onPickCustom={(meal) => {
            addMealEntry({
              slot: pickerSlot,
              label: meal.label,
              proteinG: meal.proteinG,
              kcal: meal.kcal,
              quality: meal.quality,
            });
            setPickerSlot(null);
            toast.success("Refeição adicionada");
          }}
        />
      ) : null}

      {editing ? (
        <MealEditSheet
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            updateMealEntry(editing.id, patch);
            setEditing(null);
            toast.success("Refeição atualizada");
          }}
        />
      ) : null}
    </AppShell>
  );
}
