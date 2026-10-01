import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseCommaList, parsePipeList } from "@/features/admin/ui";
import { toCanonicalExercise } from "@/lib/training/canonical-exercise";
import type { ResolvedLibraryExercise } from "@/lib/training/resolve-catalog";

const GROUPS = ["peito", "costas", "pernas", "ombros", "biceps", "triceps", "core", "cardio"];

function emptyDraft(): ResolvedLibraryExercise {
  return toCanonicalExercise({
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
    movementPattern: "mobility",
    difficulty: "intermediate",
    plannerEligible: true,
    active: true,
    instructions: [],
    alternativeIds: [],
  });
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
      (e) =>
        e.name.toLowerCase().includes(t) || e.id.toLowerCase().includes(t) || e.group.includes(t),
    );
  }, [rows, q]);

  const list = filtered.slice(0, 200);
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

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
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Label className="text-xs">grupo</Label>
          <select
            className="h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm"
            value={draft.group}
            onChange={(e) =>
              setDraft({ ...draft, group: e.target.value as ResolvedLibraryExercise["group"] })
            }
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
                primaryMuscles: parseCommaList(e.target.value) as never,
              })
            }
          />
          <Label className="text-xs">alternativas (ids, vírgula)</Label>
          <Input
            value={draft.alternativeIds.join(",")}
            onChange={(e) =>
              setDraft({
                ...draft,
                alternativeIds: parseCommaList(e.target.value),
              })
            }
          />
          <Label className="text-xs">cues</Label>
          <Input
            value={(draft.cues ?? []).join(" | ")}
            onChange={(e) =>
              setDraft({
                ...draft,
                cues: parsePipeList(e.target.value),
              })
            }
          />
          <Label className="text-xs">aliases (vírgula)</Label>
          <Input
            value={(draft.aliases ?? []).join(",")}
            onChange={(e) =>
              setDraft({
                ...draft,
                aliases: parseCommaList(e.target.value),
              })
            }
          />
          <Label className="text-xs">search terms (vírgula)</Label>
          <Input
            value={(draft.searchTerms ?? []).join(",")}
            onChange={(e) =>
              setDraft({
                ...draft,
                searchTerms: parseCommaList(e.target.value),
              })
            }
          />
          <Label className="text-xs">media id</Label>
          <Input
            value={draft.mediaId}
            onChange={(e) => setDraft({ ...draft, mediaId: e.target.value.trim() || draft.id })}
          />
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
      <div ref={parentRef} className="max-h-[60vh] overflow-y-auto">
        <ul className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((row) => {
            const e = list[row.index]!;
            return (
              <li
                key={e.id}
                className="absolute left-0 top-0 w-full pb-2"
                style={{
                  height: `${row.size}px`,
                  transform: `translateY(${row.start}px)`,
                }}
              >
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
            );
          })}
        </ul>
      </div>
    </div>
  );
}
