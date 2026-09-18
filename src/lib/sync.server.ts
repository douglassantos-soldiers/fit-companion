/**
 * Server-side sync via service_role. Resolves user_id from devices — never trusts client userId.
 */
import { adminDbLoose } from "@/lib/db-admin";
import { resolveTrustedIdentity } from "@/lib/session-identity.server";
import {
  type AppState,
  type ChatMessage,
  type DayCheckIn,
  type Equipment,
  type ExerciseLog,
  type Goal,
  type Level,
  type MealEntry,
  type MealQuality,
  type MealSlot,
  type SessionRpe,
} from "@/lib/types";

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
      userId: null,
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
      dayCheckIns: {},
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
    userId: typeof r["userId"] === "string" ? r["userId"] : null,
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
    dayCheckIns:
      r["dayCheckIns"] && typeof r["dayCheckIns"] === "object"
        ? (r["dayCheckIns"] as Record<string, DayCheckIn>)
        : {},
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
    // userId stamped separately from trusted identity — do not mirror client claim as source of truth
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
    dayCheckIns: state.dayCheckIns ?? {},
  };
}

type Row = Record<string, unknown>;

function mapMeals(rows: Row[]): MealEntry[] {
  return rows.map((row) => {
    const payload = (row["payload"] as Record<string, unknown> | null) ?? {};
    const entry: MealEntry = {
      id: String(row["client_id"] || row["id"] || crypto.randomUUID()),
      date: String(row["date"] ?? ""),
      slot: (payload["slot"] as MealSlot) || ((row["meal_type"] as MealSlot) ?? "almoco"),
      label: String(row["name"] || payload["label"] || "Refeição"),
      proteinG: Number(row["protein_g"] ?? payload["proteinG"] ?? 0),
      kcal: Number(row["kcal"] ?? payload["kcal"] ?? 0),
      quality: (payload["quality"] as MealQuality) ?? "ok",
    };
    if (typeof payload["presetId"] === "string") entry.presetId = payload["presetId"];
    if (typeof payload["servings"] === "number") entry.servings = payload["servings"];
    return entry;
  });
}

function parseRpe(raw: unknown): SessionRpe | undefined {
  if (raw === "facil" || raw === "ok" || raw === "dificil") return raw;
  return undefined;
}

function mapSessions(rows: Row[]) {
  return rows.map((s) => {
    const exercises = (s["exercises"] as unknown as ExerciseLog[]) ?? [];
    const session: AppState["sessions"][number] = {
      id: String(s["client_id"]),
      dayId: String(s["day_id"]),
      title: String(s["title"]),
      date: String(s["date"]),
      durationMin: Number(s["duration_min"]),
      exercises,
      volumeKg: Number(s["volume_kg"]),
    };
    const rpe = parseRpe(s["rpe"]);
    if (rpe) session.rpe = rpe;
    if (s["express"] === true) session.express = true;
    return session;
  });
}

async function pullForDeviceIds(deviceIds: string[]): Promise<AppState | null> {
  const db = await adminDbLoose();
  if (!db || !deviceIds.length) return null;

  const [profileRes, sessionsRes, weightsRes, daysRes, supplementsRes, stateRes, mealsRes] =
    await Promise.all([
      db.from("profiles").select("*").in("device_id", deviceIds).order("updated_at", { ascending: false }).limit(1),
      db.from("sessions").select("*").in("device_id", deviceIds).order("date", { ascending: false }),
      db.from("weights").select("*").in("device_id", deviceIds).order("date", { ascending: true }),
      db.from("daily_metrics").select("*").in("device_id", deviceIds),
      db.from("supplement_logs").select("*").in("device_id", deviceIds),
      db.from("app_state").select("*").in("device_id", deviceIds),
      db.from("meal_entries").select("*").in("device_id", deviceIds).order("date", { ascending: true }),
    ]);

  const profiles = (profileRes.data ?? []) as Row[];
  const sessions = (sessionsRes.data ?? []) as Row[];
  const weights = (weightsRes.data ?? []) as Row[];
  const days = (daysRes.data ?? []) as Row[];
  const supplements = (supplementsRes.data ?? []) as Row[];
  const states = (stateRes.data ?? []) as Row[];
  const meals = (mealsRes.data ?? []) as Row[];

  const hasAnything =
    profiles.length > 0 ||
    sessions.length > 0 ||
    weights.length > 0 ||
    days.length > 0 ||
    supplements.length > 0 ||
    states.length > 0 ||
    meals.length > 0;

  if (!hasAnything) return null;

  // Prefer most recently updated app_state
  const stateRow = [...states].sort((a, b) =>
    String(b["updated_at"] ?? "").localeCompare(String(a["updated_at"] ?? "")),
  )[0];

  const p = profiles[0];

  // Dedupe sessions by client_id (keep latest date)
  const sessionById = new Map<string, Row>();
  for (const s of sessions) {
    const cid = String(s["client_id"]);
    const prev = sessionById.get(cid);
    if (!prev || String(s["date"]) >= String(prev["date"])) sessionById.set(cid, s);
  }

  // Dedupe weights by date (prefer higher weight as last write — or later device)
  const weightByDate = new Map<string, Row>();
  for (const w of weights) {
    weightByDate.set(String(w["date"]), w);
  }

  const dayByDate = new Map<string, Row>();
  for (const d of days) dayByDate.set(String(d["date"]), d);

  const suppByDate = new Map<string, Row>();
  for (const s of supplements) suppByDate.set(String(s["date"]), s);

  const mealByClient = new Map<string, Row>();
  for (const m of meals) {
    const cid = String(m["client_id"] || m["id"]);
    mealByClient.set(cid, m);
  }

  const retention = retentionFromRow(stateRow?.["retention"]);

  return {
    profile: p
      ? {
          name: String(p["name"] ?? ""),
          goal: p["goal"] as Goal,
          level: p["level"] as Level,
          daysPerWeek: Number(p["days_per_week"]),
          age: Number(p["age"]),
          heightCm: Number(p["height_cm"]),
          weightKg: Number(p["weight_kg"]),
          equipment: p["equipment"] as Equipment,
          restrictions: (p["restrictions"] as string[]) ?? [],
          createdAt: String(p["created_at"] ?? new Date().toISOString()),
        }
      : null,
    sessions: mapSessions([...sessionById.values()]),
    weights: [...weightByDate.values()].map((w) => ({
      date: String(w["date"]),
      weightKg: Number(w["weight_kg"]),
    })),
    days: Object.fromEntries(
      [...dayByDate.values()].map((d) => [
        String(d["date"]),
        { date: String(d["date"]), waterMl: Number(d["water_ml"]), meals: Number(d["meals"]) },
      ]),
    ),
    supplementLogs: Object.fromEntries(
      [...suppByDate.values()].map((s) => [String(s["date"]), (s["supplement_ids"] as string[]) ?? []]),
    ),
    supplementRoutine: (stateRow?.["supplement_routine"] as string[]) ?? [],
    challenges: (stateRow?.["challenges"] as string[]) ?? [],
    chat: (stateRow?.["chat"] as unknown as ChatMessage[]) ?? [],
    theme: "dark",
    dimensionSnapshots: [],
    earnedBadges: [],
    meals: mapMeals([...mealByClient.values()]),
    shareProgress: true,
    sessionFx: true,
    favoriteMealPresetIds: [],
    remindersEnabled: false,
    reminderHour: 18,
    seenOnboardingTips: [],
    ...retention,
  } as AppState;
}

/** Pull state for device; if user has multiple devices, merge all. */
export async function pullStateServer(deviceId: string): Promise<{
  state: AppState | null;
  userId: string | null;
}> {
  const identity = await resolveTrustedIdentity({ deviceId });
  if (!identity) {
    // Boot before identity: still allow pull of this device only via ensuring user
    const { ensureUserForDevice } = await import("@/lib/identity");
    const user = await ensureUserForDevice(deviceId);
    if (!user) return { state: null, userId: null };
    const state = await pullForDeviceIds([deviceId]);
    if (state) state.userId = user.id;
    return { state, userId: user.id };
  }

  const { listDeviceIdsForUser } = await import("@/lib/identity");
  const deviceIds = await listDeviceIdsForUser(identity.userId);
  const ids = deviceIds.length ? deviceIds : [deviceId];
  const state = await pullForDeviceIds(ids);
  if (state) state.userId = identity.userId;
  return { state, userId: identity.userId };
}

export async function pushStateServer(deviceId: string, state: AppState): Promise<{ ok: boolean; userId: string | null }> {
  const identity = await resolveTrustedIdentity({ deviceId });
  if (!identity) return { ok: false, userId: null };

  const db = await adminDbLoose();
  if (!db) return { ok: false, userId: identity.userId };

  const userId = identity.userId;
  const userStamp = { user_id: userId };
  const tasks: Array<PromiseLike<unknown>> = [];

  if (state.profile) {
    tasks.push(
      db.from("profiles").upsert(
        {
          device_id: deviceId,
          ...userStamp,
          name: state.profile.name,
          goal: state.profile.goal,
          level: state.profile.level,
          days_per_week: state.profile.daysPerWeek,
          age: state.profile.age,
          height_cm: state.profile.heightCm,
          weight_kg: state.profile.weightKg,
          equipment: state.profile.equipment,
          restrictions: state.profile.restrictions,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id" },
      ),
    );
  }

  tasks.push(
    db.from("app_state").upsert(
      {
        device_id: deviceId,
        ...userStamp,
        supplement_routine: state.supplementRoutine,
        challenges: state.challenges,
        chat: state.chat as unknown as never,
        retention: { ...retentionPayload(state), userId },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id" },
    ),
  );

  if (state.sessions.length) {
    tasks.push(
      db.from("sessions").upsert(
        state.sessions.map((s) => ({
          device_id: deviceId,
          ...userStamp,
          client_id: s.id,
          day_id: s.dayId,
          title: s.title,
          date: s.date,
          duration_min: s.durationMin,
          exercises: s.exercises as unknown as never,
          volume_kg: s.volumeKg,
          // Store rpe/express inside a meta-friendly shape if columns missing — embed in exercises wrapper via retention is wrong;
          // use exercises JSON + optional columns when present
          ...(s.rpe != null ? { rpe: s.rpe } : {}),
          ...(s.express ? { express: true } : {}),
        })),
        { onConflict: "device_id,client_id" },
      ),
    );
  }

  if (state.weights.length) {
    tasks.push(
      db.from("weights").upsert(
        state.weights.map((w) => ({
          device_id: deviceId,
          ...userStamp,
          date: w.date,
          weight_kg: w.weightKg,
        })),
        { onConflict: "device_id,date" },
      ),
    );
  }

  const days = Object.values(state.days);
  if (days.length) {
    tasks.push(
      db.from("daily_metrics").upsert(
        days.map((d) => ({
          device_id: deviceId,
          ...userStamp,
          date: d.date,
          water_ml: d.waterMl,
          meals: d.meals,
        })),
        { onConflict: "device_id,date" },
      ),
    );
  }

  const supplementDays = Object.entries(state.supplementLogs);
  if (supplementDays.length) {
    tasks.push(
      db.from("supplement_logs").upsert(
        supplementDays.map(([date, ids]) => ({
          device_id: deviceId,
          ...userStamp,
          date,
          supplement_ids: ids,
        })),
        { onConflict: "device_id,date" },
      ),
    );
  }

  if (state.meals?.length) {
    tasks.push(
      db.from("meal_entries").upsert(
        state.meals.map((m) => ({
          device_id: deviceId,
          client_id: m.id,
          user_id: userId,
          date: m.date.slice(0, 10),
          name: m.label,
          meal_type: m.slot,
          protein_g: m.proteinG,
          kcal: m.kcal,
          payload: {
            slot: m.slot,
            label: m.label,
            quality: m.quality,
            presetId: m.presetId,
            servings: m.servings,
            proteinG: m.proteinG,
            kcal: m.kcal,
          },
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "device_id,client_id" },
      ),
    );
  }

  const results = await Promise.all(tasks.map((t) => Promise.resolve(t).catch((e: unknown) => ({ error: e }))));
  for (const r of results) {
    const error = (r as { error?: unknown } | null)?.error;
    if (error) console.error("pushStateServer failed", error);
  }

  // Best-effort: persist rpe into session row via update if column exists (ignore errors)
  for (const s of state.sessions) {
    if (s.rpe == null && !s.express) continue;
    try {
      await db
        .from("sessions")
        .update({
          ...(s.rpe != null ? { rpe: s.rpe } : {}),
          ...(s.express ? { express: true } : {}),
        } as never)
        .eq("device_id", deviceId)
        .eq("client_id", s.id);
    } catch {
      /* columns may not exist — rpe also in retention via dayCheckIns path */
    }
  }

  return { ok: true, userId };
}

export async function clearRemoteStateServer(deviceId: string): Promise<{ ok: boolean }> {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess: false });
  if (!identity) return { ok: false };
  const db = await adminDbLoose();
  if (!db) return { ok: false };

  // Only clear rows for this device owned by trusted user
  const tables = [
    "sessions",
    "weights",
    "daily_metrics",
    "supplement_logs",
    "app_state",
    "profiles",
    "meal_entries",
  ] as const;
  await Promise.all(
    tables.map((t) => db.from(t).delete().eq("device_id", deviceId).eq("user_id", identity.userId)),
  );
  return { ok: true };
}
