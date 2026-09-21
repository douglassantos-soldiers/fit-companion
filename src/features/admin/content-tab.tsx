import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContentKind, PublicContentItem } from "@/lib/content-match";
import { CONTENT_KINDS } from "@/lib/content-match";

const KINDS: ContentKind[] = [...CONTENT_KINDS];
const GOALS = ["massa", "gordura", "performance", "saude"];
const LEVELS = ["iniciante", "intermediario", "avancado"];

function emptyItem(): PublicContentItem {
  return {
    id: "",
    kind: "tip",
    title: "",
    body: "",
    goals: [],
    levels: [],
    published: false,
    sortOrder: 0,
    visible: true,
  };
}

export function ContentTab({
  rows,
  busy,
  onReload,
  onSave,
  onDelete,
}: {
  rows: PublicContentItem[];
  busy: boolean;
  onReload: () => void;
  onSave: (row: PublicContentItem) => void;
  onDelete: (id: string) => void;
}) {
  const [kind, setKind] = useState<string>("all");
  const [draft, setDraft] = useState<PublicContentItem | null>(null);
  const filtered = useMemo(
    () => (kind === "all" ? rows : rows.filter((r) => r.kind === kind)),
    [rows, kind],
  );

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          className="h-10 rounded-md border border-white/10 bg-background px-3 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="all">todos</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={onReload} disabled={busy}>
          Recarregar
        </Button>
        <Button onClick={() => setDraft(emptyItem())}>Novo</Button>
      </div>
      {draft ? (
        <div className="surface-glass space-y-2 p-4">
          <Label className="text-xs">tipo</Label>
          <select
            className="h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm"
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value as ContentKind })}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <Label className="text-xs">título</Label>
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <Label className="text-xs">corpo</Label>
          <textarea
            className="min-h-28 w-full rounded-md border border-white/10 bg-background p-2 text-sm"
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Objetivo</p>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <label key={g} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={draft.goals.includes(g)}
                  onChange={() => setDraft({ ...draft, goals: toggle(draft.goals, g) })}
                />
                {g}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Nível</p>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((lv) => (
              <label key={lv} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={draft.levels.includes(lv)}
                  onChange={() => setDraft({ ...draft, levels: toggle(draft.levels, lv) })}
                />
                {lv}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
            />
            publicado
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.visible !== false}
              onChange={(e) => setDraft({ ...draft, visible: e.target.checked })}
            />
            visível
          </label>
          <Label className="text-xs">publicar em</Label>
          <Input
            type="datetime-local"
            value={draft.publishAt ? draft.publishAt.slice(0, 16) : ""}
            onChange={(e) => {
              const next = { ...draft };
              if (e.target.value) next.publishAt = e.target.value;
              else delete next.publishAt;
              setDraft(next);
            }}
          />
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => onSave(draft)}>
              Salvar
            </Button>
            {draft.id ? (
              <Button variant="outline" disabled={busy} onClick={() => onDelete(draft.id)}>
                Excluir
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
      <ul className="space-y-2">
        {filtered.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="surface-glass w-full p-3 text-left"
              onClick={() => setDraft({ ...c })}
            >
              <p className="text-sm font-semibold">{c.title}</p>
              <p className="text-xs text-muted-foreground">
                {c.kind} · {c.published ? "publicado" : "rascunho"} · {c.goals.join("/") || "todos"}{" "}
                · {c.levels.join("/") || "todos"}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
