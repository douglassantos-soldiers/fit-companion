import { supabase } from "@/integrations/supabase/client";
import {
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
    theme: "dark",
    dimensionSnapshots: [],
    earnedBadges: [],
    meals: [],
    shareProgress: true,
    sessionFx: true,
    favoriteMealPresetIds: [],
    remindersEnabled: false,
    reminderHour: 18,
    seenOnboardingTips: [],
    ...retentionFromRow((stateRes.data as { retention?: unknown } | null)?.retention),
  } as AppState;
}

function retentionFromRow(raw: unknown): Partial<AppState> {
  if (!raw || typeof raw !== "object") {
    return {
      xpByDate: {},
      streakFreezes: 1,
      freezeUsedDates: [],
      xpGoalMetDates: [],
      dailyQuestIds: [],
      dailyQuestDate: "",
      dailyQuestProgress: {},
      cosmeticBadges: [],
      authUserId: null,
      bio: "",
      avatarUrl: null,
      accessGranted: false,
      accessEmail: null,
      accessGrantedAt: null,
      accessTier: "base",
      purchaseProductIds: [],
      restockEstimates: {},
      routineFromPurchase: false,
      routineFromPurchaseDismissed: false,
      upsellShownDate: null,
      challengeBaselines: {},
      joinedHubIds: [],
    };
  }
  const r = raw as Record<string, unknown>;
  return {
    xpByDate: (r["xpByDate"] as Record<string, number>) ?? {},
    streakFreezes: typeof r["streakFreezes"] === "number" ? r["streakFreezes"] : 1,
    freezeUsedDates: Array.isArray(r["freezeUsedDates"]) ? (r["freezeUsedDates"] as string[]) : [],
    xpGoalMetDates: Array.isArray(r["xpGoalMetDates"]) ? (r["xpGoalMetDates"] as string[]) : [],
    dailyQuestIds: Array.isArray(r["dailyQuestIds"]) ? (r["dailyQuestIds"] as string[]) : [],
    dailyQuestDate: typeof r["dailyQuestDate"] === "string" ? r["dailyQuestDate"] : "",
    dailyQuestProgress: (r["dailyQuestProgress"] as Record<string, number>) ?? {},
    cosmeticBadges: Array.isArray(r["cosmeticBadges"]) ? (r["cosmeticBadges"] as string[]) : [],
    authUserId: typeof r["authUserId"] === "string" ? r["authUserId"] : null,
    bio: typeof r["bio"] === "string" ? r["bio"] : "",
    avatarUrl: typeof r["avatarUrl"] === "string" ? r["avatarUrl"] : null,
    accessGranted: r["accessGranted"] === true,
    accessEmail: typeof r["accessEmail"] === "string" ? r["accessEmail"] : null,
    accessGrantedAt: typeof r["accessGrantedAt"] === "string" ? r["accessGrantedAt"] : null,
    accessTier: r["accessTier"] === "performance" ? "performance" : "base",
    purchaseProductIds: Array.isArray(r["purchaseProductIds"]) ? (r["purchaseProductIds"] as string[]) : [],
    restockEstimates:
      r["restockEstimates"] && typeof r["restockEstimates"] === "object"
        ? (r["restockEstimates"] as AppState["restockEstimates"])
        : {},
    routineFromPurchase: r["routineFromPurchase"] === true,
    routineFromPurchaseDismissed: r["routineFromPurchaseDismissed"] === true,
    upsellShownDate: typeof r["upsellShownDate"] === "string" ? r["upsellShownDate"] : null,
    challengeBaselines:
      r["challengeBaselines"] && typeof r["challengeBaselines"] === "object"
        ? (r["challengeBaselines"] as Record<string, number>)
        : {},
    joinedHubIds: Array.isArray(r["joinedHubIds"]) ? (r["joinedHubIds"] as string[]) : [],
  };
}

function retentionPayload(state: AppState) {
  return {
    xpByDate: state.xpByDate ?? {},
    streakFreezes: state.streakFreezes ?? 1,
    freezeUsedDates: state.freezeUsedDates ?? [],
    xpGoalMetDates: state.xpGoalMetDates ?? [],
    dailyQuestIds: state.dailyQuestIds ?? [],
    dailyQuestDate: state.dailyQuestDate ?? "",
    dailyQuestProgress: state.dailyQuestProgress ?? {},
    cosmeticBadges: state.cosmeticBadges ?? [],
    authUserId: state.authUserId ?? null,
    bio: state.bio ?? "",
    avatarUrl: state.avatarUrl ?? null,
    accessGranted: state.accessGranted === true,
    accessEmail: state.accessEmail ?? null,
    accessGrantedAt: state.accessGrantedAt ?? null,
    accessTier: state.accessTier ?? "base",
    purchaseProductIds: state.purchaseProductIds ?? [],
    restockEstimates: state.restockEstimates ?? {},
    routineFromPurchase: state.routineFromPurchase === true,
    routineFromPurchaseDismissed: state.routineFromPurchaseDismissed === true,
    upsellShownDate: state.upsellShownDate ?? null,
    challengeBaselines: state.challengeBaselines ?? {},
    joinedHubIds: state.joinedHubIds ?? [],
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
        // retention column added in phase6; cast until types regenerate
        ...( { retention: retentionPayload(state) } as Record<string, unknown>),
      } as never,
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
