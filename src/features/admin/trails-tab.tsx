import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContentProgram } from "@/lib/content/types";

function emptyProgram(): ContentProgram {
  return {
    id: "",
    title: "",
    description: "",
    durationWeeks: 4,
    sessionsPerWeek: 3,
    expertIds: [],
    published: false,
  };
}

export function TrailsTab({
  rows,
  busy,
  onReload,
  onSave,
}: {
  rows: ContentProgram[];
  busy: boolean;
  onReload: () => void;
  onSave: (row: ContentProgram) => void;
}) {
  const [draft, setDraft] = useState<ContentProgram | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onReload} disabled={busy}>
          Recarregar
        </Button>
        <Button onClick={() => setDraft(emptyProgram())}>Nova trilha</Button>
      </div>
      {draft ? (
        <div className="surface-glass space-y-2 p-4">
          <Label className="text-xs">id</Label>
          <Input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
          <Label className="text-xs">título</Label>
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <Label className="text-xs">descrição</Label>
          <textarea
            className="min-h-24 w-full rounded-md border border-white/10 bg-background p-2 text-sm"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <Label className="text-xs">semanas</Label>
          <Input
            type="number"
            value={draft.durationWeeks}
            onChange={(e) => setDraft({ ...draft, durationWeeks: Number(e.target.value) || 4 })}
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
            />
            publicado
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
        {rows.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="surface-glass w-full p-3 text-left"
              onClick={() => setDraft({ ...p })}
            >
              <p className="text-sm font-semibold">{p.title}</p>
              <p className="text-xs text-muted-foreground">
                {p.durationWeeks} sem · {p.published ? "publicado" : "rascunho"}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
