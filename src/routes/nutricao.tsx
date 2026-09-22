import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  BookOpen,
  BookmarkPlus,
  Copy,
  Droplets,
  Pencil,
  Plus,
  Settings2,
  ShoppingCart,
  Star,
  Trash2,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { MealEditSheet } from "@/components/meal-edit-sheet";
import { MealPickerSheet } from "@/components/meal-picker-sheet";
import { ShoppingWeekSheet } from "@/components/shopping-week-sheet";
import { MealPresetThumb } from "@/components/meal-preset-thumb";
import { MetricRing } from "@/components/metric-ring";
import { NutritionAjustesSheet } from "@/components/today/nutrition-ajustes-sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lessonForToday } from "@/data/habit-lessons";
import type { MealPreset } from "@/data/meal-presets";
import { computeLearningInsights } from "@/lib/engine/learning";
import { decisionContextForUi } from "@/lib/engine/assemble-decision-context";
import { selectNutritionOpts } from "@/lib/engine/decision-context-snapshot";
import {
  addMealFromPreset,
  buildDailyMealPlan,
  buildMultiDayMealPlan,
  dayNutritionTotalsFromState,
  nutritionGoals,
  QUALITY_LABEL,
  scalePreset,
  weeklyNutritionSeries,
} from "@/lib/engine/nutrition";
import {
  clampServings,
  copyMealToSlot,
  lastMealForSlot,
  proteinGapLine,
} from "@/lib/nutrition/log-loop";
import { customPickFromSaved, nutritionLibrary, savedMealFromEntry } from "@/lib/nutrition/library";
import { dayPerformanceMicros } from "@/lib/nutrition/nutrients";
import { wheyMacrosFromDoses } from "@/lib/nutrition/whey";
import { useStore } from "@/lib/store";
import {
  MEAL_SLOT_LABEL,
  todayKey,
  type MealEntry,
  type MealSlot,
  type SavedMeal,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { SupplementsPanel } from "@/features/suplementos-panel";

type NutritionTab = "hoje" | "semana" | "biblioteca" | "historico" | "doses";

export const Route = createFileRoute("/nutricao")({
  validateSearch: (search: Record<string, unknown>): { tab?: NutritionTab } => {
    const tab = search["tab"];
    if (
      tab === "historico" ||
      tab === "doses" ||
      tab === "hoje" ||
      tab === "semana" ||
      tab === "biblioteca"
    ) {
      return { tab };
    }
    return {};
  },
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
  const search = Route.useSearch();
  const tab = search.tab ?? "hoje";
  const visibleTab = tab === "doses" ? "hoje" : tab === "historico" ? "biblioteca" : tab;
  const navigate = useNavigate({ from: "/nutricao" });
  const {
    state,
    hydrated,
    addMealEntry,
    removeMealEntry,
    updateMealEntry,
    addWater,
    patchProfile,
    saveDayCheckIn,
    toggleFavoriteMeal,
    saveMealTemplate,
    removeSavedMeal,
  } = useStore();
  const [pickerSlot, setPickerSlot] = useState<MealSlot | null>(null);
  const [pickerDate, setPickerDate] = useState(todayKey());
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const [focusSlot, setFocusSlot] = useState<MealSlot | "todos">("todos");
  const [ajustesOpen, setAjustesOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [servingsBySlot, setServingsBySlot] = useState<Partial<Record<MealSlot, number>>>({});
  const [libSlot, setLibSlot] = useState<MealSlot>("almoco");
  const lesson = lessonForToday(
    new Date(),
    null,
    state.profile ? { goal: state.profile.goal, level: state.profile.level } : null,
  );

  if (!hydrated || !state.profile) {
    return (
      <AppShell title="Nutrição">
        <div className="surface-glass h-40 animate-pulse" />
      </AppShell>
    );
  }

  const insights = computeLearningInsights(state);
  const decisionCtx = decisionContextForUi(state, todayKey());
  const engine = decisionCtx ? selectNutritionOpts(decisionCtx, state) : {};
  const goals = nutritionGoals(state.profile, insights, engine);
  const totals = dayNutritionTotalsFromState(state);
  const mealPlan = buildDailyMealPlan(state.profile, state, todayKey(), insights, engine);
  const weekPlan = buildMultiDayMealPlan(state.profile, state, todayKey(), 7, insights);
  const library = nutritionLibrary(
    state.meals ?? [],
    state.favoriteMealPresetIds ?? [],
    state.savedMeals ?? [],
  );
  const metrics = state.days[todayKey()] ?? { date: todayKey(), waterMl: 0, meals: 0 };
  const whey = wheyMacrosFromDoses(
    state.supplementDoseLogs,
    todayKey(),
    state.profile.nutritionProfile?.countWheyInMacros === true,
  );
  const nextEmpty = mealPlan.slots.find((s) => s.status === "suggested")?.slot;
  const gap = proteinGapLine(totals.proteinG, goals.proteinG, nextEmpty);
  const todayMeals = (state.meals ?? []).filter((m) => m.date.slice(0, 10) === todayKey());
  const micros = dayPerformanceMicros(todayMeals);
  const kcalTrend = decisionCtx?.context.nutrition.kcalTrend ?? 0;
  const weeklyKcalHint =
    Math.abs(kcalTrend) >= 100
      ? `Ajuste semanal: ${kcalTrend > 0 ? "+" : ""}${kcalTrend} kcal${
          decisionCtx?.context.reasonSeeds.includes("weight_trend_up") ||
          decisionCtx?.context.reasonSeeds.includes("weight_trend_down")
            ? " (tendência de peso)"
            : decisionCtx?.context.reasonSeeds.includes("adherence_gate") ||
                decisionCtx?.context.reasonSeeds.includes("incomplete_logging")
              ? " (adesão/registro)"
              : ""
        }`
      : null;
  const qualityLine =
    todayMeals.length > 0
      ? `${todayMeals.filter((m) => m.quality === "verde").length} verdes · ${todayMeals.filter((m) => m.quality === "laranja").length} ocasionais`
      : null;
  const visibleSlots =
    focusSlot === "todos"
      ? mealPlan.slots.filter((s) => s.status !== "skipped")
      : mealPlan.slots.filter((s) => s.slot === focusSlot && s.status !== "skipped");
  const history = weeklyNutritionSeries(state.meals ?? [], 14)
    .slice()
    .reverse();

  const addPreset = (preset: MealPreset, slot: MealSlot, servings = 1, date = todayKey()) => {
    addMealEntry({ ...addMealFromPreset(preset, slot, servings), date });
    setPickerSlot(null);
    toast.success(`${preset.label} registrado`);
  };

  const openPicker = (slot: MealSlot, date = todayKey()) => {
    setPickerDate(date);
    setPickerSlot(slot);
  };

  const logSaved = (saved: SavedMeal, slot: MealSlot, date = todayKey()) => {
    const meal = customPickFromSaved(saved);
    const entry: Parameters<typeof addMealEntry>[0] = {
      slot,
      date,
      label: meal.label,
      proteinG: meal.proteinG,
      kcal: meal.kcal,
      quality: meal.quality,
      sourceKind: meal.sourceKind,
      foodSource: meal.foodSource,
    };
    if (meal.carbG != null) entry.carbG = meal.carbG;
    if (meal.fatG != null) entry.fatG = meal.fatG;
    if (meal.fiberG != null) entry.fiberG = meal.fiberG;
    if (meal.items) entry.items = meal.items;
    if (meal.nutrientSnapshot) entry.nutrientSnapshot = meal.nutrientSnapshot;
    addMealEntry(entry);
    toast.success(`${saved.label} registrado`);
  };

  const skipSlot = (slot: MealSlot) => {
    const today = state.dayCheckIns?.[todayKey()];
    const next = new Set(today?.skippedSlots ?? []);
    if (next.has(slot)) next.delete(slot);
    else next.add(slot);
    saveDayCheckIn({
      sleepHours: today?.sleepHours ?? 7,
      energy: today?.energy ?? "ok",
      availableMin: today?.availableMin ?? 60,
      ...(today?.noEquipment ? { noEquipment: true } : {}),
      ...(today?.equipment ? { equipment: today.equipment } : {}),
      ...(today?.acceptedTrainingMode ? { acceptedTrainingMode: today.acceptedTrainingMode } : {}),
      ...(today?.lunchOutToday ? { lunchOutToday: true } : {}),
      skippedSlots: [...next],
    });
    if (slot === "cafe") {
      patchProfile({ skipBreakfast: next.has("cafe") });
    }
    toast.success("Slot pulado hoje");
  };

  return (
    <AppShell title="Nutrição" subtitle={`Meta ${goals.proteinG} g proteína · ${goals.kcal} kcal`}>
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setAjustesOpen(true)}>
          <Settings2 className="size-3.5" /> Ajustes
        </Button>
      </div>

      <Tabs
        value={visibleTab}
        onValueChange={(v) => {
          void navigate({
            search: v === "semana" || v === "biblioteca" ? { tab: v as NutritionTab } : {},
          });
        }}
      >
        <TabsList className="w-full h-auto rounded-full bg-muted/40 p-1">
          <TabsTrigger value="hoje" className="flex-1 rounded-full">
            Hoje
          </TabsTrigger>
          <TabsTrigger value="semana" className="flex-1 rounded-full">
            Semana
          </TabsTrigger>
          <TabsTrigger value="biblioteca" className="flex-1 rounded-full">
            Biblioteca
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="mt-4">
          {insights?.reasons[0] ? (
            <p className="surface-glass mb-3 p-3 text-xs text-muted-foreground">
              {insights.reasons[0]}
            </p>
          ) : null}

          {gap ? (
            <p className="mb-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
              {gap}
              {whey.scoops ? ` · ${whey.scoops} scoop whey` : ""}
            </p>
          ) : null}
          {weeklyKcalHint ? (
            <p className="mb-3 text-xs text-muted-foreground">{weeklyKcalHint}</p>
          ) : null}
          {qualityLine ? <p className="mb-3 text-xs text-muted-foreground">{qualityLine}</p> : null}

          <section className="surface-glass space-y-4 p-4">
            <div>
              <p className="text-display text-2xl">Hoje</p>
              <p className="text-xs text-muted-foreground">
                Diário · {totals.count} registro{totals.count === 1 ? "" : "s"}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MetricRing value={totals.proteinG} max={goals.proteinG} label="Proteína" unit="g" />
              <MetricRing value={totals.kcal} max={goals.kcal} label="Kcal" />
              <MetricRing value={metrics.waterMl} max={goals.waterMl} label="Água" unit="ml" />
            </div>
            <MacroBar
              label="Carboidrato"
              current={totals.carbG}
              goal={goals.carbG ?? Math.round((goals.kcal * 0.45) / 4)}
              unit=" g"
            />
            <MacroBar
              label="Gordura"
              current={totals.fatG}
              goal={goals.fatG ?? Math.round((goals.kcal * 0.25) / 9)}
              unit=" g"
            />
          </section>

          {micros ? (
            <section className="surface-glass mt-3 space-y-3 p-4">
              <div>
                <p className="text-sm font-semibold">Performance</p>
                <p className="text-[0.65rem] text-muted-foreground">
                  Fibra, sódio, ferro e vitamina D — nutrientes que importam no dia a dia.
                </p>
              </div>
              <ul className="space-y-2.5">
                {micros.map((m) => {
                  const goal = m.goal ?? 1;
                  const pct = m.ceiling
                    ? Math.min(100, Math.round((m.value / goal) * 100))
                    : Math.min(100, Math.round((m.value / goal) * 100));
                  const overCeiling = Boolean(m.ceiling && m.value > goal);
                  return (
                    <li key={m.key} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{m.label}</span>
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            overCeiling ? "text-destructive" : "text-foreground",
                          )}
                        >
                          {m.value} {m.unit}
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            / {goal} {m.unit}
                            {m.ceiling ? " máx" : ""}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            overCeiling ? "bg-destructive" : "bg-primary",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              {micros.some((m) => (m.key === "ironMg" || m.key === "vitaminDUcg") && m.value === 0) &&
              micros.filter((m) => m.key === "ironMg" || m.key === "vitaminDUcg").every((m) => m.value === 0) ? (
                <p className="text-[0.65rem] text-muted-foreground">
                  Ferro e vitamina D: disponíveis via código de barras / TACO / alimento com dado.
                </p>
              ) : null}
            </section>
          ) : null}

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
                {mealPlan.redistributed ? " · redistribuído" : ""}
              </p>
            </div>
            {visibleSlots.map((row) => (
              <article key={row.slot} className="surface-glass p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-display text-base">{MEAL_SLOT_LABEL[row.slot]}</p>
                  <div className="flex gap-1">
                    {row.status === "suggested" ? (
                      <Button size="sm" variant="ghost" onClick={() => skipSlot(row.slot)}>
                        Pulei
                      </Button>
                    ) : null}
                    {row.logged[0] ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const target =
                            mealPlan.slots.find((s) => s.status === "suggested")?.slot ?? "jantar";
                          addMealEntry(copyMealToSlot(row.logged[0]!, target));
                          toast.success(`Copiado para ${MEAL_SLOT_LABEL[target]}`);
                        }}
                      >
                        <Copy className="size-3.5" /> Copiar
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => openPicker(row.slot)}>
                      <Plus className="size-3.5" /> Outro
                    </Button>
                  </div>
                </div>

                {row.logged.length ? (
                  <ul className="mt-3 space-y-2">
                    {row.logged.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center gap-3 border-t border-white/10 pt-3"
                      >
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                          <Utensils className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                            {MEAL_SLOT_LABEL[row.slot]}
                          </p>
                          <p className="truncate text-sm font-semibold">{e.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.proteinG} g P
                            {e.carbG != null ? ` · ${e.carbG} g C` : ""}
                            {e.fatG != null ? ` · ${e.fatG} g G` : ""}
                            {(e.servings ?? 1) !== 1 ? ` · ${e.servings}×` : ""}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-primary">{e.kcal} kcal</p>
                        <div className="flex shrink-0 gap-0.5">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Salvar esta refeição"
                            onClick={() => {
                              saveMealTemplate(savedMealFromEntry(e));
                              toast.success("Refeição salva na biblioteca");
                            }}
                          >
                            <BookmarkPlus className="size-3.5" />
                          </button>
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
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <MealPresetThumb preset={row.preset} className="size-14 rounded-2xl" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                            Sugerido
                          </p>
                          <p className="truncate text-sm font-semibold">{row.preset.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {
                              scalePreset(
                                row.preset,
                                servingsBySlot[row.slot] ?? row.suggestedServings ?? 1,
                              ).proteinG
                            }{" "}
                            g P · {QUALITY_LABEL[row.preset.quality]}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-primary">
                          {
                            scalePreset(
                              row.preset,
                              servingsBySlot[row.slot] ?? row.suggestedServings ?? 1,
                            ).kcal
                          }{" "}
                          kcal
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="glow-primary shrink-0"
                        onClick={() =>
                          addPreset(
                            row.preset!,
                            row.slot,
                            servingsBySlot[row.slot] ?? row.suggestedServings ?? 1,
                          )
                        }
                      >
                        <Utensils className="size-3.5" /> Aplicar
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-white/10 px-2 py-1 text-xs"
                        onClick={() =>
                          setServingsBySlot((s) => ({
                            ...s,
                            [row.slot]: clampServings(
                              (s[row.slot] ?? row.suggestedServings ?? 1) - 0.25,
                            ),
                          }))
                        }
                      >
                        −
                      </button>
                      <span className="text-xs font-semibold">
                        {servingsBySlot[row.slot] ?? row.suggestedServings ?? 1}×
                      </span>
                      <button
                        type="button"
                        className="rounded-full border border-white/10 px-2 py-1 text-xs"
                        onClick={() =>
                          setServingsBySlot((s) => ({
                            ...s,
                            [row.slot]: clampServings(
                              (s[row.slot] ?? row.suggestedServings ?? 1) + 0.25,
                            ),
                          }))
                        }
                      >
                        +
                      </button>
                      {lastMealForSlot(state.meals ?? [], row.slot) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto"
                          onClick={() => {
                            addMealEntry(
                              copyMealToSlot(
                                lastMealForSlot(state.meals ?? [], row.slot)!,
                                row.slot,
                              ),
                            );
                            toast.success("Igual ontem");
                          }}
                        >
                          Igual ontem
                        </Button>
                      ) : null}
                    </div>
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
            <Link
              to="/coach"
              className="mt-3 inline-block text-xs font-semibold text-muted-foreground underline"
            >
              Falar com o coach sobre isso
            </Link>
          </section>

          <section className="mt-4">
            <h2 className="mb-2 px-1 text-sm font-semibold">Doses</h2>
            <SupplementsPanel />
          </section>
        </TabsContent>

        <TabsContent value="semana" className="mt-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Sugestões dos próximos 7 dias. O diário continua no dia escolhido.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0 gap-1"
              onClick={() => setShoppingOpen(true)}
            >
              <ShoppingCart className="size-3.5" />
              Preparar a semana
            </Button>
          </div>
          {weekPlan.map((day) => {
            const label = new Date(`${day.date}T12:00:00`).toLocaleDateString("pt-BR", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            return (
              <article key={day.date} className="surface-glass p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold capitalize">{label}</h2>
                  <p className="text-[0.65rem] text-muted-foreground">
                    {day.projectedProteinG} g P · {day.projectedKcal} kcal
                    {day.redistributed ? " · redistribuído" : ""}
                  </p>
                </div>
                <ul className="mt-2 space-y-2">
                  {day.slots.map((row) => (
                    <li
                      key={`${day.date}-${row.slot}`}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="min-w-0">
                        <span className="font-semibold">{MEAL_SLOT_LABEL[row.slot]}</span>
                        {" · "}
                        {row.status === "logged"
                          ? row.logged.map((m) => m.label).join(", ")
                          : row.status === "skipped"
                            ? "Pulado"
                            : row.preset
                              ? `Sugerido: ${row.preset.label}`
                              : "—"}
                      </span>
                      {row.status !== "skipped" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0"
                          onClick={() => openPicker(row.slot, day.date)}
                        >
                          Registrar
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </TabsContent>

        <TabsContent value="biblioteca" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setLibSlot(slot)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider",
                  libSlot === slot
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-white/10 text-muted-foreground",
                )}
              >
                {MEAL_SLOT_LABEL[slot]}
              </button>
            ))}
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Favoritos</h2>
            {library.favorites.length ? (
              library.favorites.map((p) => (
                <article key={p.id} className="surface-glass flex items-center gap-2 p-3">
                  <MealPresetThumb preset={p} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{p.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.proteinG} g · {p.kcal} kcal
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleFavoriteMeal(p.id)}
                    aria-label="Desfavoritar"
                  >
                    <Star className="size-3.5 fill-primary text-primary" />
                  </Button>
                  <Button size="sm" onClick={() => addPreset(p, libSlot, 1, todayKey())}>
                    Registrar
                  </Button>
                </article>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum favorito ainda</p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Recentes</h2>
            {library.recentPresets.map((p) => (
              <article
                key={`rp-${p.id}`}
                className="surface-glass flex items-center justify-between gap-2 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{p.label}</p>
                  <p className="text-xs text-muted-foreground">Preset · {p.proteinG} g</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addPreset(p, libSlot, 1, todayKey())}
                >
                  Registrar
                </Button>
              </article>
            ))}
            {library.recentCustom.map((m) => (
              <article
                key={`rc-${m.id}`}
                className="surface-glass flex items-center justify-between gap-2 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{m.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Custom · {m.proteinG} g · {m.items?.length ?? 0} item(ns)
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    addMealEntry(copyMealToSlot(m, libSlot));
                    toast.success("Registrado");
                  }}
                >
                  Registrar
                </Button>
              </article>
            ))}
            {!library.recentPresets.length && !library.recentCustom.length ? (
              <p className="text-xs text-muted-foreground">Nada recente ainda</p>
            ) : null}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Salvos</h2>
            {library.saved.length ? (
              library.saved.map((saved) => (
                <article key={saved.id} className="surface-glass flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{saved.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {saved.proteinG} g · {saved.kcal} kcal
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Apagar salvo"
                    onClick={() => {
                      removeSavedMeal(saved.id);
                      toast.success("Removido");
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                  <Button size="sm" onClick={() => logSaved(saved, libSlot, todayKey())}>
                    Registrar
                  </Button>
                </article>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                Salve uma refeição no diário para reusar depois
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="px-1 text-sm font-semibold">Histórico</h2>
            {history.map((d) => {
              const meals = (state.meals ?? []).filter((m) => m.date.slice(0, 10) === d.date);
              return (
                <article key={d.date} className="surface-glass p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{d.label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {d.proteinG} g P · {d.kcal} kcal · {d.meals} ref
                    </p>
                  </div>
                  {meals.length ? (
                    <ul className="mt-2 space-y-1">
                      {meals.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                        >
                          <span>
                            {MEAL_SLOT_LABEL[m.slot]} · {m.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Sem registros</p>
                  )}
                </article>
              );
            })}
          </section>
        </TabsContent>
      </Tabs>

      {pickerSlot ? (
        <MealPickerSheet
          slot={pickerSlot}
          onClose={() => setPickerSlot(null)}
          onPick={(p, servings) => addPreset(p, pickerSlot, servings, pickerDate)}
          onPickCustom={(meal) => {
            const entry: Parameters<typeof addMealEntry>[0] = {
              slot: pickerSlot,
              date: pickerDate,
              label: meal.label,
              proteinG: meal.proteinG,
              kcal: meal.kcal,
              quality: meal.quality,
              sourceKind: meal.sourceKind ?? "estimated",
            };
            if (meal.carbG != null) entry.carbG = meal.carbG;
            if (meal.fatG != null) entry.fatG = meal.fatG;
            if (meal.fiberG != null) entry.fiberG = meal.fiberG;
            if (meal.confidence != null) entry.confidence = meal.confidence;
            if (meal.aiMode) entry.aiMode = meal.aiMode;
            if (meal.correctedFromAi != null) entry.correctedFromAi = meal.correctedFromAi;
            if (meal.items) entry.items = meal.items;
            if (meal.foodSource) entry.foodSource = meal.foodSource;
            if (meal.nutrientSnapshot) entry.nutrientSnapshot = meal.nutrientSnapshot;
            addMealEntry(entry);
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

      <NutritionAjustesSheet
        open={ajustesOpen}
        profile={state.profile}
        favoriteIds={state.favoriteMealPresetIds ?? []}
        onToggleFavorite={toggleFavoriteMeal}
        onClose={() => setAjustesOpen(false)}
        onSave={(patch) => {
          patchProfile(patch);
          toast.success("Nutrição atualizada");
        }}
      />

      <ShoppingWeekSheet
        open={shoppingOpen}
        onClose={() => setShoppingOpen(false)}
        weekPlan={weekPlan}
        meals={state.meals ?? []}
      />
    </AppShell>
  );
}
