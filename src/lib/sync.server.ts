/**
 * Server-side sync via service_role. Resolves user_id from devices — never trusts client userId.
 */
import { adminDbLoose } from "@/lib/db-admin";
import { resolveTrustedIdentity } from "@/lib/session-identity.server";
import { nextVersion, shouldAcceptWrite } from "@/lib/sync/conflict";
import { dayCheckInToRow, mergeDayCheckIns, rowToDayCheckIn } from "@/lib/sync/day-checkin";
import {
  type AppState,
  type ChatMessage,
  type DayCheckIn,
  type DoseFrequency,
  type DoseSource,
  type DoseUnit,
  type Equipment,
  type ExerciseLog,
  type Goal,
  type FocusMuscle,
  type GymGear,
  type Level,
  type MealEntry,
  type NutritionProfile,
  type PrimaryBlocker,
  type LivingPlanFeedback,
  type Profile,
  type ProgressPhotoEntry,
  type SessionRpe,
  type SupplementDoseLog,
} from "@/lib/types";
import { mapMealEntryRow, mealEntryToDbPayload, mealItemsToRows } from "@/lib/sync/meal-map";
import {
  mapMeasurementRow,
  mapPhotoRow,
  measurementToRow,
  mergeMeasurementsByDate,
  mergeProgressPhotos,
} from "@/lib/progress/body";
import { normalizeSocialPrivacy } from "@/lib/social/visibility";

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
      challengePersonalTargets: {},
      activityLogs: [],
      joinedHubIds: [],
      dayCheckIns: {},
      supplementDoseLogs: [],
      supplementFrequencies: {},
      earnedBadges: [],
      livingPlanFeedback: {},
      challengeInvitesSent: 0,
      coachNudgeDismissedAt: null,
      coachNudgeShownAt: null,
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
    lastPurchaseAt: typeof r["lastPurchaseAt"] === "string" ? r["lastPurchaseAt"] : null,
    accessExpiresAt: typeof r["accessExpiresAt"] === "string" ? r["accessExpiresAt"] : null,
    shopifyDisplayName:
      typeof r["shopifyDisplayName"] === "string" ? r["shopifyDisplayName"] : null,
    accessTier: r["accessTier"] === "performance" ? "performance" : "base",
    purchaseProductIds: Array.isArray(r["purchaseProductIds"])
      ? (r["purchaseProductIds"] as string[])
      : [],
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
    challengePersonalTargets:
      r["challengePersonalTargets"] && typeof r["challengePersonalTargets"] === "object"
        ? (r["challengePersonalTargets"] as Record<string, number>)
        : {},
    activityLogs: Array.isArray(r["activityLogs"])
      ? (r["activityLogs"] as AppState["activityLogs"])
      : [],
    joinedHubIds: Array.isArray(r["joinedHubIds"]) ? (r["joinedHubIds"] as string[]) : [],
    dayCheckIns:
      r["dayCheckIns"] && typeof r["dayCheckIns"] === "object"
        ? (r["dayCheckIns"] as Record<string, DayCheckIn>)
        : {},
    supplementDoseLogs: Array.isArray(r["supplementDoseLogs"])
      ? (r["supplementDoseLogs"] as SupplementDoseLog[])
      : [],
    supplementFrequencies:
      r["supplementFrequencies"] && typeof r["supplementFrequencies"] === "object"
        ? (r["supplementFrequencies"] as Record<string, DoseFrequency>)
        : {},
    likedExerciseIds: Array.isArray(r["likedExerciseIds"])
      ? (r["likedExerciseIds"] as string[])
      : [],
    dislikedExerciseIds: Array.isArray(r["dislikedExerciseIds"])
      ? (r["dislikedExerciseIds"] as string[])
      : [],
    exercisePreferences:
      r["exercisePreferences"] && typeof r["exercisePreferences"] === "object"
        ? (r["exercisePreferences"] as AppState["exercisePreferences"])
        : {},
    reminderHour: typeof r["reminderHour"] === "number" ? r["reminderHour"] : 18,
    ...(r["pushPrefs"] && typeof r["pushPrefs"] === "object"
      ? { pushPrefs: r["pushPrefs"] as AppState["pushPrefs"] }
      : {}),
    termsAcceptedAt: typeof r["termsAcceptedAt"] === "string" ? r["termsAcceptedAt"] : null,
    privacyAcceptedAt: typeof r["privacyAcceptedAt"] === "string" ? r["privacyAcceptedAt"] : null,
    healthPurposeAckAt:
      typeof r["healthPurposeAckAt"] === "string" ? r["healthPurposeAckAt"] : null,
    remindersEnabled: r["remindersEnabled"] === true,
    earnedBadges: Array.isArray(r["earnedBadges"]) ? (r["earnedBadges"] as string[]) : [],
    socialPrivacy: normalizeSocialPrivacy(r["socialPrivacy"], true),
    livingPlanFeedback:
      r["livingPlanFeedback"] && typeof r["livingPlanFeedback"] === "object"
        ? (r["livingPlanFeedback"] as Record<string, LivingPlanFeedback>)
        : {},
    challengeInvitesSent:
      typeof r["challengeInvitesSent"] === "number" ? r["challengeInvitesSent"] : 0,
    coachNudgeDismissedAt:
      typeof r["coachNudgeDismissedAt"] === "string" ? r["coachNudgeDismissedAt"] : null,
    coachNudgeShownAt: typeof r["coachNudgeShownAt"] === "string" ? r["coachNudgeShownAt"] : null,
    favoriteMealPresetIds: Array.isArray(r["favoriteMealPresetIds"])
      ? (r["favoriteMealPresetIds"] as string[])
      : [],
    savedMeals: Array.isArray(r["savedMeals"]) ? (r["savedMeals"] as AppState["savedMeals"]) : [],
    wearableConnections: Array.isArray(r["wearableConnections"])
      ? (r["wearableConnections"] as AppState["wearableConnections"])
      : [],
    lastFraudWarning: typeof r["lastFraudWarning"] === "string" ? r["lastFraudWarning"] : null,
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
    lastPurchaseAt: state.lastPurchaseAt ?? null,
    accessExpiresAt: state.accessExpiresAt ?? null,
    shopifyDisplayName: state.shopifyDisplayName ?? null,
    accessTier: state.accessTier ?? "base",
    purchaseProductIds: state.purchaseProductIds ?? [],
    restockEstimates: state.restockEstimates ?? {},
    routineFromPurchase: state.routineFromPurchase === true,
    routineFromPurchaseDismissed: state.routineFromPurchaseDismissed === true,
    upsellShownDate: state.upsellShownDate ?? null,
    challengeBaselines: state.challengeBaselines ?? {},
    challengePersonalTargets: state.challengePersonalTargets ?? {},
    activityLogs: state.activityLogs ?? [],
    joinedHubIds: state.joinedHubIds ?? [],
    dayCheckIns: state.dayCheckIns ?? {},
    supplementDoseLogs: state.supplementDoseLogs ?? [],
    supplementFrequencies: state.supplementFrequencies ?? {},
    likedExerciseIds: state.likedExerciseIds ?? [],
    dislikedExerciseIds: state.dislikedExerciseIds ?? [],
    exercisePreferences: state.exercisePreferences ?? {},
    earnedBadges: state.earnedBadges ?? [],
    livingPlanFeedback: state.livingPlanFeedback ?? {},
    challengeInvitesSent: state.challengeInvitesSent ?? 0,
    coachNudgeDismissedAt: state.coachNudgeDismissedAt ?? null,
    coachNudgeShownAt: state.coachNudgeShownAt ?? null,
    reminderHour: state.reminderHour ?? 18,
    remindersEnabled: state.remindersEnabled === true,
    pushPrefs: state.pushPrefs ?? { workout: true, streak: true, challenge: true, kudos: true },
    termsAcceptedAt: state.termsAcceptedAt ?? null,
    privacyAcceptedAt: state.privacyAcceptedAt ?? null,
    healthPurposeAckAt: state.healthPurposeAckAt ?? null,
    socialPrivacy: state.socialPrivacy,
    favoriteMealPresetIds: state.favoriteMealPresetIds ?? [],
    savedMeals: state.savedMeals ?? [],
    wearableConnections: state.wearableConnections ?? [],
    lastFraudWarning: state.lastFraudWarning ?? null,
  };
}

type Row = Record<string, unknown>;

function mapMeals(rows: Row[]): MealEntry[] {
  return rows.map(mapMealEntryRow);
}

function mapDoseLogs(rows: Row[]): SupplementDoseLog[] {
  return rows.map((row) => ({
    id: String(row["client_id"] || row["id"] || crypto.randomUUID()),
    productId: String(row["product_id"] ?? ""),
    dose: Number(row["dose"] ?? 1),
    unit: (row["unit"] as DoseUnit) || "serving",
    frequency: (row["frequency"] as DoseFrequency) || "1x_day",
    takenAt: String(row["taken_at"] ?? new Date().toISOString()),
    source: (row["source"] as DoseSource) || "manual",
    version: typeof row["version"] === "number" ? row["version"] : 1,
  }));
}

function profilePrefsFromRow(
  prefs: unknown,
): Partial<
  Pick<
    Profile,
    | "skipBreakfast"
    | "lunchOutOften"
    | "typicalSleepHours"
    | "primaryBlocker"
    | "nutritionProfile"
    | "trainingWeekdays"
    | "focusMuscles"
    | "equipmentInventory"
    | "typicalSessionMin"
    | "onboardingComplete"
  >
> {
  if (!prefs || typeof prefs !== "object") return {};
  const p = prefs as Record<string, unknown>;
  const out: ReturnType<typeof profilePrefsFromRow> = {};
  if (p["skipBreakfast"] === true) out.skipBreakfast = true;
  if (p["lunchOutOften"] === true) out.lunchOutOften = true;
  if (typeof p["typicalSleepHours"] === "number") out.typicalSleepHours = p["typicalSleepHours"];
  if (typeof p["primaryBlocker"] === "string")
    out.primaryBlocker = p["primaryBlocker"] as PrimaryBlocker;
  if (p["nutritionProfile"] && typeof p["nutritionProfile"] === "object") {
    out.nutritionProfile = p["nutritionProfile"] as NutritionProfile;
  }
  if (Array.isArray(p["trainingWeekdays"]))
    out.trainingWeekdays = p["trainingWeekdays"] as number[];
  if (Array.isArray(p["focusMuscles"])) {
    out.focusMuscles = p["focusMuscles"] as FocusMuscle[];
  }
  if (Array.isArray(p["equipmentInventory"])) {
    out.equipmentInventory = p["equipmentInventory"] as GymGear[];
  }
  if (typeof p["typicalSessionMin"] === "number") out.typicalSessionMin = p["typicalSessionMin"];
  if (p["onboardingComplete"] === true || p["onboardingComplete"] === false) {
    out.onboardingComplete = p["onboardingComplete"] === true;
  }
  return out;
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

async function pullForUserId(
  userId: string,
  fallbackDeviceIds: string[],
): Promise<AppState | null> {
  const db = await adminDbLoose();
  if (!db || !userId) return null;

  const [
    profileRes,
    sessionsRes,
    weightsRes,
    daysRes,
    supplementsRes,
    stateRes,
    mealsRes,
    checkInsRes,
    doseRes,
    measurementsRes,
    photosRes,
  ] = await Promise.all([
    db.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    db.from("sessions").select("*").eq("user_id", userId).order("date", { ascending: false }),
    db.from("weights").select("*").eq("user_id", userId).order("date", { ascending: true }),
    db.from("daily_metrics").select("*").eq("user_id", userId),
    db.from("supplement_logs").select("*").eq("user_id", userId),
    db.from("app_state").select("*").eq("user_id", userId).maybeSingle(),
    db.from("meal_entries").select("*").eq("user_id", userId).order("date", { ascending: true }),
    db.from("day_checkins").select("*").eq("user_id", userId).order("date", { ascending: false }),
    db
      .from("supplement_dose_logs")
      .select("*")
      .eq("user_id", userId)
      .order("taken_at", { ascending: true }),
    db
      .from("body_measurements")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: true }),
    db
      .from("progress_photos")
      .select("*")
      .eq("user_id", userId)
      .order("taken_on", { ascending: true }),
  ]);

  // day_checkins / dose logs may be missing before migration — ignore table errors
  const checkInRows =
    checkInsRes && !("error" in checkInsRes && checkInsRes.error)
      ? ((checkInsRes.data ?? []) as Row[])
      : [];
  const doseRows =
    doseRes && !("error" in doseRes && doseRes.error) ? ((doseRes.data ?? []) as Row[]) : [];
  const measurementRows =
    measurementsRes && !("error" in measurementsRes && measurementsRes.error)
      ? ((measurementsRes.data ?? []) as Row[])
      : [];
  const photoRows =
    photosRes && !("error" in photosRes && photosRes.error)
      ? ((photosRes.data ?? []) as Row[])
      : [];

  const hasUserRows =
    profileRes.data ||
    (sessionsRes.data?.length ?? 0) > 0 ||
    (weightsRes.data?.length ?? 0) > 0 ||
    (daysRes.data?.length ?? 0) > 0 ||
    (supplementsRes.data?.length ?? 0) > 0 ||
    stateRes.data ||
    (mealsRes.data?.length ?? 0) > 0 ||
    checkInRows.length > 0 ||
    doseRows.length > 0 ||
    measurementRows.length > 0 ||
    photoRows.length > 0;

  if (hasUserRows) {
    return assembleStateFromRows({
      profiles: profileRes.data ? [profileRes.data as Row] : [],
      sessions: (sessionsRes.data ?? []) as Row[],
      weights: (weightsRes.data ?? []) as Row[],
      days: (daysRes.data ?? []) as Row[],
      supplements: (supplementsRes.data ?? []) as Row[],
      states: stateRes.data ? [stateRes.data as Row] : [],
      meals: (mealsRes.data ?? []) as Row[],
      dayCheckIns: checkInRows,
      doseLogs: doseRows,
      measurements: measurementRows,
      progressPhotos: photoRows,
    });
  }

  // Legacy fallback: merge device-scoped rows then stamp will happen on next push
  if (fallbackDeviceIds.length) {
    return pullForDeviceIds(fallbackDeviceIds);
  }
  return null;
}

function assembleStateFromRows(opts: {
  profiles: Row[];
  sessions: Row[];
  weights: Row[];
  days: Row[];
  supplements: Row[];
  states: Row[];
  meals: Row[];
  dayCheckIns?: Row[];
  doseLogs?: Row[];
  measurements?: Row[];
  progressPhotos?: Row[];
}): AppState | null {
  const {
    profiles,
    sessions,
    weights,
    days,
    supplements,
    states,
    meals,
    dayCheckIns = [],
    doseLogs = [],
    measurements = [],
    progressPhotos = [],
  } = opts;
  const hasAnything =
    profiles.length > 0 ||
    sessions.length > 0 ||
    weights.length > 0 ||
    days.length > 0 ||
    supplements.length > 0 ||
    states.length > 0 ||
    meals.length > 0 ||
    dayCheckIns.length > 0 ||
    doseLogs.length > 0 ||
    measurements.length > 0 ||
    progressPhotos.length > 0;
  if (!hasAnything) return null;

  const stateRow = [...states].sort((a, b) =>
    String(b["updated_at"] ?? "").localeCompare(String(a["updated_at"] ?? "")),
  )[0];
  const p = profiles[0];
  const prefs = profilePrefsFromRow(p?.["prefs"]);

  const sessionById = new Map<string, Row>();
  for (const s of sessions) {
    const cid = String(s["client_id"]);
    const prev = sessionById.get(cid);
    if (!prev || String(s["date"]) >= String(prev["date"])) sessionById.set(cid, s);
  }
  const weightByDate = new Map<string, Row>();
  for (const w of weights) weightByDate.set(String(w["date"]), w);
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
  const tableCheckIns = dayCheckIns.map((r) => rowToDayCheckIn(r));
  const mergedCheckIns = mergeDayCheckIns(retention.dayCheckIns ?? {}, tableCheckIns);
  const fromTableDoses = mapDoseLogs(doseLogs);
  const doseFromRetention = retention.supplementDoseLogs ?? [];
  const doseById = new Map<string, SupplementDoseLog>();
  for (const d of doseFromRetention) doseById.set(d.id, d);
  for (const d of fromTableDoses) doseById.set(d.id, d);

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
          ...prefs,
          version: typeof p["version"] === "number" ? p["version"] : undefined,
        }
      : null,
    sessions: mapSessions([...sessionById.values()]),
    weights: [...weightByDate.values()].map((w) => ({
      date: String(w["date"]),
      weightKg: Number(w["weight_kg"]),
    })),
    measurements: mergeMeasurementsByDate(
      measurements.map(mapMeasurementRow).filter((x): x is NonNullable<typeof x> => Boolean(x)),
    ),
    progressPhotos: mergeProgressPhotos(
      progressPhotos.map(mapPhotoRow).filter((x): x is ProgressPhotoEntry => Boolean(x)),
    ),
    days: Object.fromEntries(
      [...dayByDate.values()].map((d) => [
        String(d["date"]),
        { date: String(d["date"]), waterMl: Number(d["water_ml"]), meals: Number(d["meals"]) },
      ]),
    ),
    supplementLogs: Object.fromEntries(
      [...suppByDate.values()].map((s) => [
        String(s["date"]),
        (s["supplement_ids"] as string[]) ?? [],
      ]),
    ),
    supplementRoutine: (stateRow?.["supplement_routine"] as string[]) ?? [],
    challenges: (stateRow?.["challenges"] as string[]) ?? [],
    chat: (stateRow?.["chat"] as unknown as ChatMessage[]) ?? [],
    theme: "dark",
    dimensionSnapshots: [],
    earnedBadges: [],
    meals: mapMeals([...mealByClient.values()]),
    shareProgress: true,
    socialPrivacy: normalizeSocialPrivacy(undefined, true),
    sessionFx: true,
    favoriteMealPresetIds: retention.favoriteMealPresetIds ?? [],
    savedMeals: retention.savedMeals ?? [],
    remindersEnabled: false,
    reminderHour: 18,
    seenOnboardingTips: [],
    ...retention,
    dayCheckIns: mergedCheckIns,
    supplementDoseLogs: [...doseById.values()],
    supplementFrequencies: retention.supplementFrequencies ?? {},
  } as AppState;
}

async function pullForDeviceIds(deviceIds: string[]): Promise<AppState | null> {
  const db = await adminDbLoose();
  if (!db || !deviceIds.length) return null;

  const [profileRes, sessionsRes, weightsRes, daysRes, supplementsRes, stateRes, mealsRes] =
    await Promise.all([
      db
        .from("profiles")
        .select("*")
        .in("device_id", deviceIds)
        .order("updated_at", { ascending: false })
        .limit(1),
      db
        .from("sessions")
        .select("*")
        .in("device_id", deviceIds)
        .order("date", { ascending: false }),
      db.from("weights").select("*").in("device_id", deviceIds).order("date", { ascending: true }),
      db.from("daily_metrics").select("*").in("device_id", deviceIds),
      db.from("supplement_logs").select("*").in("device_id", deviceIds),
      db.from("app_state").select("*").in("device_id", deviceIds),
      db
        .from("meal_entries")
        .select("*")
        .in("device_id", deviceIds)
        .order("date", { ascending: true }),
    ]);

  return assembleStateFromRows({
    profiles: (profileRes.data ?? []) as Row[],
    sessions: (sessionsRes.data ?? []) as Row[],
    weights: (weightsRes.data ?? []) as Row[],
    days: (daysRes.data ?? []) as Row[],
    supplements: (supplementsRes.data ?? []) as Row[],
    states: (stateRes.data ?? []) as Row[],
    meals: (mealsRes.data ?? []) as Row[],
  });
}

/** Pull by user_id (primary); fallback merge legacy device rows. */
export async function pullStateServer(deviceId: string): Promise<{
  state: AppState | null;
  userId: string | null;
}> {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccessIfLinked: true });
  if (!identity) {
    const { ensureUserForDevice } = await import("@/lib/identity");
    const user = await ensureUserForDevice(deviceId);
    if (!user) return { state: null, userId: null };
    // Linked users without cookie are refused by resolveTrustedIdentity above.
    // ensureUserForDevice only for anonymous bootstrap.
    if (user.email) return { state: null, userId: null };
    const state = await pullForUserId(user.id, [deviceId]);
    if (state) state.userId = user.id;
    return { state, userId: user.id };
  }

  const { listDeviceIdsForUser } = await import("@/lib/identity");
  const deviceIds = await listDeviceIdsForUser(identity.userId);
  const ids = deviceIds.length ? deviceIds : [deviceId];
  const state = await pullForUserId(identity.userId, ids);
  if (state) state.userId = identity.userId;
  return { state, userId: identity.userId };
}

export async function pushStateServer(
  deviceId: string,
  state: AppState,
): Promise<{
  ok: boolean;
  partial?: boolean;
  userId: string | null;
  conflicts?: string[];
  errors?: Array<{ table: string; code: string }>;
}> {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true });
  if (!identity) return { ok: false, userId: null };

  const db = await adminDbLoose();
  if (!db) return { ok: false, userId: identity.userId };

  const userId = identity.userId;
  const channel = { user_id: userId, device_id: deviceId };
  const tasks: Array<PromiseLike<unknown>> = [];
  const conflicts: string[] = [];

  if (state.profile) {
    const { data: remoteProfile } = await db
      .from("profiles")
      .select("version, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    const incomingVersion = Number((state.profile as { version?: number }).version ?? 1);
    if (
      shouldAcceptWrite(remoteProfile as { version?: number; updated_at?: string } | null, {
        version: incomingVersion,
        clientUpdatedAt: new Date().toISOString(),
      })
    ) {
      tasks.push(
        db.from("profiles").upsert(
          {
            ...channel,
            name: state.profile.name,
            goal: state.profile.goal,
            level: state.profile.level,
            days_per_week: state.profile.daysPerWeek,
            age: state.profile.age,
            height_cm: state.profile.heightCm,
            weight_kg: state.profile.weightKg,
            equipment: state.profile.equipment,
            restrictions: state.profile.restrictions,
            prefs: {
              skipBreakfast: state.profile.skipBreakfast === true,
              lunchOutOften: state.profile.lunchOutOften === true,
              typicalSleepHours: state.profile.typicalSleepHours,
              primaryBlocker: state.profile.primaryBlocker,
              nutritionProfile: state.profile.nutritionProfile,
              trainingWeekdays: state.profile.trainingWeekdays,
              focusMuscles: state.profile.focusMuscles,
              equipmentInventory: state.profile.equipmentInventory,
              typicalSessionMin: state.profile.typicalSessionMin,
              onboardingComplete: state.profile.onboardingComplete === true,
            },
            version: nextVersion((remoteProfile as { version?: number } | null)?.version),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        ),
      );
    } else {
      conflicts.push("profile");
    }
  }

  tasks.push(
    (async () => {
      const { data: remoteApp } = await db
        .from("app_state")
        .select("version, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      const remoteVer = Number((remoteApp as { version?: number } | null)?.version ?? 0);
      const localVer = Number((state as { appStateVersion?: number }).appStateVersion ?? 1);
      if (
        remoteApp &&
        !shouldAcceptWrite(
          {
            version: remoteVer,
            updated_at: String((remoteApp as { updated_at?: string }).updated_at ?? ""),
          },
          { version: localVer, clientUpdatedAt: new Date().toISOString() },
        )
      ) {
        conflicts.push("app_state");
        return { error: null };
      }
      return db.from("app_state").upsert(
        {
          ...channel,
          supplement_routine: state.supplementRoutine,
          challenges: state.challenges,
          chat: state.chat as unknown as never,
          retention: { ...retentionPayload(state), userId },
          version: nextVersion(remoteVer),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    })(),
  );

  if (state.sessions.length) {
    const { data: remoteSessions } = await db
      .from("sessions")
      .select("client_id, version, updated_at")
      .eq("user_id", userId);
    const remoteById = new Map(
      ((remoteSessions ?? []) as Row[]).map((r) => [String(r["client_id"]), r]),
    );
    const accepted = state.sessions.filter((s) => {
      const remote = remoteById.get(s.id);
      const ok = shouldAcceptWrite(
        remote as { version?: number; updated_at?: string } | undefined,
        {
          version: Number((s as { version?: number }).version ?? 1),
          clientUpdatedAt: new Date().toISOString(),
        },
      );
      if (!ok) conflicts.push(`session:${s.id}`);
      return ok;
    });
    if (accepted.length) {
      tasks.push(
        db.from("sessions").upsert(
          accepted.map((s) => {
            const remote = remoteById.get(s.id);
            return {
              ...channel,
              client_id: s.id,
              day_id: s.dayId,
              title: s.title,
              date: s.date,
              duration_min: s.durationMin,
              exercises: s.exercises as unknown as never,
              volume_kg: s.volumeKg,
              version: nextVersion((remote as { version?: number } | undefined)?.version),
              updated_at: new Date().toISOString(),
              ...(s.rpe != null ? { rpe: s.rpe } : {}),
              ...(s.express ? { express: true } : {}),
            };
          }),
          { onConflict: "user_id,client_id" },
        ),
      );
    }
  }

  if (state.weights.length) {
    tasks.push(
      db.from("weights").upsert(
        state.weights.map((w) => ({
          ...channel,
          date: w.date,
          weight_kg: w.weightKg,
        })),
        { onConflict: "user_id,date" },
      ),
    );
  }

  if ((state.measurements ?? []).length) {
    const measProbe = await db
      .from("body_measurements")
      .select("date")
      .eq("user_id", userId)
      .limit(1);
    if (!measProbe.error) {
      tasks.push(
        db.from("body_measurements").upsert(
          state.measurements.map((m) => ({
            ...channel,
            ...measurementToRow(m),
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "user_id,date" },
        ),
      );
    }
  }

  if ((state.progressPhotos ?? []).length) {
    const photoProbe = await db.from("progress_photos").select("id").eq("user_id", userId).limit(1);
    if (!photoProbe.error) {
      tasks.push(
        db.from("progress_photos").upsert(
          state.progressPhotos.map((p) => ({
            ...channel,
            id: p.id,
            taken_on: p.takenOn,
            pose: p.pose,
            storage_path: p.storagePath,
            visibility: p.visibility,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "user_id,taken_on,pose" },
        ),
      );
    }
  }

  const days = Object.values(state.days);
  if (days.length) {
    tasks.push(
      db.from("daily_metrics").upsert(
        days.map((d) => ({
          ...channel,
          date: d.date,
          water_ml: d.waterMl,
          meals: d.meals,
        })),
        { onConflict: "user_id,date" },
      ),
    );
  }

  const supplementDays = Object.entries(state.supplementLogs);
  if (supplementDays.length) {
    tasks.push(
      db.from("supplement_logs").upsert(
        supplementDays.map(([date, ids]) => ({
          ...channel,
          date,
          supplement_ids: ids,
        })),
        { onConflict: "user_id,date" },
      ),
    );
  }

  if (state.meals?.length) {
    const { data: remoteMeals } = await db
      .from("meal_entries")
      .select("client_id, version, updated_at")
      .eq("user_id", userId);
    const remoteById = new Map(
      ((remoteMeals ?? []) as Row[]).map((r) => [String(r["client_id"]), r]),
    );
    const accepted = state.meals.filter((m) => {
      const remote = remoteById.get(m.id);
      const ok = shouldAcceptWrite(
        remote as { version?: number; updated_at?: string } | undefined,
        {
          version: Number((m as { version?: number }).version ?? 1),
          clientUpdatedAt: new Date().toISOString(),
        },
      );
      if (!ok) conflicts.push(`meal:${m.id}`);
      return ok;
    });
    if (accepted.length) {
      tasks.push(
        db.from("meal_entries").upsert(
          accepted.map((m) => {
            const remote = remoteById.get(m.id);
            return {
              ...channel,
              client_id: m.id,
              date: m.date.slice(0, 10),
              name: m.label,
              meal_type: m.slot,
              protein_g: m.proteinG,
              carbs_g: m.carbG ?? null,
              fat_g: m.fatG ?? null,
              fiber_g: m.fiberG ?? null,
              kcal: m.kcal,
              payload: mealEntryToDbPayload(m),
              version: nextVersion((remote as { version?: number } | undefined)?.version),
              updated_at: new Date().toISOString(),
            };
          }),
          { onConflict: "user_id,client_id" },
        ),
      );
      const itemRows = mealItemsToRows(accepted, channel);
      if (itemRows.length) {
        tasks.push(db.from("meal_items").upsert(itemRows, { onConflict: "user_id,client_id" }));
      }
    }
  }

  // FASE 7 — dose logs (consumption)
  const doses = state.supplementDoseLogs ?? [];
  if (doses.length) {
    const doseQuery = await db
      .from("supplement_dose_logs")
      .select("client_id, version, updated_at")
      .eq("user_id", userId);
    if (!doseQuery.error) {
      const remoteById = new Map(
        ((doseQuery.data ?? []) as Row[]).map((r) => [String(r["client_id"]), r]),
      );
      const accepted = doses.filter((d) => {
        const remote = remoteById.get(d.id);
        const ok = shouldAcceptWrite(
          remote as { version?: number; updated_at?: string } | undefined,
          {
            version: Number(d.version ?? 1),
            clientUpdatedAt: new Date().toISOString(),
          },
        );
        if (!ok) conflicts.push(`dose:${d.id}`);
        return ok;
      });
      if (accepted.length) {
        tasks.push(
          db.from("supplement_dose_logs").upsert(
            accepted.map((d) => {
              const remote = remoteById.get(d.id);
              return {
                ...channel,
                client_id: d.id,
                product_id: d.productId,
                dose: d.dose,
                unit: d.unit,
                frequency: d.frequency,
                taken_at: d.takenAt,
                source: d.source,
                version: nextVersion((remote as { version?: number } | undefined)?.version),
                updated_at: new Date().toISOString(),
              };
            }),
            { onConflict: "user_id,client_id" },
          ),
        );
      }
    }
  }

  // Dual-write structured day_checkins
  const checkIns = Object.values(state.dayCheckIns ?? {});
  if (checkIns.length) {
    const { data: remoteChecks } = await db
      .from("day_checkins")
      .select("date, version, updated_at")
      .eq("user_id", userId);
    const remoteByDate = new Map(
      ((remoteChecks ?? []) as Row[]).map((r) => [String(r["date"]).slice(0, 10), r]),
    );
    const accepted = checkIns.filter((c) => {
      const remote = remoteByDate.get(c.date.slice(0, 10));
      const ok = shouldAcceptWrite(
        remote as { version?: number; updated_at?: string } | undefined,
        {
          version: Number(c.version ?? 1),
          clientUpdatedAt: new Date().toISOString(),
        },
      );
      if (!ok) conflicts.push(`day_checkin:${c.date}`);
      return ok;
    });
    if (accepted.length) {
      tasks.push(
        db.from("day_checkins").upsert(
          accepted.map((c) => {
            const remote = remoteByDate.get(c.date.slice(0, 10));
            return dayCheckInToRow(
              c,
              channel,
              nextVersion((remote as { version?: number } | undefined)?.version),
            );
          }),
          { onConflict: "user_id,date" },
        ),
      );
    }
  }

  const results = await Promise.all(
    tasks.map(async (t) => {
      try {
        const r = (await t) as { error?: { message?: string; code?: string } | null };
        return r;
      } catch (e) {
        return { error: e as { message?: string; code?: string } };
      }
    }),
  );

  const { logSyncOp } = await import("@/lib/engine/observability");
  const errors: Array<{ table: string; code: string }> = [];
  let criticalFailed = false;

  for (const r of results) {
    const error = r?.error;
    if (!error) continue;
    const code = String(error.code ?? "write_failed");
    criticalFailed = true;
    errors.push({ table: "domain", code });
    logSyncOp({
      userId,
      operation: "push",
      table: "domain",
      status: "error",
      errorCode: code,
    });
  }

  for (const s of state.sessions) {
    if (s.rpe == null && !s.express) continue;
    try {
      const { error } = await db
        .from("sessions")
        .update({
          ...(s.rpe != null ? { rpe: s.rpe } : {}),
          ...(s.express ? { express: true } : {}),
        } as never)
        .eq("user_id", userId)
        .eq("client_id", s.id);
      if (error) {
        errors.push({ table: "sessions", code: String(error.code ?? "update_failed") });
        // RPE enrichment is non-critical
        logSyncOp({
          userId,
          operation: "push_rpe",
          table: "sessions",
          status: "error",
          errorCode: String(error.code ?? "update_failed"),
        });
      }
    } catch {
      /* ignore non-critical */
    }
  }

  if (criticalFailed) {
    return {
      ok: false,
      partial: errors.length < results.length,
      userId,
      errors,
      ...(conflicts.length ? { conflicts } : {}),
    };
  }

  try {
    const { recomputeTrainingDerived } = await import("@/lib/training/recompute.server");
    await recomputeTrainingDerived(userId, state);
  } catch {
    /* derived tables are non-critical */
  }

  return {
    ok: true,
    userId,
    ...(conflicts.length ? { conflicts } : {}),
    ...(errors.length ? { partial: true, errors } : {}),
  };
}

/** Granular day check-in upsert with version conflict. */
export async function upsertDayCheckInServer(
  deviceId: string,
  checkIn: DayCheckIn,
  incomingVersion = 1,
): Promise<{ ok: boolean; conflict?: boolean; remote?: DayCheckIn; userId: string | null }> {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true });
  if (!identity) return { ok: false, userId: null };

  const db = await adminDbLoose();
  if (!db) return { ok: false, userId: identity.userId };

  const userId = identity.userId;
  const date = checkIn.date.slice(0, 10);
  const { data: remoteRow } = await db
    .from("day_checkins")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  const remote = remoteRow as Row | null;
  if (
    remote &&
    !shouldAcceptWrite(
      { version: Number(remote["version"] ?? 0), updated_at: String(remote["updated_at"] ?? "") },
      { version: incomingVersion, clientUpdatedAt: new Date().toISOString() },
    )
  ) {
    return {
      ok: false,
      conflict: true,
      remote: rowToDayCheckIn(remote),
      userId,
    };
  }

  const version = nextVersion(remote ? Number(remote["version"] ?? 0) : 0);
  const row = dayCheckInToRow(checkIn, { user_id: userId, device_id: deviceId }, version);
  const { error } = await db.from("day_checkins").upsert(row, { onConflict: "user_id,date" });
  if (error) {
    console.error("upsertDayCheckInServer failed", error);
    return { ok: false, userId };
  }
  return { ok: true, userId };
}

/**
 * Clear local-only: UI "Apagar dados neste aparelho" should call client clear,
 * not this. Kept for backward compat as a thin alias that does NOT wipe server.
 * Prefer clearUserDataServer for explicit account wipe.
 */
export async function clearRemoteStateServer(deviceId: string): Promise<{
  ok: boolean;
  mode: "noop_use_clearUserData";
}> {
  // Do not silently wipe partial server data under a "local device" label.
  void deviceId;
  return { ok: true, mode: "noop_use_clearUserData" };
}

/** Core + analytics domain tables owned by user_id (never Shopify external). */
const CLEAR_USER_CORE_TABLES = [
  "sessions",
  "weights",
  "body_measurements",
  "progress_photos",
  "daily_metrics",
  "supplement_logs",
  "supplement_dose_logs",
  "app_state",
  "profiles",
  "meal_entries",
  "day_checkins",
  "customer_profiles",
  "decision_outcomes",
  "decision_actions",
  "recommendation_decisions",
  "user_patterns",
  "user_events",
  "push_subscriptions",
  "push_sends",
] as const;

/**
 * Explicit account data wipe (internal domain only — never Shopify orders/identities external).
 */
export async function clearUserDataServer(deviceId: string): Promise<{
  ok: boolean;
  partial?: boolean;
  errors?: Array<{ table: string; code: string }>;
  userId?: string | null;
}> {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true });
  if (!identity) return { ok: false, userId: null };
  const db = await adminDbLoose();
  if (!db) return { ok: false, userId: identity.userId };

  const { logSyncOp } = await import("@/lib/engine/observability");
  const errors: Array<{ table: string; code: string }> = [];

  try {
    const { removeProgressPhotosForUser } = await import("@/lib/progress/photos.server");
    await removeProgressPhotosForUser(identity.userId);
  } catch (e) {
    errors.push({
      table: "progress-photos",
      code: e instanceof Error ? e.message.slice(0, 40) : "storage_wipe",
    });
  }

  for (const table of CLEAR_USER_CORE_TABLES) {
    try {
      const { error } = await db.from(table).delete().eq("user_id", identity.userId);
      if (error) {
        // decision_outcomes / optional tables may not exist yet
        if (String(error.message ?? "").includes("does not exist")) continue;
        errors.push({ table, code: String(error.code ?? "delete_failed") });
        logSyncOp({
          userId: identity.userId,
          operation: "clearUserData",
          table,
          status: "error",
          errorCode: String(error.code ?? "delete_failed"),
        });
      } else {
        logSyncOp({
          userId: identity.userId,
          operation: "clearUserData",
          table,
          status: "ok",
        });
      }
    } catch (e) {
      errors.push({
        table,
        code: e instanceof Error ? e.message.slice(0, 40) : "exception",
      });
    }
  }

  if (errors.length === CLEAR_USER_CORE_TABLES.length) {
    return { ok: false, userId: identity.userId, errors };
  }
  if (errors.length) {
    return { ok: false, partial: true, userId: identity.userId, errors };
  }
  return { ok: true, userId: identity.userId };
}

/** LGPD export — profile, sessions, weights, meals, events, prefs. No Shopify PII dump. */
export async function exportUserDataServer(deviceId: string): Promise<{
  ok: boolean;
  json: string;
}> {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess: false });
  if (!identity) return { ok: false, json: "" };
  const db = await adminDbLoose();
  if (!db) return { ok: false, json: "" };

  const [profile, sessions, weights, meals, events, stateRow, measurements, photos] =
    await Promise.all([
      db.from("profiles").select("*").eq("user_id", identity.userId).maybeSingle(),
      db
        .from("sessions")
        .select("client_id, date, title, duration_min, volume_kg, rpe")
        .eq("user_id", identity.userId),
      db.from("weights").select("date, weight_kg").eq("user_id", identity.userId),
      db.from("meal_entries").select("client_id, date, slot, items").eq("user_id", identity.userId),
      db
        .from("user_events")
        .select("event_type, occurred_at, entity_type, entity_id, metadata")
        .eq("user_id", identity.userId)
        .order("occurred_at", { ascending: false })
        .limit(500),
      db.from("app_state").select("retention").eq("user_id", identity.userId).maybeSingle(),
      db
        .from("body_measurements")
        .select("date, waist_cm, arm_cm, chest_cm, hip_cm, thigh_cm")
        .eq("user_id", identity.userId),
      db
        .from("progress_photos")
        .select("taken_on, pose, visibility, storage_path")
        .eq("user_id", identity.userId),
    ]);

  const retention = (stateRow.data?.retention as Record<string, unknown> | null) ?? {};
  return {
    ok: true,
    json: JSON.stringify({
      exportedAt: new Date().toISOString(),
      userId: identity.userId,
      email: identity.email,
      profile: profile.data ?? null,
      sessions: sessions.data ?? [],
      weights: weights.data ?? [],
      measurements: measurements.error ? [] : (measurements.data ?? []),
      progressPhotos: photos.error
        ? []
        : (photos.data ?? []).map((p: Record<string, unknown>) => ({
            takenOn: p["taken_on"],
            pose: p["pose"],
            visibility: p["visibility"],
            storagePath: p["storage_path"],
          })),
      meals: meals.data ?? [],
      events: events.data ?? [],
      prefs: {
        reminderHour: retention["reminderHour"] ?? 18,
        pushPrefs: retention["pushPrefs"] ?? null,
        termsAcceptedAt: retention["termsAcceptedAt"] ?? null,
        privacyAcceptedAt: retention["privacyAcceptedAt"] ?? null,
        healthPurposeAckAt: retention["healthPurposeAckAt"] ?? null,
      },
    }),
  };
}
