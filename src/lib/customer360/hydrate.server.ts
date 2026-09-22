/**
 * Hydrate AppState from domain tables (service_role) for Customer 360 recompute.
 * Aligns with sync.server pull mappings — DB is source of truth for server recompute.
 */
import { adminDbLoose } from "@/lib/db-admin";
import {
  emptyState,
  type AppState,
  type ChatMessage,
  type DayCheckIn,
  type Equipment,
  type ExerciseLog,
  type Goal,
  type Level,
  type MealEntry,
  type SessionRpe,
} from "@/lib/types";
import { mapMealEntryRow } from "@/lib/sync/meal-map";
import { normalizeSocialPrivacy } from "@/lib/social/visibility";

type Row = Record<string, unknown>;

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
      lastPurchaseAt: null,
      accessExpiresAt: null,
      shopifyDisplayName: null,
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
      ? (r["supplementDoseLogs"] as import("@/lib/types").SupplementDoseLog[])
      : [],
    supplementFrequencies:
      r["supplementFrequencies"] && typeof r["supplementFrequencies"] === "object"
        ? (r["supplementFrequencies"] as Record<string, import("@/lib/types").DoseFrequency>)
        : {},
    earnedBadges: Array.isArray(r["earnedBadges"]) ? (r["earnedBadges"] as string[]) : [],
    socialPrivacy: normalizeSocialPrivacy(r["socialPrivacy"], r["shareProgress"] !== false),
    livingPlanFeedback:
      r["livingPlanFeedback"] && typeof r["livingPlanFeedback"] === "object"
        ? (r["livingPlanFeedback"] as AppState["livingPlanFeedback"])
        : {},
    challengeInvitesSent:
      typeof r["challengeInvitesSent"] === "number" ? r["challengeInvitesSent"] : 0,
    coachNudgeDismissedAt:
      typeof r["coachNudgeDismissedAt"] === "string" ? r["coachNudgeDismissedAt"] : null,
    coachNudgeShownAt: typeof r["coachNudgeShownAt"] === "string" ? r["coachNudgeShownAt"] : null,
    reminderHour: typeof r["reminderHour"] === "number" ? r["reminderHour"] : 18,
    ...(r["pushPrefs"] && typeof r["pushPrefs"] === "object"
      ? { pushPrefs: r["pushPrefs"] as AppState["pushPrefs"] }
      : {}),
    termsAcceptedAt: typeof r["termsAcceptedAt"] === "string" ? r["termsAcceptedAt"] : null,
    privacyAcceptedAt: typeof r["privacyAcceptedAt"] === "string" ? r["privacyAcceptedAt"] : null,
    healthPurposeAckAt:
      typeof r["healthPurposeAckAt"] === "string" ? r["healthPurposeAckAt"] : null,
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

function mapMeals(rows: Row[]): MealEntry[] {
  return rows.map(mapMealEntryRow);
}

function parseRpe(raw: unknown): SessionRpe | undefined {
  if (raw === "facil" || raw === "ok" || raw === "dificil") return raw;
  return undefined;
}

function mapSessions(rows: Row[]): AppState["sessions"] {
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

/** Shallow merge: override wins for keys that are present and non-undefined. Arrays/objects replace. */
export function mergeAppStateOverride(
  base: AppState,
  override?: Partial<AppState> | null,
): AppState {
  if (!override) return base;
  const next = { ...base };
  for (const [key, value] of Object.entries(override) as Array<[keyof AppState, unknown]>) {
    if (value !== undefined) {
      (next as Record<string, unknown>)[key as string] = value;
    }
  }
  return next;
}

/**
 * Load full AppState for a user from domain tables.
 * Returns emptyState shaped object when DB unavailable or no rows (commerce-only 360 path).
 */
export async function hydrateAppStateFromDb(userId: string): Promise<AppState> {
  const base: AppState = { ...emptyState, userId };
  if (!userId) return base;

  const db = await adminDbLoose();
  if (!db) return base;

  const [
    profileRes,
    sessionsRes,
    weightsRes,
    daysRes,
    supplementsRes,
    stateRes,
    mealsRes,
    checkInsRes,
    snapshotsRes,
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
      .from("decision_context_snapshots")
      .select("date, payload")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(14),
  ]);

  const stateRow = stateRes.data as Row | null;
  const retention = retentionFromRow(stateRow?.["retention"]);
  const { mergeDayCheckIns, rowToDayCheckIn } = await import("@/lib/sync/day-checkin");
  const tableChecks = !checkInsRes.error
    ? ((checkInsRes.data ?? []) as Row[]).map((r) => rowToDayCheckIn(r))
    : [];
  const dayCheckIns = mergeDayCheckIns(retention.dayCheckIns ?? {}, tableChecks);

  const days: AppState["days"] = {};
  for (const d of (daysRes.data ?? []) as Row[]) {
    days[String(d["date"])] = {
      date: String(d["date"]),
      waterMl: Number(d["water_ml"] ?? 0),
      sleepHours: Number(d["sleep_hours"] ?? 0),
      energy: (d["energy"] as AppState["days"][string]["energy"]) ?? "ok",
      notes: String(d["notes"] ?? ""),
    };
  }

  const supplementLogs: Record<string, string[]> = {};
  for (const row of (supplementsRes.data ?? []) as Row[]) {
    const date = String(row["date"] ?? "");
    const ids = (row["supplement_ids"] as string[]) ?? [];
    if (date) supplementLogs[date] = ids;
  }

  const profileRow = profileRes.data as Row | null;
  const prefs =
    profileRow?.["prefs"] && typeof profileRow["prefs"] === "object"
      ? (profileRow["prefs"] as Record<string, unknown>)
      : {};
  const profile = profileRow
    ? {
        name: String(profileRow["name"] ?? ""),
        goal: (profileRow["goal"] as Goal) ?? "massa",
        level: (profileRow["level"] as Level) ?? "iniciante",
        daysPerWeek: Number(profileRow["days_per_week"] ?? 3),
        age: Number(profileRow["age"] ?? 25),
        heightCm: Number(profileRow["height_cm"] ?? 170),
        weightKg: Number(profileRow["weight_kg"] ?? 70),
        equipment: (profileRow["equipment"] as Equipment) ?? "academia",
        restrictions: (profileRow["restrictions"] as string[]) ?? [],
        createdAt: String(profileRow["created_at"] ?? new Date().toISOString()),
        ...(prefs["skipBreakfast"] === true ? { skipBreakfast: true } : {}),
        ...(prefs["lunchOutOften"] === true ? { lunchOutOften: true } : {}),
        ...(typeof prefs["typicalSleepHours"] === "number"
          ? { typicalSleepHours: prefs["typicalSleepHours"] }
          : {}),
        ...(typeof prefs["primaryBlocker"] === "string"
          ? { primaryBlocker: prefs["primaryBlocker"] as import("@/lib/types").PrimaryBlocker }
          : {}),
        ...(prefs["nutritionProfile"] && typeof prefs["nutritionProfile"] === "object"
          ? {
              nutritionProfile: prefs["nutritionProfile"] as import("@/lib/types").NutritionProfile,
            }
          : {}),
        ...(Array.isArray(prefs["equipmentInventory"])
          ? { equipmentInventory: prefs["equipmentInventory"] as import("@/lib/types").GymGear[] }
          : {}),
        ...(typeof prefs["typicalSessionMin"] === "number"
          ? { typicalSessionMin: prefs["typicalSessionMin"] }
          : {}),
        ...(prefs["onboardingComplete"] === true || prefs["onboardingComplete"] === false
          ? { onboardingComplete: prefs["onboardingComplete"] === true }
          : {}),
        ...((typeof profileRow["timezone"] === "string" && profileRow["timezone"].trim()) ||
        (typeof prefs["timezone"] === "string" && prefs["timezone"].trim())
          ? {
              timezone: String(
                (typeof profileRow["timezone"] === "string" && profileRow["timezone"].trim()
                  ? profileRow["timezone"]
                  : prefs["timezone"]) ?? "America/Sao_Paulo",
              ).trim(),
            }
          : {}),
      }
    : null;

  const chat = ((stateRow?.["chat"] as ChatMessage[]) ?? []).map((m) => ({
    ...m,
    id: m.id || crypto.randomUUID(),
  }));

  const decisionContextByDate = mapDecisionContextCache(
    snapshotsRes.error ? [] : ((snapshotsRes.data ?? []) as Row[]),
  );

  return {
    ...base,
    ...retention,
    userId,
    dayCheckIns,
    profile,
    sessions: mapSessions((sessionsRes.data ?? []) as Row[]),
    weights: ((weightsRes.data ?? []) as Row[]).map((w) => ({
      date: String(w["date"]),
      kg: Number(w["kg"]),
    })),
    days,
    meals: mapMeals((mealsRes.data ?? []) as Row[]),
    supplementLogs,
    supplementRoutine: (stateRow?.["supplement_routine"] as string[]) ?? [],
    challenges: (stateRow?.["challenges"] as AppState["challenges"]) ?? [],
    chat,
    theme: ((stateRow?.["theme"] as AppState["theme"]) ?? "dark") as AppState["theme"],
    dimensionSnapshots: (stateRow?.["dimension_snapshots"] as AppState["dimensionSnapshots"]) ?? [],
    earnedBadges:
      (retention.earnedBadges?.length
        ? retention.earnedBadges
        : (stateRow?.["earned_badges"] as string[])) ?? [],
    shareProgress: stateRow?.["share_progress"] !== false,
    socialPrivacy: normalizeSocialPrivacy(
      retention.socialPrivacy,
      stateRow?.["share_progress"] !== false,
    ),
    sessionFx: stateRow?.["session_fx"] !== false,
    favoriteMealPresetIds:
      (retention.favoriteMealPresetIds?.length
        ? retention.favoriteMealPresetIds
        : (stateRow?.["favorite_meal_preset_ids"] as string[])) ?? [],
    savedMeals: retention.savedMeals ?? [],
    remindersEnabled: stateRow?.["reminders_enabled"] === true,
    reminderHour: Number(stateRow?.["reminder_hour"] ?? 18),
    seenOnboardingTips: (stateRow?.["seen_onboarding_tips"] as string[]) ?? [],
    livingPlans: {
      ...((stateRow?.["living_plans"] as AppState["livingPlans"]) ?? {}),
      ...Object.fromEntries(
        Object.entries(decisionContextByDate).map(([d, snap]) => [d, snap.livingPlan]),
      ),
    },
    decisionContextByDate,
  };
}

function mapDecisionContextCache(rows: Row[]): AppState["decisionContextByDate"] {
  const out: AppState["decisionContextByDate"] = {};
  for (const row of rows) {
    const date = String(row["date"] ?? "");
    const payload = row["payload"];
    if (!date || !payload || typeof payload !== "object") continue;
    const snap = payload as AppState["decisionContextByDate"][string];
    out[date] = { ...snap, source: "server" };
  }
  return out;
}
