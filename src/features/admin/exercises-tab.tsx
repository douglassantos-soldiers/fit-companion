import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResolvedLibraryExercise } from "@/lib/training/resolve-catalog";

const GROUPS = ["peito", "costas", "pernas", "ombros", "biceps", "triceps", "core", "cardio"];

function emptyDraft(): ResolvedLibraryExercise {
  return {
    id: "",
    name: "",
    group: "peito",
    equipment: "ambos",
    swapGroup: "",
    joints: [],
    unit: "kg",
    baseLoad: 20,
    priority: 2,
    primaryMuscles: ["peito"],
    secondaryMuscles: [],
    movementPattern: "other",
    difficulty: "intermediate",
    plannerEligible: true,
    active: true,
    instructions: [],
    animationSpec: {
      start: "posição inicial",
      end: "posição final",
      tempo: "controlled",
      durationSec: 4,
      loop: true,
      camera: "three-quarter",
    },
    alternativeIds: [],
  };
}

export function ExercisesTab({
  rows,
  busy,
  onReload,
  onSave,
}: {
  rows: ResolvedLibraryExercise[];
  busy: boolean;
  onReload: () => void;
  onSave: (row: ResolvedLibraryExercise) => void;
}) {
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<ResolvedLibraryExercise | null>(null);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (e) => e.name.toLowerCase().includes(t) || e.id.toLowerCase().includes(t) || e.group.includes(t),
    );
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar exercício…" />
        <Button variant="secondary" onClick={onReload} disabled={busy}>
          Recarregar
        </Button>
        <Button onClick={() => setDraft(emptyDraft())}>Novo</Button>
      </div>
      {draft ? (
        <div className="surface-glass space-y-2 p-4">
          <Label className="text-xs">id</Label>
          <Input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
          <Label className="text-xs">nome</Label>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Label className="text-xs">grupo</Label>
          <select
            className="h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm"
            value={draft.group}
            onChange={(e) => setDraft({ ...draft, group: e.target.value as ResolvedLibraryExercise["group"] })}
          >
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <Label className="text-xs">vídeo URL</Label>
          <Input
            value={draft.videoUrl ?? ""}
            onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })}
          />
          <Label className="text-xs">músculos primários (vírgula)</Label>
          <Input
            value={draft.primaryMuscles.join(",")}
            onChange={(e) =>
              setDraft({
                ...draft,
                primaryMuscles: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) as never,
              })
            }
          />
          <Label className="text-xs">alternativas (ids, vírgula)</Label>
          <Input
            value={draft.alternativeIds.join(",")}
            onChange={(e) =>
              setDraft({
                ...draft,
                alternativeIds: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
          <Label className="text-xs">cues</Label>
          <Input value={draft.cues ?? ""} onChange={(e) => setDraft({ ...draft, cues: e.target.value })} />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            ativo
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.plannerEligible}
              onChange={(e) => setDraft({ ...draft, plannerEligible: e.target.checked })}
            />
            planner
          </label>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => onSave(draft)}>
              Salvar
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
      <ul className="space-y-2">
        {filtered.slice(0, 80).map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className="surface-glass w-full p-3 text-left"
              onClick={() => setDraft({ ...e })}
            >
              <p className="text-sm font-semibold">{e.name}</p>
              <p className="text-xs text-muted-foreground">
                {e.id} · {e.group} · {e.active ? "ativo" : "desativado"}
                {e.alternativeIds.length ? ` · alt ${e.alternativeIds.length}` : ""}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
