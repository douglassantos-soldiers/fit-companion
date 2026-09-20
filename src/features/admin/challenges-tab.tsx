import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminChallengeRow } from "@/lib/catalog.server";

function emptyChallenge(): AdminChallengeRow {
  return {
    id: "",
    title: "",
    description: "",
    category: "consistency",
    metric: "sessoes",
    target: 1,
    unit: "treinos",
    durationDays: 7,
    rankingMode: "absolute",
    active: true,
    participants: 0,
  };
}

export function ChallengesTab({
  rows,
  busy,
  onReload,
  onSave,
}: {
  rows: AdminChallengeRow[];
  busy: boolean;
  onReload: () => void;
  onSave: (row: AdminChallengeRow) => void;
}) {
  const [draft, setDraft] = useState<AdminChallengeRow | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onReload} disabled={busy}>
          Recarregar
        </Button>
        <Button onClick={() => setDraft(emptyChallenge())}>Novo</Button>
      </div>
      {draft ? (
        <div className="surface-glass space-y-2 p-4">
          <Label className="text-xs">id</Label>
          <Input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
          <Label className="text-xs">título</Label>
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <Label className="text-xs">descrição</Label>
          <Input
            value={draft.description ?? ""}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <Label className="text-xs">duração (dias)</Label>
          <Input
            type="number"
            value={draft.durationDays ?? 7}
            onChange={(e) => setDraft({ ...draft, durationDays: Number(e.target.value) })}
          />
          <Label className="text-xs">meta</Label>
          <Input
            type="number"
            value={draft.target ?? 1}
            onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })}
          />
          <Label className="text-xs">recompensa</Label>
          <Input
            value={draft.reward ?? ""}
            onChange={(e) => setDraft({ ...draft, reward: e.target.value })}
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.active !== false}
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
        {rows.map((c) => (
          <li key={c.id}>
            <button type="button" className="surface-glass w-full p-3 text-left" onClick={() => setDraft({ ...c })}>
              <p className="text-sm font-semibold">{c.title}</p>
              <p className="text-xs text-muted-foreground">
                {c.target} {c.unit} · {c.durationDays}d · {c.participants} participantes
                {c.reward ? ` · ${c.reward}` : ""}
                {c.active === false ? " · inativo" : ""}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
