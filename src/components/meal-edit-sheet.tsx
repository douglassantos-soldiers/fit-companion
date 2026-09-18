import { useState } from "react";
import { NumberInput } from "@mantine/core";
import { presetById } from "@/data/meal-presets";
import { QUALITY_LABEL, scalePreset } from "@/lib/engine/nutrition";
import type { MealEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SoldiersOverlay } from "@/components/soldiers-overlay";

export function MealEditSheet({
  entry,
  onClose,
  onSave,
}: {
  entry: MealEntry;
  onClose: () => void;
  onSave: (patch: { label: string; servings: number; proteinG: number; kcal: number }) => void;
}) {
  const [label, setLabel] = useState(entry.label);
  const [servings, setServings] = useState(entry.servings ?? 1);

  const preset = entry.presetId ? presetById(entry.presetId) : undefined;
  const prevServings = entry.servings ?? 1;

  const preview = (() => {
    if (preset) return scalePreset(preset, servings);
    const ratio = servings / Math.max(prevServings, 0.25);
    return {
      proteinG: Math.round(entry.proteinG * ratio),
      kcal: Math.round(entry.kcal * ratio),
    };
  })();

  return (
    <SoldiersOverlay open onClose={onClose} title="Editar refeição" description="Ajuste porção ou nome">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Nome</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
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
        <p className="text-sm text-muted-foreground">
          Preview: <span className="font-semibold text-foreground">{preview.proteinG} g</span> proteína ·{" "}
          <span className="font-semibold text-foreground">{preview.kcal} kcal</span>
          {preset ? (
            <span className="ml-1 text-xs">· {QUALITY_LABEL[preset.quality]}</span>
          ) : null}
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
                label: label.trim() || entry.label,
                servings,
                proteinG: preview.proteinG,
                kcal: preview.kcal,
              })
            }
          >
            Salvar
          </Button>
        </div>
      </div>
    </SoldiersOverlay>
  );
}
