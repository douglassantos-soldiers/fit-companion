import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContentCollection } from "@/lib/content/types";

function emptyCollection(): ContentCollection {
  return {
    id: "",
    title: "",
    kind: "education",
    published: false,
    sortOrder: 0,
  };
}

export function CollectionsTab({
  rows,
  busy,
  onReload,
  onSave,
}: {
  rows: ContentCollection[];
  busy: boolean;
  onReload: () => void;
  onSave: (row: ContentCollection) => void;
}) {
  const [draft, setDraft] = useState<ContentCollection | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onReload} disabled={busy}>
          Recarregar
        </Button>
        <Button onClick={() => setDraft(emptyCollection())}>Nova coleção</Button>
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
          <Label className="text-xs">tipo</Label>
          <Input
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
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
        {rows.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="surface-glass w-full p-3 text-left"
              onClick={() => setDraft({ ...c })}
            >
              <p className="text-sm font-semibold">{c.title}</p>
              <p className="text-xs text-muted-foreground">
                {c.kind} · {c.published ? "publicado" : "rascunho"}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
