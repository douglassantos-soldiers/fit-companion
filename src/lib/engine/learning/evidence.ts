/**
 * Evidence extractors — only persisted domain events (sessions, meals, check-ins).
 */
import { todayKey, type AppState } from "@/lib/types";
import type { LearningEvidence } from "@/lib/engine/learning/types";
import { sanitizeEvidenceNote } from "@/lib/engine/learning-guardrails";

export function extractLearningEvidence(state: AppState, date = todayKey()): LearningEvidence[] {
  const out: LearningEvidence[] = [];
  const sessions = [...(state.sessions ?? [])]
    .filter((s) => s.date.slice(0, 10) <= date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);
  for (const s of sessions) {
    const note = sanitizeEvidenceNote(
      `Sessão ${s.durationMin} min${s.express ? " express" : ""} RPE ${s.rpe ?? "—"}`,
    );
    out.push({ date: s.date.slice(0, 10), source: "session", note });
  }

  const meals = [...(state.meals ?? [])]
    .filter((m) => m.date.slice(0, 10) <= date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);
  for (const m of meals) {
    out.push({
      date: m.date.slice(0, 10),
      source: "meal",
      note: sanitizeEvidenceNote(`${m.slot} ${m.proteinG}g proteína`),
    });
  }

  const checkDates = Object.keys(state.dayCheckIns ?? {})
    .filter((d) => d <= date)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 8);
  for (const d of checkDates) {
    const c = state.dayCheckIns?.[d];
    if (!c) continue;
    out.push({
      date: d,
      source: "checkin",
      note: sanitizeEvidenceNote(`sono ${c.sleepHours}h energia ${c.energy}`),
    });
  }

  return out.slice(0, 24);
}
