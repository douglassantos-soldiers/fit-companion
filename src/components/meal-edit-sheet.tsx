import { useState } from "react";
import { NumberInput } from "@mantine/core";
import { presetById } from "@/data/meal-presets";
import { QUALITY_LABEL, mealProvenanceLabel, scalePreset } from "@/lib/engine/nutrition";
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
  onSave: (patch: {
    label: string;
    servings: number;
    proteinG: number;
    kcal: number;
    carbG?: number;
    fatG?: number;
    fiberG?: number;
    sourceKind: "informed";
    correctedFromAi?: boolean;
    confidence: number;
  }) => void;
}) {
  const [label, setLabel] = useState(entry.label);
  const [servings, setServings] = useState(entry.servings ?? 1);
  const [proteinG, setProteinG] = useState(entry.proteinG);
  const [kcal, setKcal] = useState(entry.kcal);
  const [carbG, setCarbG] = useState(entry.carbG ?? 0);
  const [fatG, setFatG] = useState(entry.fatG ?? 0);
  const [fiberG, setFiberG] = useState(entry.fiberG ?? 0);

  const preset = entry.presetId ? presetById(entry.presetId) : undefined;
  const prevServings = entry.servings ?? 1;

  const applyServings = (nextServings: number) => {
    setServings(nextServings);
    if (preset) {
      const scaled = scalePreset(preset, nextServings);
      setProteinG(scaled.proteinG);
      setKcal(scaled.kcal);
      setCarbG(scaled.carbG);
      setFatG(scaled.fatG);
      return;
    }
    const ratio = nextServings / Math.max(prevServings, 0.25);
    setProteinG(Math.round(entry.proteinG * ratio));
    setKcal(Math.round(entry.kcal * ratio));
    setCarbG(Math.round((entry.carbG ?? 0) * ratio));
    setFatG(Math.round((entry.fatG ?? 0) * ratio));
    setFiberG(Math.round((entry.fiberG ?? 0) * ratio));
  };

  return (
    <SoldiersOverlay open onClose={onClose} title="Editar refeição" description="Ajuste porção ou macros">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">{mealProvenanceLabel(entry)}</p>
        {entry.items?.length ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {entry.items.map((it, i) => (
              <li key={it.id ?? `${it.foodId}-${i}`}>
                {it.foodName ?? it.foodId} · {it.quantity} {it.unit} ({it.grams} g)
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Nome</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <NumberInput
          label="Porções"
          value={servings}
          onChange={(v) => applyServings(typeof v === "number" ? v : 1)}
          min={0.5}
          max={3}
          step={0.5}
          decimalScale={1}
          clampBehavior="strict"
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Proteína (g)"
            value={proteinG}
            onChange={(v) => setProteinG(typeof v === "number" ? v : proteinG)}
            min={0}
            max={200}
          />
          <NumberInput
            label="Kcal"
            value={kcal}
            onChange={(v) => setKcal(typeof v === "number" ? v : kcal)}
            min={0}
            max={3000}
          />
          <NumberInput
            label="Carbo (g)"
            value={carbG}
            onChange={(v) => setCarbG(typeof v === "number" ? v : carbG)}
            min={0}
            max={500}
          />
          <NumberInput
            label="Gordura (g)"
            value={fatG}
            onChange={(v) => setFatG(typeof v === "number" ? v : fatG)}
            min={0}
            max={200}
          />
          <NumberInput
            label="Fibra (g)"
            value={fiberG}
            onChange={(v) => setFiberG(typeof v === "number" ? v : fiberG)}
            min={0}
            max={100}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Preview: <span className="font-semibold text-foreground">{proteinG} g</span> P ·{" "}
          <span className="font-semibold text-foreground">{carbG} g</span> C ·{" "}
          <span className="font-semibold text-foreground">{fatG} g</span> G ·{" "}
          <span className="font-semibold text-foreground">{kcal} kcal</span>
          {preset ? (
            <span className="ml-1 text-xs">· {QUALITY_LABEL[preset.quality]}</span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          Ao salvar, os valores passam a ser <strong>informados</strong> por você
          {entry.sourceKind === "estimated" ? " (correção da estimativa da IA)" : ""}.
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
                proteinG,
                kcal,
                carbG,
                fatG,
                fiberG,
                sourceKind: "informed",
                confidence: 1,
                correctedFromAi: entry.sourceKind === "estimated" || entry.correctedFromAi === true,
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
