import { useMemo, useState } from "react";
import { NumberInput } from "@mantine/core";
import { Star } from "lucide-react";
import { MEAL_PRESETS, type MealPreset } from "@/data/meal-presets";
import { QUALITY_LABEL, recentMealPresets, scalePreset } from "@/lib/engine/nutrition";
import { useStore } from "@/lib/store";
import { MEAL_SLOT_LABEL, type MealSlot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import { MealPresetThumb } from "@/components/meal-preset-thumb";
import { cn } from "@/lib/utils";

type PickerTab = "buscar" | "recentes" | "favoritos";

export function MealPickerSheet({
  slot,
  onClose,
  onPick,
}: {
  slot: MealSlot;
  onClose: () => void;
  onPick: (preset: MealPreset, servings: number) => void;
}) {
  const { state, toggleFavoriteMeal } = useStore();
  const [tab, setTab] = useState<PickerTab>("buscar");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MealPreset | null>(null);
  const [servings, setServings] = useState(1);

  const favorites = state.favoriteMealPresetIds ?? [];
  const recent = useMemo(() => recentMealPresets(state.meals ?? [], 8), [state.meals]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = MEAL_PRESETS.filter((p) => p.slot === slot || p.slot === "qualquer" || !slot);
    if (!q) return pool;
    return pool.filter((p) => p.label.toLowerCase().includes(q));
  }, [query, slot]);

  const favoritePresets = useMemo(
    () => MEAL_PRESETS.filter((p) => favorites.includes(p.id)),
    [favorites],
  );

  const list =
    tab === "buscar" ? searchResults : tab === "recentes" ? recent : favoritePresets;

  const preview = selected ? scalePreset(selected, servings) : null;

  const confirm = () => {
    if (!selected) return;
    onPick(selected, servings);
  };

  return (
    <SoldiersOverlay
      open
      onClose={onClose}
      title={MEAL_SLOT_LABEL[slot]}
      description={selected ? "Ajuste a porção" : "Busque, recentes ou favoritos"}
      panelClassName="max-h-[80vh]"
    >
      {selected ? (
        <div className="space-y-4">
          <div>
            <p className="text-display text-lg">{selected.label}</p>
            <p className="text-xs text-muted-foreground">
              Base: {selected.proteinG} g · {selected.kcal} kcal · {QUALITY_LABEL[selected.quality]}
            </p>
          </div>
          <NumberInput
            label="Porções"
            value={servings}
            onChange={(v) => setServings(typeof v === "number" ? v : 1)}
            min={0.5}
            max={3}
            step={0.5}
            decimalScale={1}
            clampBehavior="strict"
          />
          {preview ? (
            <p className="text-sm text-muted-foreground">
              Preview: <span className="font-semibold text-foreground">{preview.proteinG} g</span> proteína ·{" "}
              <span className="font-semibold text-foreground">{preview.kcal} kcal</span>
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setSelected(null)}>
              Voltar
            </Button>
            <Button type="button" className="flex-1" onClick={confirm}>
              Adicionar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as PickerTab)}>
            <TabsList className="w-full">
              <TabsTrigger value="buscar" className="flex-1">
                Buscar
              </TabsTrigger>
              <TabsTrigger value="recentes" className="flex-1">
                Recentes
              </TabsTrigger>
              <TabsTrigger value="favoritos" className="flex-1">
                Favoritos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="buscar" className="mt-3 space-y-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar alimento…"
                autoFocus
              />
              <PresetList
                presets={list}
                favorites={favorites}
                onToggleFavorite={toggleFavoriteMeal}
                onSelect={(p) => {
                  setSelected(p);
                  setServings(1);
                }}
              />
            </TabsContent>

            <TabsContent value="recentes" className="mt-3">
              <PresetList
                presets={list}
                favorites={favorites}
                onToggleFavorite={toggleFavoriteMeal}
                onSelect={(p) => {
                  setSelected(p);
                  setServings(1);
                }}
                empty="Nenhum alimento recente"
              />
            </TabsContent>

            <TabsContent value="favoritos" className="mt-3">
              <PresetList
                presets={list}
                favorites={favorites}
                onToggleFavorite={toggleFavoriteMeal}
                onSelect={(p) => {
                  setSelected(p);
                  setServings(1);
                }}
                empty="Nenhum favorito ainda"
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </SoldiersOverlay>
  );
}

function PresetList({
  presets,
  favorites,
  onToggleFavorite,
  onSelect,
  empty = "Nenhum resultado",
}: {
  presets: MealPreset[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onSelect: (p: MealPreset) => void;
  empty?: string;
}) {
  if (!presets.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ul className="space-y-2">
      {presets.map((p) => {
        const fav = favorites.includes(p.id);
        return (
          <li key={p.id} className="flex items-stretch gap-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onSelect(p)}
              className="h-auto flex-1 justify-start gap-3 rounded-xl px-3 py-3 text-left font-normal"
            >
              <MealPresetThumb preset={p} className="size-11" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{p.label}</span>
                <span className="text-xs text-muted-foreground">
                  {p.proteinG} g proteína · {p.kcal} kcal · {QUALITY_LABEL[p.quality]}
                </span>
              </span>
            </Button>
            <button
              type="button"
              aria-label={fav ? "Remover favorito" : "Favoritar"}
              className={cn(
                "flex w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-primary",
                fav && "text-primary",
              )}
              onClick={() => onToggleFavorite(p.id)}
            >
              <Star className={cn("size-4", fav && "fill-primary")} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
