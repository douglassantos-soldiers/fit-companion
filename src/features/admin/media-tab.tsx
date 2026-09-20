import { Image, Save, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CmsState } from "@/lib/cms";
import type { Exercise } from "@/data/exercises";
import type { MealPreset } from "@/data/meal-presets";

export function MediaTab({
  cms,
  setCms,
  featured,
  meals,
  saving,
  onSave,
}: {
  cms: CmsState;
  setCms: (updater: (s: CmsState) => CmsState) => void;
  featured: Exercise[];
  meals: MealPreset[];
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <Button className="h-11 w-full gap-2 font-bold uppercase tracking-wide" onClick={onSave} disabled={saving}>
        <Save className="size-4" /> {saving ? "Salvando…" : "Salvar mídia"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Thumbs de refeição (legado). Vídeo de exercício prefere o catálogo em Exercícios.
      </p>
      {featured.map((ex) => (
        <div key={ex.id} className="surface-glass space-y-2 p-4">
          <div className="flex items-center gap-2">
            <Video className="size-4 text-primary" />
            <p className="text-sm font-semibold">{ex.name}</p>
          </div>
          <Label className="text-xs text-muted-foreground">mediaUrl</Label>
          <Input
            value={cms.exerciseMedia[ex.id] ?? ex.mediaUrl ?? ""}
            placeholder="https://…"
            onChange={(e) =>
              setCms((s) => ({
                ...s,
                exerciseMedia: { ...s.exerciseMedia, [ex.id]: e.target.value },
              }))
            }
          />
        </div>
      ))}
      {meals.map((m) => (
        <div key={m.id} className="surface-glass space-y-2 p-4">
          <div className="flex items-center gap-2">
            <Image className="size-4 text-primary" />
            <p className="text-sm font-semibold">{m.label}</p>
          </div>
          <Input
            value={cms.mealImages[m.id] ?? m.imageUrl ?? ""}
            placeholder="https://… imagem"
            onChange={(e) =>
              setCms((s) => ({
                ...s,
                mealImages: { ...s.mealImages, [m.id]: e.target.value },
              }))
            }
          />
        </div>
      ))}
    </div>
  );
}
