import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Expert } from "@/lib/content/types";

function emptyExpert(): Expert {
  return {
    id: "",
    name: "",
    bio: "",
    specialty: "",
    verified: false,
    active: true,
  };
}

export function ExpertsTab({
  rows,
  busy,
  onReload,
  onSave,
}: {
  rows: Expert[];
  busy: boolean;
  onReload: () => void;
  onSave: (row: Expert) => void;
}) {
  const [draft, setDraft] = useState<Expert | null>(null);
  const list = useMemo(() => rows, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onReload} disabled={busy}>
          Recarregar
        </Button>
        <Button onClick={() => setDraft(emptyExpert())}>Novo</Button>
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
          <Label className="text-xs">especialidade</Label>
          <Input
            value={draft.specialty}
            onChange={(e) => setDraft({ ...draft, specialty: e.target.value })}
          />
          <Label className="text-xs">bio</Label>
          <textarea
            className="min-h-24 w-full rounded-md border border-white/10 bg-background p-2 text-sm"
            value={draft.bio}
            onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
          />
          <Label className="text-xs">media id (rascunho)</Label>
          <Input
            value={draft.photoMediaId ?? ""}
            onChange={(e) => {
              const next = { ...draft };
              if (e.target.value) next.photoMediaId = e.target.value;
              else delete next.photoMediaId;
              setDraft(next);
            }}
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.verified}
              onChange={(e) => setDraft({ ...draft, verified: e.target.checked })}
            />
            verificado
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            ativo
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
        {list.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className="surface-glass w-full p-3 text-left"
              onClick={() => setDraft({ ...e })}
            >
              <p className="text-sm font-semibold">{e.name}</p>
              <p className="text-xs text-muted-foreground">
                {e.specialty} · {e.active ? "ativo" : "inativo"}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
