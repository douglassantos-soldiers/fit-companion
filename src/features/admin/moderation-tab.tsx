import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContentReportRow } from "@/lib/moderation.server";

export function ModerationTab({
  reports,
  busy,
  loadError,
  onReload,
  onResolve,
  onHide,
  onHideComment,
}: {
  reports: ContentReportRow[];
  busy: boolean;
  loadError: string | null;
  onReload: () => void;
  onResolve: (reportId: string, status: "resolved" | "dismissed", hideEvent: boolean) => void;
  onHide: (eventId: string) => void;
  onHideComment?: (commentId: string) => void;
}) {
  const [eventId, setEventId] = useState("");
  const [commentId, setCommentId] = useState("");
  return (
    <div className="space-y-4">
      <Button variant="secondary" onClick={onReload} disabled={busy}>
        Recarregar fila
      </Button>
      {loadError ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Input
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          placeholder="Ocultar por event id (fallback)"
        />
        <Button
          variant="outline"
          disabled={busy || !eventId.trim()}
          onClick={() => onHide(eventId.trim())}
        >
          Ocultar evento
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          value={commentId}
          onChange={(e) => setCommentId(e.target.value)}
          placeholder="Ocultar por comment id (fallback)"
        />
        <Button
          variant="outline"
          disabled={busy || !commentId.trim() || !onHideComment}
          onClick={() => onHideComment?.(commentId.trim())}
        >
          Ocultar comentário
        </Button>
      </div>
      {!reports.length ? (
        <p className="text-sm text-muted-foreground">Fila vazia.</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.id} className="surface-glass space-y-2 p-3">
              <p className="text-xs uppercase text-muted-foreground">{r.targetKind}</p>
              <p className="text-sm font-semibold">{r.eventPreview ?? r.targetId}</p>
              <p className="text-xs text-muted-foreground">
                {r.reason} · {new Date(r.createdAt).toLocaleString("pt-BR")}
                {r.hiddenAt ? " · já oculto" : ""}
              </p>
              <p className="truncate text-[0.65rem] text-muted-foreground">id: {r.targetId}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => onResolve(r.id, "resolved", true)}>
                  Ocultar + resolver
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onResolve(r.id, "dismissed", false)}
                >
                  Dispensar
                </Button>
                {r.targetKind === "activity_event" && !r.hiddenAt ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onHide(r.targetId)}
                  >
                    Ocultar evento
                  </Button>
                ) : null}
                {r.targetKind === "comment" && onHideComment ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onHideComment(r.targetId)}
                  >
                    Ocultar comentário
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
