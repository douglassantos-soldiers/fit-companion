/**
 * Server-side recompute of derived training tables from sessions JSONB.
 * Client never writes performance/PRs/load as source of truth.
 */
import { createClient } from "@supabase/supabase-js";
import { computeAllExercisePerformances } from "@/lib/training/exercise-performance";
import { computeMuscleLoad } from "@/lib/training/muscle-load";
import { currentPersonalRecords } from "@/lib/training/prs";
import { migrateLegacyPrefs } from "@/lib/training/preferences";
import type { AppState, ExerciseLog, SessionLog } from "@/lib/types";
import { todayKey } from "@/lib/types";

function admin() {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function mapSessions(rows: Record<string, unknown>[]): SessionLog[] {
  return rows.map((s) => {
    const rpe = s["rpe"];
    const session: SessionLog = {
      id: String(s["client_id"] ?? s["id"] ?? ""),
      dayId: String(s["day_id"] ?? ""),
      title: String(s["title"] ?? ""),
      date: String(s["date"] ?? "").slice(0, 10),
      durationMin: Number(s["duration_min"] ?? 0),
      exercises: (s["exercises"] as ExerciseLog[]) ?? [],
      volumeKg: Number(s["volume_kg"] ?? 0),
    };
    if (rpe === "facil" || rpe === "ok" || rpe === "dificil") session.rpe = rpe;
    if (s["express"] === true) session.express = true;
    return session;
  });
}

export async function recomputeTrainingDerived(userId: string, state?: AppState | null) {
  const sb = admin();
  if (!sb) return { ok: false as const, reason: "no_supabase" };

  let sessions: SessionLog[] = state?.sessions ?? [];
  if (!sessions.length) {
    const { data } = await sb.from("sessions").select("*").eq("user_id", userId);
    sessions = mapSessions((data as Record<string, unknown>[]) ?? []);
  }

  const perfs = computeAllExercisePerformances(sessions);
  if (perfs.length) {
    await sb.from("exercise_performance").upsert(
      perfs.map((p) => ({
        user_id: userId,
        exercise_id: p.exerciseId,
        best_weight: p.bestWeight,
        best_reps: p.bestReps,
        best_volume: p.bestVolume,
        estimated_1rm: p.estimated1rm,
        recent_weight: p.recentWeight,
        recent_reps: p.recentReps,
        recent_rpe: p.recentRpe,
        trend: p.trend,
        last_performed_at: p.lastPerformedAt,
        updated_at: p.updatedAt,
      })),
      { onConflict: "user_id,exercise_id" },
    );
  }

  const prs = currentPersonalRecords(sessions);
  // Replace current derived PRs for user (idempotent snapshot of latest bests)
  await sb.from("personal_records").delete().eq("user_id", userId);
  if (prs.length) {
    await sb.from("personal_records").insert(
      prs.map((pr) => ({
        user_id: userId,
        exercise_id: pr.exerciseId,
        pr_type: pr.prType,
        value: pr.value,
        previous_value: pr.previousValue,
        session_id: pr.sessionId,
        achieved_at: pr.achievedAt,
        label: pr.label,
      })),
    );
  }

  const date = todayKey();
  const loads = computeMuscleLoad(sessions).filter((m) => m.muscle !== "cardio");
  if (loads.length) {
    await sb.from("muscle_load_snapshots").upsert(
      loads.map((m) => ({
        user_id: userId,
        date,
        muscle: m.muscle,
        direct_sets: m.direct_sets,
        indirect_sets: m.indirect_sets,
        effective_sets: m.effective_sets,
        rolling_7d: m.rolling_7d,
        rolling_28d: m.rolling_28d,
        load_trend: m.load_trend,
        fatigue_contribution: m.fatigue_contribution,
      })),
      { onConflict: "user_id,date,muscle" },
    );
  }

  if (state) {
    const prefs = migrateLegacyPrefs(state);
    const entries = Object.entries(prefs);
    if (entries.length) {
      await sb.from("exercise_preferences").upsert(
        entries.map(([exerciseId, preference]) => ({
          user_id: userId,
          exercise_id: exerciseId,
          preference,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,exercise_id" },
      );
    }
  }

  return { ok: true as const, performances: perfs.length, prs: prs.length };
}
