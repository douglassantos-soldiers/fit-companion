/**
 * Export session history as CSV (one row per set) for power users.
 */
import { exerciseById } from "@/data/exercises";
import type { SessionLog } from "@/lib/types";

export const SESSIONS_CSV_HEADER =
  "date,sessionId,title,exerciseId,exerciseName,setIndex,type,reps,weightKg,rpe,rir,done,skipped,durationMin,sessionVolumeKg,sessionRpe";

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportSessionsCsv(sessions: SessionLog[]): string {
  const lines = [SESSIONS_CSV_HEADER];
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  for (const session of ordered) {
    const date = session.date.slice(0, 10);
    for (const ex of session.exercises) {
      const name = exerciseById(ex.exerciseId)?.name ?? ex.exerciseId;
      ex.sets.forEach((set, idx) => {
        lines.push(
          [
            csvEscape(date),
            csvEscape(session.id),
            csvEscape(session.title),
            csvEscape(ex.exerciseId),
            csvEscape(name),
            csvEscape(set.setNumber ?? idx + 1),
            csvEscape(set.type ?? "working"),
            csvEscape(set.reps),
            csvEscape(set.weightKg),
            csvEscape(set.rpe ?? ""),
            csvEscape(set.rir ?? ""),
            csvEscape(Boolean(set.done)),
            csvEscape(Boolean(set.skipped)),
            csvEscape(session.durationMin),
            csvEscape(session.volumeKg),
            csvEscape(session.rpe ?? ""),
          ].join(","),
        );
      });
    }
  }
  return lines.join("\n");
}

/** Trigger browser download with UTF-8 BOM for Excel. */
export function downloadSessionsCsv(sessions: SessionLog[], filename?: string): void {
  const csv = exportSessionsCsv(sessions);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `soldiers-historico-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
