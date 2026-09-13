import { supabase } from "@/integrations/supabase/client";
import {
  emptyState,
  type AppState,
  type ChatMessage,
  type Equipment,
  type ExerciseLog,
  type Goal,
  type Level,
} from "@/lib/types";

const DEVICE_KEY = "soldiers-device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** Lê todos os dados do aparelho no banco. Retorna null quando ainda não há nada. */
export async function pullState(deviceId: string): Promise<AppState | null> {
  if (!deviceId) return null;

  const [profileRes, sessionsRes, weightsRes, daysRes, supplementsRes, stateRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("device_id", deviceId).maybeSingle(),
    supabase.from("sessions").select("*").eq("device_id", deviceId).order("date", { ascending: false }),
    supabase.from("weights").select("*").eq("device_id", deviceId).order("date", { ascending: true }),
    supabase.from("daily_metrics").select("*").eq("device_id", deviceId),
    supabase.from("supplement_logs").select("*").eq("device_id", deviceId),
    supabase.from("app_state").select("*").eq("device_id", deviceId).maybeSingle(),
  ]);

  const hasAnything =
    profileRes.data ||
    (sessionsRes.data?.length ?? 0) > 0 ||
    (weightsRes.data?.length ?? 0) > 0 ||
    (daysRes.data?.length ?? 0) > 0 ||
    (supplementsRes.data?.length ?? 0) > 0 ||
    stateRes.data;

  if (!hasAnything) return null;

  const p = profileRes.data;

  return {
    profile: p
      ? {
          name: p.name,
          goal: p.goal as Goal,
          level: p.level as Level,
          daysPerWeek: p.days_per_week,
          age: p.age,
          heightCm: p.height_cm,
          weightKg: Number(p.weight_kg),
          equipment: p.equipment as Equipment,
          restrictions: p.restrictions ?? [],
          createdAt: p.created_at,
        }
      : null,
    sessions: (sessionsRes.data ?? []).map((s) => ({
      id: s.client_id,
      dayId: s.day_id,
      title: s.title,
      date: s.date,
      durationMin: s.duration_min,
      exercises: (s.exercises as unknown as ExerciseLog[]) ?? [],
      volumeKg: Number(s.volume_kg),
    })),
    weights: (weightsRes.data ?? []).map((w) => ({ date: w.date, weightKg: Number(w.weight_kg) })),
    days: Object.fromEntries(
      (daysRes.data ?? []).map((d) => [d.date, { date: d.date, waterMl: d.water_ml, meals: d.meals }]),
    ),
    supplementLogs: Object.fromEntries(
      (supplementsRes.data ?? []).map((s) => [s.date, s.supplement_ids ?? []]),
    ),
    supplementRoutine: stateRes.data?.supplement_routine ?? [],
    challenges: stateRes.data?.challenges ?? [],
    chat: (stateRes.data?.chat as unknown as ChatMessage[]) ?? [],
  };
}

/** Grava o estado atual do aparelho no banco (upsert completo — os dados são pequenos). */
export async function pushState(deviceId: string, state: AppState): Promise<void> {
  if (!deviceId) return;

  const tasks: Array<PromiseLike<unknown>> = [];

  if (state.profile) {
    tasks.push(
      supabase.from("profiles").upsert(
        {
          device_id: deviceId,
          name: state.profile.name,
          goal: state.profile.goal,
          level: state.profile.level,
          days_per_week: state.profile.daysPerWeek,
          age: state.profile.age,
          height_cm: state.profile.heightCm,
          weight_kg: state.profile.weightKg,
          equipment: state.profile.equipment,
          restrictions: state.profile.restrictions,
        },
        { onConflict: "device_id" },
      ),
    );
  }

  tasks.push(
    supabase.from("app_state").upsert(
      {
        device_id: deviceId,
        supplement_routine: state.supplementRoutine,
        challenges: state.challenges,
        chat: state.chat as unknown as never,
      },
      { onConflict: "device_id" },
    ),
  );

  if (state.sessions.length) {
    tasks.push(
      supabase.from("sessions").upsert(
        state.sessions.map((s) => ({
          device_id: deviceId,
          client_id: s.id,
          day_id: s.dayId,
          title: s.title,
          date: s.date,
          duration_min: s.durationMin,
          exercises: s.exercises as unknown as never,
          volume_kg: s.volumeKg,
        })),
        { onConflict: "device_id,client_id" },
      ),
    );
  }

  if (state.weights.length) {
    tasks.push(
      supabase.from("weights").upsert(
        state.weights.map((w) => ({ device_id: deviceId, date: w.date, weight_kg: w.weightKg })),
        { onConflict: "device_id,date" },
      ),
    );
  }

  const days = Object.values(state.days);
  if (days.length) {
    tasks.push(
      supabase.from("daily_metrics").upsert(
        days.map((d) => ({ device_id: deviceId, date: d.date, water_ml: d.waterMl, meals: d.meals })),
        { onConflict: "device_id,date" },
      ),
    );
  }

  const supplementDays = Object.entries(state.supplementLogs);
  if (supplementDays.length) {
    tasks.push(
      supabase.from("supplement_logs").upsert(
        supplementDays.map(([date, ids]) => ({ device_id: deviceId, date, supplement_ids: ids })),
        { onConflict: "device_id,date" },
      ),
    );
  }

  const results = await Promise.all(tasks.map((t) => Promise.resolve(t).catch((e: unknown) => ({ error: e }))));
  for (const r of results) {
    const error = (r as { error?: unknown } | null)?.error;
    if (error) console.error("Falha ao sincronizar dados", error);
  }
}

export async function clearRemoteState(deviceId: string): Promise<void> {
  if (!deviceId) return;
  await Promise.all([
    supabase.from("sessions").delete().eq("device_id", deviceId),
    supabase.from("weights").delete().eq("device_id", deviceId),
    supabase.from("daily_metrics").delete().eq("device_id", deviceId),
    supabase.from("supplement_logs").delete().eq("device_id", deviceId),
    supabase.from("app_state").delete().eq("device_id", deviceId),
    supabase.from("profiles").delete().eq("device_id", deviceId),
  ]);
}

export const emptyRemoteState = emptyState;
