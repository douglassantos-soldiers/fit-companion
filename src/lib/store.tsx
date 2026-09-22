import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { allQuestsComplete, bumpManualQuest, ensureDailyQuests } from "@/data/daily-quests";
import { runBehaviorLoop } from "@/lib/engine/behavior";
import { presetById } from "@/data/meal-presets";
import { performanceDimensions } from "@/lib/engine/dimensions";
import { assembleDecisionContext } from "@/lib/engine/assemble-decision-context";
import { applyDecisionContextToState } from "@/lib/engine/decision-context-snapshot";
import { withProfileTimezone } from "@/lib/timezone";
import { scalePreset } from "@/lib/engine/nutrition";
import { grantPendingAchievements } from "@/lib/engine/achievements";
import { prsAchievedInSession } from "@/lib/engine/period-review";
import {
  applyXpAward,
  dailyXpGoalMet,
  supplementsComplete,
  waterGoalReached,
  XP,
} from "@/lib/engine/xp";
import {
  bumpFriendQuestOnSession,
  challengeProgress,
  challengeRawValue,
  ensureSocialProfile,
  joinChallengeRemote,
  leaveChallengeRemote,
  publishBadgeEvent,
  publishRetentionEvent,
  publishSessionEvent,
  syncAllJoinedChallenges,
  syncChallengeProgress,
  syncLeaguePoints,
  saveSocialPrivacyRemote,
} from "@/lib/social";
import { challengeById, computePersonalTarget, isPersonalizedChallenge } from "@/data/challenges";
import { hubById } from "@/data/hubs";
import { joinHub as joinHubRemote, leaveHub as leaveHubRemote } from "@/lib/hubs";
import { getDeviceId, pullState, pushState } from "@/lib/sync";
import { establishAccessSession } from "@/lib/access.functions";
import { ensureIdentityForDevice } from "@/lib/identity.functions";
import { persistUserPatterns } from "@/lib/learning.functions";
import { buildPatternsBlobV2 } from "@/lib/engine/learned-patterns";
import { enrichRestockConfidence } from "@/data/shopify-product-map";
import { mergeRestockWithConsumption } from "@/lib/engine/supplement-inventory";
import { productById } from "@/data/products";
import { emitAppEventCompat } from "@/lib/events/emit";
import { enqueueEntity, ensureOutboxListeners, flushOutbox } from "@/lib/sync/outbox";
import {
  refreshDecisionContextBestEffort,
  recordNextDayCheckInBestEffort,
  recordSessionOutcomeBestEffort,
  recordDecisionActionBestEffort,
} from "@/lib/decision-client";
import { clearLocalReminders, scheduleLocalReminders } from "@/lib/notifications";
import { applyCmsState, emptyCmsState } from "@/lib/cms";
import { applyPublicCatalog, type PublicCatalog } from "@/lib/catalog-runtime";
import { getPublicCms, getPublicCatalog } from "@/lib/admin.functions";
import { hydrateSoldiersMedia } from "@/lib/soldiers-media";
import { getPublishedSoldiersMedia } from "@/lib/soldiers-media.functions";
import { migrateLegacyPrefs, prefsToLegacyArrays, setPreference } from "@/lib/training/preferences";
import type {
  ActivityLogEntry,
  ActivityLogKind,
  DoseFrequency,
  DoseUnit,
  SupplementDoseLog,
  WearableConnection,
} from "@/lib/types";
import { validateActivityLog, validateChallengeProgress } from "@/lib/engine/anti-fraud";
import { applyFraudPolicy } from "@/lib/engine/anti-fraud-policy";
import { mergeActivityLogs } from "@/lib/wearables/normalize";
import { challengeProofFromLogs } from "@/lib/wearables/challenge-proof";
import {
  isSocialSharingEnabled,
  normalizeSocialPrivacy,
  privacyFromLegacyShareProgress,
  shouldPublishEvent,
} from "@/lib/social/visibility";

function emitAppEvent(
  deviceId: string,
  kind: string,
  payload: Record<string, unknown> = {},
  opts?: { entityType?: string; entityId?: string },
) {
  if (!deviceId) return;
  emitAppEventCompat(deviceId, kind, payload, opts);
}

/** Parse catalog serving like "30 g" / "1 cápsula" into dose + unit. */
function defaultDoseFromProduct(productId: string): { dose: number; unit: DoseUnit } {
  const p = productById(productId);
  const serving = (p?.serving ?? "1 dose").toLowerCase();
  const num = Number.parseFloat(serving.replace(",", "."));
  const dose = Number.isFinite(num) && num > 0 ? num : 1;
  if (serving.includes("cápsula") || serving.includes("capsula") || serving.includes("caps")) {
    return { dose, unit: "caps" };
  }
  if (serving.includes("ml")) return { dose, unit: "ml" };
  if (serving.includes("g")) return { dose, unit: "g" };
  if (serving.includes("scoop")) return { dose, unit: "scoop" };
  return { dose: 1, unit: "serving" };
}

function rollupSupplementLogsFromDoses(
  existing: Record<string, string[]>,
  doses: SupplementDoseLog[],
): Record<string, string[]> {
  const out: Record<string, string[]> = { ...existing };
  for (const d of doses) {
    const date = d.takenAt.slice(0, 10);
    const ids = new Set(out[date] ?? []);
    ids.add(d.productId);
    out[date] = [...ids];
  }
  return out;
}

function refreshRestock(
  s: AppState,
  base?: AppState["restockEstimates"],
): AppState["restockEstimates"] {
  const estimates = base ?? s.restockEstimates ?? {};
  const withConf = enrichRestockConfidence(estimates, s.supplementLogs, {
    doseLogs: s.supplementDoseLogs ?? [],
    frequencies: s.supplementFrequencies,
  });
  return mergeRestockWithConsumption(withConf, s.supplementDoseLogs ?? [], s.supplementFrequencies);
}
import { planDayForToday } from "@/lib/engine/plan";
import { resolveTrainingPlanDays } from "@/lib/training/resolve-plan-days";
import { rollCosmeticReward } from "@/lib/engine/rewards";
import {
  emptyState,
  todayKey,
  todayKeyForProfile,
  type AppState,
  type BodyMeasurementEntry,
  type DayCheckIn,
  type MealEntry,
  type PhotoVisibility,
  type Profile,
  type ProgressPhotoEntry,
  type SavedMeal,
  type SavedTrainingPlan,
  type CustomFood,
  type SessionLog,
  type Theme,
} from "@/lib/types";
import {
  applyUserCatalog,
} from "@/lib/nutrition/food-catalog";
import { mergeFavoriteFoodIds } from "@/lib/nutrition/favorite-foods-merge";
import {
  buildCustomFood,
  removeCustomFoodFromList,
  upsertCustomFoodList,
  type CustomFoodInput,
} from "@/lib/nutrition/custom-foods";
import {
  forkDayPlan,
  forkWeekPlan,
  mergeSavedTrainingPlans,
  removeSavedTrainingPlan,
  upsertSavedTrainingPlan,
} from "@/lib/training/saved-training-plans";
import {
  activeBlockFromProgram,
  archiveTrainingBlock,
  blockContainsDayId,
  completeBlockDay,
  mergeActiveTrainingBlock,
  mergeTrainingBlockHistory,
  pushBlockHistory,
} from "@/lib/training/training-block";
import { listContentOsPrograms, listContentOsSessions } from "@/lib/content/catalog";
import type { PlannedDay } from "@/lib/training/plan";
import { weekStartKey } from "@/lib/engine/xp";
import {
  emptyMeasurement,
  mergeMeasurementsByDate,
  mergeProgressPhotos,
  measurementsLoggedPayload,
  parseCm,
} from "@/lib/progress/body";

const KEY = "soldiers-os-v1";

interface Store {
  state: AppState;
  hydrated: boolean;
  deviceId: string;
  setProfile: (p: Profile) => void;
  patchProfile: (patch: Partial<Profile>) => void;
  addSession: (s: SessionLog, opts?: { imageUrl?: string }) => void;
  addWeight: (kg: number) => void;
  addMeasurements: (entry: Omit<BodyMeasurementEntry, "date"> & { date?: string }) => void;
  upsertProgressPhoto: (photo: ProgressPhotoEntry) => void;
  removeProgressPhoto: (id: string) => void;
  setProgressPhotoVisibility: (id: string, visibility: PhotoVisibility) => void;
  addWater: (ml: number) => void;
  addMealEntry: (
    entry: Omit<MealEntry, "id" | "date"> & { date?: string; servings?: number },
  ) => void;
  removeMealEntry: (id: string) => void;
  updateMealEntry: (
    id: string,
    patch: Partial<
      Pick<
        MealEntry,
        | "label"
        | "slot"
        | "servings"
        | "proteinG"
        | "kcal"
        | "quality"
        | "sourceKind"
        | "confidence"
        | "aiMode"
        | "correctedFromAi"
      >
    >,
  ) => void;
  toggleFavoriteMeal: (presetId: string) => void;
  toggleFavoriteFood: (foodId: string) => void;
  saveMealTemplate: (meal: Omit<SavedMeal, "id" | "createdAt"> & { id?: string }) => void;
  removeSavedMeal: (id: string) => void;
  upsertCustomFood: (input: CustomFoodInput) => CustomFood;
  removeCustomFood: (id: string) => void;
  forkWeeklyPlan: (days: PlannedDay[], name?: string) => SavedTrainingPlan;
  saveDayAsRoutine: (day: PlannedDay, name?: string) => SavedTrainingPlan;
  removeTrainingPlan: (id: string) => void;
  activateTrainingPlan: (id: string) => void;
  clearActiveTrainingPlan: () => void;
  enrollInProgram: (programId: string) => boolean;
  leaveTrainingBlock: () => void;
  replacePrescribedExercise: (
    dayId: string,
    fromExerciseId: string,
    to: {
      exerciseId: string;
      name: string;
      sets?: number;
      reps?: string;
      restSec?: number;
      suggestedLoad?: number;
      unit?: "kg" | "corpo" | "min";
    },
  ) => void;
  setExercisePreference: (
    exerciseId: string,
    preference: "like" | "dislike" | "clear" | "preferred" | "disliked" | "avoided" | "neutral",
  ) => void;
  setExercisePreferences: (prefs: AppState["exercisePreferences"]) => void;
  saveLivingPlanFeedback: (
    date: string,
    vote: import("@/lib/types").LivingPlanFeedbackVote,
    reason?: import("@/lib/types").LivingPlanFeedbackReason,
  ) => void;
  toggleSupplement: (id: string) => void;
  logSupplementDose: (opts: {
    productId: string;
    dose: number;
    unit: import("@/lib/types").DoseUnit;
    frequency: import("@/lib/types").DoseFrequency;
    takenAt?: string;
    source?: import("@/lib/types").DoseSource;
  }) => void;
  removeSupplementDose: (id: string) => void;
  setRoutine: (ids: string[]) => void;
  toggleChallenge: (id: string) => void;
  bumpChallengeInvitesSent: () => void;
  dismissCoachNudge: () => void;
  markCoachNudgeShown: () => void;
  toggleHub: (hubId: string) => void;
  logActivity: (
    kind: ActivityLogKind,
    value: number,
    date?: string,
  ) => {
    ok: boolean;
    message?: string;
    warning?: string;
  };
  ingestActivityLogs: (entries: ActivityLogEntry[]) => void;
  setWearableConnection: (conn: WearableConnection) => void;
  pushChat: (role: "coach" | "user", text: string) => void;
  setTheme: (theme: Theme) => void;
  setShareProgress: (share: boolean) => void;
  setSocialPrivacy: (privacy: import("@/lib/social/visibility").SocialPrivacy) => void;
  setSessionFx: (enabled: boolean) => void;
  setRemindersEnabled: (enabled: boolean) => void;
  setReminderHour: (hour: number) => void;
  setPushPrefs: (prefs: Partial<AppState["pushPrefs"]>) => void;
  acceptLegal: (kind: "terms" | "privacy" | "health") => void;
  markTipSeen: (id: string) => void;
  earnBadge: (id: string) => boolean;
  recordDimensionSnapshot: () => void;
  useStreakFreeze: () => boolean;
  markQuestCoachOpened: () => void;
  markQuestKudos: () => void;
  setBio: (bio: string) => void;
  setAvatarUrl: (url: string | null) => void;
  setAuthUserId: (id: string | null) => void;
  setAccessGranted: (opts: {
    email: string;
    shopifyCustomerId?: string | null;
    orderCount?: number;
    productIds?: string[];
    accessTier?: "base" | "performance";
    restockEstimates?: AppState["restockEstimates"];
    lastPaidAt?: string | null;
    accessExpiresAt?: string | null;
    shopifyDisplayName?: string | null;
  }) => Promise<void>;
  /** Sync UX flag from validated server cookie (no entitlement write). */
  updateAccessFromSession: (opts: {
    email: string;
    tier: "base" | "performance";
    lastPaidAt?: string | null;
  }) => void;
  /** Clear local grant when server session is missing. */
  revokeAccessLocal: () => void;
  dismissRoutineFromPurchase: () => void;
  markUpsellShown: () => void;
  saveDayCheckIn: (checkIn: Omit<DayCheckIn, "date"> & { date?: string }) => void;
  refreshLivingPlan: () => void;
  lastSessionXp: number;
  reset: () => void;
  /** Explicit wipe of account domain data on server (requires confirmation in UI). */
  clearAccountData: () => Promise<{ ok: boolean; partial?: boolean }>;
}

const StoreContext = createContext<Store | null>(null);

function load(): AppState {
  if (typeof window === "undefined") return emptyState;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as AppState;
    const profile = parsed.profile ? withProfileTimezone(parsed.profile) : parsed.profile;
    return {
      ...emptyState,
      ...parsed,
      profile,
      socialPrivacy: normalizeSocialPrivacy(parsed.socialPrivacy, parsed.shareProgress !== false),
    };
  } catch {
    return emptyState;
  }
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  root.dataset["theme"] = theme;
}

function withSnapshot(s: AppState): AppState {
  if (!s.profile) return s;
  const date = todayKeyForProfile(s.profile);
  const dims = performanceDimensions(s, s.profile);
  const scores = Object.fromEntries(dims.map((d) => [d.key, d.score]));
  const rest = s.dimensionSnapshots.filter((x) => x.date !== date);
  const withDims: AppState = {
    ...s,
    dayCheckIns: s.dayCheckIns ?? {},
    livingPlans: s.livingPlans ?? {},
    decisionContextByDate: s.decisionContextByDate ?? {},
    challengeBaselines: s.challengeBaselines ?? {},
    challengePersonalTargets: s.challengePersonalTargets ?? {},
    activityLogs: s.activityLogs ?? [],
    joinedHubIds: s.joinedHubIds ?? [],
    dimensionSnapshots: [...rest, { date, scores }].sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
  const cached = withDims.decisionContextByDate?.[date];
  if (cached?.source === "server") {
    return {
      ...withDims,
      livingPlans: { ...withDims.livingPlans, [date]: cached.livingPlan },
    };
  }
  const assembled = assembleDecisionContext(withDims, {
    date,
    timezone: s.profile.timezone,
    source: "offline_legacy",
  });
  if (!assembled) return withDims;
  return applyDecisionContextToState(withDims, assembled);
}

function syncMealCount(s: AppState, date: string): AppState {
  const count = s.meals.filter((m) => m.date === date).length;
  const d = s.days[date] ?? { date, waterMl: 0, meals: 0 };
  return { ...s, days: { ...s.days, [date]: { ...d, meals: count } } };
}

function mergeWearableConnections(
  local?: WearableConnection[],
  remote?: WearableConnection[],
): WearableConnection[] {
  const byProvider = new Map<string, WearableConnection>();
  for (const c of remote ?? []) {
    if (c?.provider) byProvider.set(c.provider, c);
  }
  for (const c of local ?? []) {
    if (c?.provider) byProvider.set(c.provider, c);
  }
  return [...byProvider.values()];
}

function mergeSavedMeals(local?: SavedMeal[], remote?: SavedMeal[]): SavedMeal[] {
  const byId = new Map<string, SavedMeal>();
  for (const m of remote ?? []) {
    if (m?.id) byId.set(m.id, m);
  }
  for (const m of local ?? []) {
    if (m?.id) byId.set(m.id, m);
  }
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40);
}

function mergeCustomFoods(local?: CustomFood[], remote?: CustomFood[]): CustomFood[] {
  const byId = new Map<string, CustomFood>();
  for (const f of remote ?? []) {
    if (f?.id) byId.set(f.id, f);
  }
  for (const f of local ?? []) {
    if (f?.id) byId.set(f.id, f);
  }
  return [...byId.values()]
    .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
    .slice(0, 60);
}

function withQuests(s: AppState, deviceId: string): AppState {
  const loop = runBehaviorLoop(s);
  return ensureDailyQuests(s, deviceId, todayKeyForProfile(s.profile), {
    triggers: loop.triggers,
    patterns: loop.patterns,
    profile: loop.profile,
    weekday: new Date().getDay(),
  });
}

function afterXpSideEffects(
  prev: AppState,
  next: AppState,
  deviceId: string,
  opts?: { fromSession?: SessionLog },
): AppState {
  let out = next;
  const date = todayKeyForProfile(out.profile);
  if (allQuestsComplete(out, date) && !allQuestsComplete(prev, date)) {
    const bonus = applyXpAward(out, XP.questsCompleteBonus, date);
    out = bonus.state;
  }
  if (
    dailyXpGoalMet(out, date) &&
    !dailyXpGoalMet(prev, date) &&
    out.profile &&
    out.shareProgress &&
    deviceId
  ) {
    void publishRetentionEvent(deviceId, out.profile.name, "xp_goal", {
      xp: out.xpByDate[date] ?? 0,
    }).catch((err) => console.warn("publishRetentionEvent failed", err));
    const reward = rollCosmeticReward();
    if (reward && !(out.cosmeticBadges ?? []).includes(reward.id)) {
      out = { ...out, cosmeticBadges: [...(out.cosmeticBadges ?? []), reward.id] };
    }
  }
  if (deviceId && out.shareProgress && out.profile) {
    const xpToday = out.xpByDate[date] ?? 0;
    void syncLeaguePoints(deviceId, out.profile.name, xpToday).catch((err) =>
      console.warn("syncLeaguePoints failed", err),
    );
    if (opts?.fromSession) {
      void bumpFriendQuestOnSession(deviceId).catch((err) =>
        console.warn("bumpFriendQuestOnSession failed", err),
      );
    }
  }
  return out;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [lastSessionXp, setLastSessionXp] = useState(0);
  const [, setCmsRevision] = useState(0);

  const deviceId = useRef("");
  const skipPush = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const local = load();
    const id = getDeviceId();
    deviceId.current = id;
    setState(withQuests({ ...emptyState, ...local }, id));
    applyUserCatalog(local.customFoods ?? []);
    applyTheme(local.theme ?? "dark");
    setHydrated(true);

    try {
      const openedKey = `soldiers_app_opened_${todayKey()}`;
      if (typeof window !== "undefined" && !window.localStorage.getItem(openedKey)) {
        window.localStorage.setItem(openedKey, "1");
        emitAppEvent(id, "app_opened", { date: todayKey() });
      }
    } catch {
      /* ignore */
    }

    void getPublicCms()
      .then((cms) => {
        applyCmsState(cms);
        setCmsRevision((n) => n + 1);
      })
      .catch((e) => {
        console.warn("CMS hydrate failed", e);
        applyCmsState(emptyCmsState());
        setCmsRevision((n) => n + 1);
      });

    void getPublicCatalog()
      .then((payload) => {
        try {
          applyPublicCatalog(JSON.parse(payload.json) as PublicCatalog, stateRef.current.customFoods ?? []);
        } catch (e) {
          console.warn("Catalog parse failed", e);
        }
        setCmsRevision((n) => n + 1);
      })
      .catch((e) => {
        console.warn("Catalog hydrate failed", e);
      });

    void getPublishedSoldiersMedia()
      .then((rows) => {
        hydrateSoldiersMedia(rows);
        setCmsRevision((n) => n + 1);
      })
      .catch((e) => {
        console.warn("Soldiers media hydrate failed", e);
      });

    void (async () => {
      try {
        ensureOutboxListeners();
        void flushOutbox().catch(() => undefined);

        // Identity Engine: ensure device has a persistent user (server-side)
        let resolvedUserId: string | null = local.userId ?? null;
        try {
          const ident = await ensureIdentityForDevice({
            data: { deviceId: id, platform: "web" },
          });
          if (ident.ok && ident.userId) resolvedUserId = ident.userId;
        } catch (e) {
          console.warn("ensureIdentityForDevice failed", e);
        }

        const remote = await pullState(id);

        if (remote) {
          skipPush.current = true;
          const logsForConfidence = Object.keys(local.supplementLogs ?? {}).length
            ? local.supplementLogs
            : (remote.supplementLogs ?? {});
          const restockBase = Object.keys(local.restockEstimates ?? {}).length
            ? local.restockEstimates
            : (remote.restockEstimates ?? {});
          const merged = withQuests(
            {
              ...emptyState,
              ...remote,
              meals: remote.meals?.length ? remote.meals : (local.meals ?? []),
              measurements: mergeMeasurementsByDate(
                remote.measurements ?? [],
                local.measurements ?? [],
              ),
              progressPhotos: mergeProgressPhotos(
                remote.progressPhotos ?? [],
                local.progressPhotos ?? [],
              ),
              theme: local.theme ?? remote.theme ?? "dark",
              earnedBadges: [
                ...new Set([...(remote.earnedBadges ?? []), ...(local.earnedBadges ?? [])]),
              ],
              livingPlanFeedback: {
                ...(remote.livingPlanFeedback ?? {}),
                ...(local.livingPlanFeedback ?? {}),
              },
              dimensionSnapshots: local.dimensionSnapshots?.length
                ? local.dimensionSnapshots
                : (remote.dimensionSnapshots ?? []),
              shareProgress: local.shareProgress ?? remote.shareProgress ?? true,
              socialPrivacy: normalizeSocialPrivacy(
                local.socialPrivacy ?? remote.socialPrivacy,
                local.shareProgress ?? remote.shareProgress ?? true,
              ),
              sessionFx: local.sessionFx ?? remote.sessionFx ?? true,
              favoriteMealPresetIds:
                local.favoriteMealPresetIds ?? remote.favoriteMealPresetIds ?? [],
              favoriteFoodIds: mergeFavoriteFoodIds(local.favoriteFoodIds, remote.favoriteFoodIds),
              savedMeals: mergeSavedMeals(local.savedMeals, remote.savedMeals),
              customFoods: mergeCustomFoods(local.customFoods, remote.customFoods),
              savedTrainingPlans: mergeSavedTrainingPlans(
                local.savedTrainingPlans,
                remote.savedTrainingPlans,
              ),
              activeTrainingPlanId:
                local.activeTrainingPlanId ?? remote.activeTrainingPlanId ?? null,
              activeTrainingPlanWeekKey:
                local.activeTrainingPlanWeekKey ?? remote.activeTrainingPlanWeekKey ?? null,
              activeTrainingBlock: mergeActiveTrainingBlock(
                local.activeTrainingBlock,
                remote.activeTrainingBlock,
              ),
              trainingBlockHistory: mergeTrainingBlockHistory(
                local.trainingBlockHistory,
                remote.trainingBlockHistory,
              ),
              wearableConnections: mergeWearableConnections(
                local.wearableConnections,
                remote.wearableConnections,
              ),
              lastFraudWarning: local.lastFraudWarning ?? remote.lastFraudWarning ?? null,
              likedExerciseIds: [
                ...new Set([...(remote.likedExerciseIds ?? []), ...(local.likedExerciseIds ?? [])]),
              ],
              dislikedExerciseIds: [
                ...new Set([
                  ...(remote.dislikedExerciseIds ?? []),
                  ...(local.dislikedExerciseIds ?? []),
                ]),
              ],
              exercisePreferences: {
                ...(remote.exercisePreferences ?? {}),
                ...(local.exercisePreferences ?? {}),
              },
              remindersEnabled: local.remindersEnabled ?? false,
              reminderHour: local.reminderHour ?? remote.reminderHour ?? 18,
              pushPrefs: {
                workout: local.pushPrefs?.workout ?? remote.pushPrefs?.workout ?? true,
                streak: local.pushPrefs?.streak ?? remote.pushPrefs?.streak ?? true,
                challenge: local.pushPrefs?.challenge ?? remote.pushPrefs?.challenge ?? true,
                kudos: local.pushPrefs?.kudos ?? remote.pushPrefs?.kudos ?? true,
              },
              termsAcceptedAt: local.termsAcceptedAt ?? remote.termsAcceptedAt ?? null,
              privacyAcceptedAt: local.privacyAcceptedAt ?? remote.privacyAcceptedAt ?? null,
              healthPurposeAckAt: local.healthPurposeAckAt ?? remote.healthPurposeAckAt ?? null,
              seenOnboardingTips: local.seenOnboardingTips ?? remote.seenOnboardingTips ?? [],
              xpByDate: { ...(remote.xpByDate ?? {}), ...(local.xpByDate ?? {}) },
              streakFreezes: local.streakFreezes ?? remote.streakFreezes ?? 1,
              freezeUsedDates: [
                ...new Set([...(remote.freezeUsedDates ?? []), ...(local.freezeUsedDates ?? [])]),
              ],
              xpGoalMetDates: [
                ...new Set([...(remote.xpGoalMetDates ?? []), ...(local.xpGoalMetDates ?? [])]),
              ],
              dailyQuestIds:
                local.dailyQuestDate === todayKey() ? local.dailyQuestIds : remote.dailyQuestIds,
              dailyQuestDate:
                local.dailyQuestDate === todayKey() ? local.dailyQuestDate : remote.dailyQuestDate,
              dailyQuestProgress:
                local.dailyQuestDate === todayKey()
                  ? local.dailyQuestProgress
                  : remote.dailyQuestProgress,
              cosmeticBadges: [
                ...new Set([...(remote.cosmeticBadges ?? []), ...(local.cosmeticBadges ?? [])]),
              ],
              authUserId: local.authUserId ?? remote.authUserId ?? null,
              userId: resolvedUserId ?? local.userId ?? remote.userId ?? null,
              bio: local.bio || remote.bio || "",
              avatarUrl: local.avatarUrl ?? remote.avatarUrl ?? null,
              accessGranted: local.accessGranted === true || remote.accessGranted === true,
              accessEmail: local.accessEmail ?? remote.accessEmail ?? null,
              accessGrantedAt: local.accessGrantedAt ?? remote.accessGrantedAt ?? null,
              lastPurchaseAt: local.lastPurchaseAt ?? remote.lastPurchaseAt ?? null,
              accessExpiresAt: local.accessExpiresAt ?? remote.accessExpiresAt ?? null,
              shopifyDisplayName: local.shopifyDisplayName ?? remote.shopifyDisplayName ?? null,
              accessTier: local.accessTier ?? remote.accessTier ?? "base",
              purchaseProductIds: local.purchaseProductIds?.length
                ? local.purchaseProductIds
                : (remote.purchaseProductIds ?? []),
              restockEstimates: enrichRestockConfidence(restockBase ?? {}, logsForConfidence),
              supplementLogs: logsForConfidence,
              routineFromPurchase: local.routineFromPurchase || remote.routineFromPurchase || false,
              routineFromPurchaseDismissed:
                local.routineFromPurchaseDismissed || remote.routineFromPurchaseDismissed || false,
              upsellShownDate: local.upsellShownDate ?? remote.upsellShownDate ?? null,
            },
            id,
          );
          setState(merged);
          applyUserCatalog(merged.customFoods ?? []);
          applyTheme(merged.theme ?? "dark");
          void refreshDecisionContextBestEffort(id).then((snap) => {
            if (!snap) return;
            setState((s) => applyDecisionContextToState(s, snap));
          });

          if (resolvedUserId) {
            void persistUserPatterns({
              data: {
                deviceId: id,
                patterns: buildPatternsBlobV2(merged),
              },
            }).catch(() => undefined);
          }
        } else {
          if (resolvedUserId) {
            setState((s) => ({ ...s, userId: resolvedUserId }));
            const bootState = withQuests({ ...emptyState, ...local, userId: resolvedUserId }, id);
            void persistUserPatterns({
              data: {
                deviceId: id,
                patterns: buildPatternsBlobV2(bootState),
              },
            }).catch(() => undefined);
          }
          if (local.profile) {
            void pushState(id, withQuests({ ...emptyState, ...local }, id));
          }
        }
      } catch (e) {
        console.error("Falha ao carregar dados do banco", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(KEY, JSON.stringify(state));
    if (skipPush.current) {
      skipPush.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void pushState(deviceId.current, state);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [state, hydrated]);

  // Customer 360 recompute — throttled (not every keystroke push)
  useEffect(() => {
    if (!hydrated || !state.userId || !deviceId.current) return;
    const timer = window.setTimeout(() => {
      void import("@/lib/customer360.functions")
        .then(({ recomputeCustomer360Fn }) =>
          recomputeCustomer360Fn({ data: { deviceId: deviceId.current } }),
        )
        .catch(() => undefined);
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, [
    hydrated,
    state.userId,
    state.sessions.length,
    state.meals.length,
    state.weights.length,
    Object.keys(state.dayCheckIns ?? {}).length,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    applyTheme(state.theme);
  }, [state.theme, hydrated]);

  useEffect(() => {
    if (!hydrated || !state.profile || !deviceId.current) return;
    void ensureSocialProfile(deviceId.current, state.profile.name).catch((err) =>
      console.warn("ensureSocialProfile failed", err),
    );
  }, [hydrated, state.profile?.name]);

  useEffect(() => {
    if (!hydrated) return;
    if (!state.remindersEnabled) {
      clearLocalReminders();
      return;
    }
    const day =
      state.profile != null
        ? planDayForToday(resolveTrainingPlanDays(state))
        : null;
    scheduleLocalReminders({
      enabled: true,
      hour: state.reminderHour ?? 18,
      sessions: state.sessions,
      freezeUsedDates: state.freezeUsedDates ?? [],
      streakFreezes: state.streakFreezes ?? 0,
      xpToday: state.xpByDate?.[todayKeyForProfile(state.profile)] ?? 0,
      ...(day?.title ? { dayTitle: day.title } : {}),
    });
    return () => clearLocalReminders();
  }, [
    hydrated,
    state.remindersEnabled,
    state.reminderHour,
    state.sessions.length,
    state.profile?.name,
    state.freezeUsedDates,
    state.streakFreezes,
    state.xpByDate,
    state.activeTrainingBlock?.id,
    state.activeTrainingPlanId,
  ]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);

  const day = (s: AppState) => {
    const date = todayKeyForProfile(s.profile);
    return s.days[date] ?? { date, waterMl: 0, meals: 0 };
  };

  const value = useMemo<Store>(
    () => ({
      state,
      hydrated,
      deviceId: deviceId.current,
      lastSessionXp,
      setProfile: (profile) => {
        const wasFirst = !stateRef.current.profile;
        const nextProfile = withProfileTimezone(profile);
        update((s) => withSnapshot(withQuests({ ...s, profile: nextProfile }, deviceId.current)));
        if (deviceId.current) {
          void ensureSocialProfile(deviceId.current, nextProfile.name).catch((err) =>
            console.warn("ensureSocialProfile failed", err),
          );
        }
        if (wasFirst && deviceId.current) {
          emitAppEvent(deviceId.current, "onboarding_completed", { goal: nextProfile.goal });
        }
      },
      patchProfile: (patch) => {
        update((s) => {
          if (!s.profile) return s;
          return withSnapshot({
            ...s,
            profile: withProfileTimezone({ ...s.profile, ...patch }),
          });
        });
      },
      addSession: (session, opts) => {
        const prs = prsAchievedInSession(session, stateRef.current.sessions);
        const xpGain = (session.express ? XP.express : XP.session) + (prs.length ? XP.pr : 0);
        setLastSessionXp(xpGain);
        update((s) => {
          const prev = withQuests(s, deviceId.current);
          let next = withSnapshot({ ...prev, sessions: [session, ...prev.sessions] });
          if (blockContainsDayId(next.activeTrainingBlock, session.dayId)) {
            const prevBlock = next.activeTrainingBlock!;
            const { block: advanced, finished, weekAdvanced } = completeBlockDay(
              prevBlock,
              session.dayId,
            );
            if (finished) {
              next = {
                ...next,
                activeTrainingBlock: null,
                trainingBlockHistory: pushBlockHistory(
                  next.trainingBlockHistory,
                  archiveTrainingBlock(advanced, "completed"),
                ),
              };
              toast.success(`Trilha concluída: ${advanced.name}`);
            } else {
              next = { ...next, activeTrainingBlock: advanced };
              if (weekAdvanced) {
                toast.success(`Semana ${advanced.currentWeekIndex + 1} do bloco`);
              }
            }
          }
          const awarded = applyXpAward(next, xpGain);
          next = afterXpSideEffects(prev, awarded.state, deviceId.current, {
            fromSession: session,
          });
          const granted = grantPendingAchievements(next);
          next = granted.state;
          if (
            granted.unlocked.length &&
            deviceId.current &&
            next.profile &&
            shouldPublishEvent(next.socialPrivacy, "badge", {})
          ) {
            for (const id of granted.unlocked) {
              void publishBadgeEvent(deviceId.current, next.profile.name, id).catch((err) =>
                console.warn("publishBadgeEvent failed", err),
              );
            }
          }
          if (
            deviceId.current &&
            next.profile &&
            shouldPublishEvent(next.socialPrivacy, "session", { volumeKg: session.volumeKg })
          ) {
            const id = deviceId.current;
            const name = next.profile.name;
            void publishSessionEvent(id, name, session.title, session.volumeKg, {
              express: Boolean(session.express),
              ...(opts?.imageUrl ? { imageUrl: opts.imageUrl } : {}),
            }).catch((err) => console.warn("publishSessionEvent failed", err));
            void syncAllJoinedChallenges(next, id).catch((err) =>
              console.warn("syncAllJoinedChallenges failed", err),
            );
          }
          if (deviceId.current) {
            const vol = next.livingPlans?.[session.date.slice(0, 10)]?.workout.volumeFactor ?? null;
            recordSessionOutcomeBestEffort(deviceId.current, session, vol);
            void persistUserPatterns({
              data: {
                deviceId: deviceId.current,
                patterns: buildPatternsBlobV2(next),
              },
            }).catch(() => undefined);
          }
          return next;
        });
      },
      addWeight: (weightKg) => {
        update((s) =>
          withSnapshot({
            ...s,
            weights: [
              ...s.weights.filter((w) => w.date !== todayKey()),
              { date: todayKey(), weightKg },
            ].sort((a, b) => (a.date < b.date ? -1 : 1)),
            profile: s.profile ? { ...s.profile, weightKg } : s.profile,
          }),
        );
        emitAppEvent(
          deviceId.current,
          "weight_logged",
          { weightKg, date: todayKey() },
          {
            entityType: "weight",
            entityId: todayKey(),
          },
        );
      },
      addMeasurements: (entry) => {
        const date = (entry.date ?? todayKey()).slice(0, 10);
        const nextEntry: BodyMeasurementEntry = {
          ...emptyMeasurement(date),
          waistCm: parseCm(entry.waistCm),
          armCm: parseCm(entry.armCm),
          chestCm: parseCm(entry.chestCm),
          hipCm: parseCm(entry.hipCm),
          thighCm: parseCm(entry.thighCm),
        };
        update((s) => ({
          ...s,
          measurements: mergeMeasurementsByDate(s.measurements ?? [], [nextEntry]),
        }));
        emitAppEvent(deviceId.current, "measurements_logged", measurementsLoggedPayload(date), {
          entityType: "body_measurement",
          entityId: date,
        });
      },
      upsertProgressPhoto: (photo) => {
        update((s) => ({
          ...s,
          progressPhotos: mergeProgressPhotos(s.progressPhotos ?? [], [photo]),
        }));
        emitAppEvent(
          deviceId.current,
          "progress_photo_uploaded",
          { pose: photo.pose, date: photo.takenOn },
          { entityType: "progress_photo", entityId: photo.id },
        );
      },
      removeProgressPhoto: (id) =>
        update((s) => ({
          ...s,
          progressPhotos: (s.progressPhotos ?? []).filter((p) => p.id !== id),
        })),
      setProgressPhotoVisibility: (id, visibility) =>
        update((s) => ({
          ...s,
          progressPhotos: (s.progressPhotos ?? []).map((p) =>
            p.id === id ? { ...p, visibility } : p,
          ),
        })),
      addWater: (ml) =>
        update((s) => {
          const prev = withQuests(s, deviceId.current);
          const d = day(prev);
          const date = todayKey();
          let next = withSnapshot({
            ...prev,
            days: { ...prev.days, [date]: { ...d, waterMl: d.waterMl + ml } },
          });
          const was = waterGoalReached(prev, date);
          const now = waterGoalReached(next, date);
          if (!was && now) {
            const awarded = applyXpAward(next, XP.waterGoal, date);
            next = afterXpSideEffects(prev, awarded.state, deviceId.current);
          }
          return next;
        }),
      addMealEntry: (entry) => {
        let mealId = "";
        update((s) => {
          const prev = withQuests(s, deviceId.current);
          const date = entry.date ?? todayKey();
          const servings = entry.servings ?? 1;
          const full: MealEntry = {
            ...entry,
            date,
            servings,
            sourceKind:
              entry.sourceKind ??
              (entry.presetId ? "informed" : entry.aiMode ? "estimated" : "informed"),
            confidence: entry.confidence ?? (entry.sourceKind === "estimated" ? 0.5 : 1),
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          };
          mealId = full.id;
          let next = syncMealCount({ ...prev, meals: [...prev.meals, full] }, date);
          next = withSnapshot(next);
          const mealsBefore = prev.meals.filter((m) => m.date.slice(0, 10) === date).length;
          if (mealsBefore * XP.meal < XP.mealCap) {
            const awarded = applyXpAward(next, XP.meal, date);
            next = afterXpSideEffects(prev, awarded.state, deviceId.current);
          }
          return next;
        });
        emitAppEvent(
          deviceId.current,
          "meal_logged",
          {
            mealId,
            date: entry.date ?? todayKey(),
            proteinG: entry.proteinG,
            sourceKind: entry.sourceKind ?? "informed",
          },
          { entityType: "meal", entityId: mealId },
        );
        if (deviceId.current) {
          const mealAction: {
            deviceId: string;
            date: string;
            actionKind: string;
            status: string;
            entityType: string;
            entityId: string;
            mealSlot?: string;
          } = {
            deviceId: deviceId.current,
            date: (entry.date ?? todayKey()).slice(0, 10),
            actionKind: "meal_logged",
            status: "completed",
            entityType: "meal",
            entityId: mealId,
          };
          if (entry.slot) mealAction.mealSlot = entry.slot;
          recordDecisionActionBestEffort(mealAction);
        }
        if (entry.aiMode || entry.sourceKind === "estimated") {
          emitAppEvent(
            deviceId.current,
            "meal_ai_used",
            { mealId, mode: entry.aiMode ?? "text", confidence: entry.confidence ?? 0.5 },
            { entityType: "meal", entityId: mealId },
          );
        }
      },
      removeMealEntry: (id) => {
        const target = stateRef.current.meals.find((m) => m.id === id);
        update((s) => {
          const meals = s.meals.filter((m) => m.id !== id);
          const next = target ? syncMealCount({ ...s, meals }, target.date) : { ...s, meals };
          return withSnapshot(next);
        });
        if (target) {
          emitAppEvent(
            deviceId.current,
            "meal_deleted",
            { mealId: id, date: target.date.slice(0, 10) },
            { entityType: "meal", entityId: id },
          );
        }
      },
      updateMealEntry: (id, patch) => {
        update((s) => {
          const meals = s.meals.map((m) => {
            if (m.id !== id) return m;
            const prevServings = m.servings ?? 1;
            const servings = patch.servings ?? prevServings;
            let proteinG = patch.proteinG ?? m.proteinG;
            let kcal = patch.kcal ?? m.kcal;

            if (patch.servings != null && patch.proteinG == null && patch.kcal == null) {
              const preset = m.presetId ? presetById(m.presetId) : undefined;
              if (preset) {
                const scaled = scalePreset(preset, servings);
                proteinG = scaled.proteinG;
                kcal = scaled.kcal;
              } else {
                const ratio = servings / Math.max(prevServings, 0.25);
                proteinG = Math.round(m.proteinG * ratio);
                kcal = Math.round(m.kcal * ratio);
              }
            }

            return {
              ...m,
              ...patch,
              servings,
              proteinG,
              kcal,
              sourceKind: patch.sourceKind ?? m.sourceKind,
              confidence: patch.confidence ?? m.confidence,
              correctedFromAi: patch.correctedFromAi ?? m.correctedFromAi,
            };
          });
          const target = meals.find((m) => m.id === id);
          const base = target ? syncMealCount({ ...s, meals }, target.date) : { ...s, meals };
          return withSnapshot(base);
        });
        emitAppEvent(
          deviceId.current,
          "meal_updated",
          { mealId: id, date: todayKey() },
          { entityType: "meal", entityId: id },
        );
      },
      toggleFavoriteMeal: (presetId) =>
        update((s) => {
          const ids = s.favoriteMealPresetIds ?? [];
          const next = ids.includes(presetId)
            ? ids.filter((x) => x !== presetId)
            : [...ids, presetId];
          return { ...s, favoriteMealPresetIds: next };
        }),
      toggleFavoriteFood: (foodId) =>
        update((s) => {
          const ids = s.favoriteFoodIds ?? [];
          const next = ids.includes(foodId)
            ? ids.filter((x) => x !== foodId)
            : [foodId, ...ids].slice(0, 60);
          return { ...s, favoriteFoodIds: next };
        }),
      saveMealTemplate: (meal) =>
        update((s) => {
          const saved: SavedMeal = {
            ...meal,
            id: meal.id ?? `saved-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            createdAt: new Date().toISOString(),
            items: meal.items ?? [],
          };
          const rest = (s.savedMeals ?? []).filter((m) => m.id !== saved.id);
          return { ...s, savedMeals: [saved, ...rest].slice(0, 40) };
        }),
      removeSavedMeal: (id) =>
        update((s) => ({
          ...s,
          savedMeals: (s.savedMeals ?? []).filter((m) => m.id !== id),
        })),
      upsertCustomFood: (input) => {
        const existing = input.id
          ? stateRef.current.customFoods?.find((f) => f.id === input.id)
          : undefined;
        const food = buildCustomFood({ ...input, id: existing?.id ?? input.id });
        if (existing) {
          food.createdAt = existing.createdAt;
          food.updatedAt = new Date().toISOString();
        }
        update((s) => {
          const next = upsertCustomFoodList(s.customFoods ?? [], food);
          applyUserCatalog(next);
          return { ...s, customFoods: next };
        });
        return food;
      },
      removeCustomFood: (id) =>
        update((s) => {
          const next = removeCustomFoodFromList(s.customFoods ?? [], id);
          applyUserCatalog(next);
          return { ...s, customFoods: next };
        }),
      forkWeeklyPlan: (days, name) => {
        const plan = forkWeekPlan(days, name);
        update((s) => ({
          ...s,
          savedTrainingPlans: upsertSavedTrainingPlan(s.savedTrainingPlans ?? [], plan),
        }));
        return plan;
      },
      saveDayAsRoutine: (day, name) => {
        const plan = forkDayPlan(day, name);
        update((s) => ({
          ...s,
          savedTrainingPlans: upsertSavedTrainingPlan(s.savedTrainingPlans ?? [], plan),
        }));
        return plan;
      },
      removeTrainingPlan: (id) =>
        update((s) => ({
          ...s,
          savedTrainingPlans: removeSavedTrainingPlan(s.savedTrainingPlans ?? [], id),
          activeTrainingPlanId: s.activeTrainingPlanId === id ? null : s.activeTrainingPlanId,
          activeTrainingPlanWeekKey:
            s.activeTrainingPlanId === id ? null : s.activeTrainingPlanWeekKey,
        })),
      activateTrainingPlan: (id) =>
        update((s) => {
          let history = s.trainingBlockHistory ?? [];
          if (s.activeTrainingBlock) {
            history = pushBlockHistory(
              history,
              archiveTrainingBlock(s.activeTrainingBlock, "left"),
            );
          }
          return withSnapshot({
            ...s,
            activeTrainingPlanId: id,
            activeTrainingPlanWeekKey: weekStartKey(),
            activeTrainingBlock: null,
            trainingBlockHistory: history,
          });
        }),
      clearActiveTrainingPlan: () =>
        update((s) =>
          withSnapshot({
            ...s,
            activeTrainingPlanId: null,
            activeTrainingPlanWeekKey: null,
          }),
        ),
      enrollInProgram: (programId) => {
        const program = listContentOsPrograms().find((p) => p.id === programId);
        if (!program) return false;
        const block = activeBlockFromProgram(program, listContentOsSessions(programId));
        if (!block) return false;
        update((s) => {
          let history = s.trainingBlockHistory ?? [];
          if (s.activeTrainingBlock) {
            history = pushBlockHistory(
              history,
              archiveTrainingBlock(s.activeTrainingBlock, "left"),
            );
          }
          return withSnapshot({
            ...s,
            activeTrainingBlock: block,
            trainingBlockHistory: history,
            activeTrainingPlanId: null,
            activeTrainingPlanWeekKey: null,
          });
        });
        return true;
      },
      leaveTrainingBlock: () =>
        update((s) => {
          if (!s.activeTrainingBlock) return s;
          return withSnapshot({
            ...s,
            activeTrainingBlock: null,
            trainingBlockHistory: pushBlockHistory(
              s.trainingBlockHistory,
              archiveTrainingBlock(s.activeTrainingBlock, "left"),
            ),
          });
        }),
      replacePrescribedExercise: (dayId, fromExerciseId, to) =>
        update((s) => {
          const patchEx = <
            T extends {
              exerciseId: string;
              name: string;
              sets: number;
              reps: string;
              restSec: number;
              suggestedLoad?: number;
              unit: "kg" | "corpo" | "min";
            },
          >(
            ex: T,
          ): T => {
            if (ex.exerciseId !== fromExerciseId) return ex;
            return {
              ...ex,
              exerciseId: to.exerciseId,
              name: to.name,
              sets: to.sets ?? ex.sets,
              reps: to.reps ?? ex.reps,
              restSec: to.restSec ?? ex.restSec,
              unit: to.unit ?? ex.unit,
              ...(to.suggestedLoad != null
                ? { suggestedLoad: to.suggestedLoad }
                : "suggestedLoad" in ex
                  ? { suggestedLoad: ex.suggestedLoad }
                  : {}),
            };
          };

          if (s.activeTrainingBlock) {
            const weeks = s.activeTrainingBlock.weeks.map((w) => ({
              ...w,
              days: w.days.map((d) =>
                d.id !== dayId ? d : { ...d, exercises: d.exercises.map(patchEx) },
              ),
            }));
            return withSnapshot({
              ...s,
              activeTrainingBlock: { ...s.activeTrainingBlock, weeks },
            });
          }

          const stickyId = s.activeTrainingPlanId;
          if (stickyId) {
            const plans = (s.savedTrainingPlans ?? []).map((p) => {
              if (p.id !== stickyId) return p;
              return {
                ...p,
                updatedAt: new Date().toISOString(),
                days: p.days.map((d) =>
                  d.id !== dayId ? d : { ...d, exercises: d.exercises.map(patchEx) },
                ),
              };
            });
            return withSnapshot({ ...s, savedTrainingPlans: plans });
          }

          return s;
        }),
      setExercisePreference: (exerciseId, preference) =>
        update((s) => {
          const mapped =
            preference === "like"
              ? "preferred"
              : preference === "dislike"
                ? "disliked"
                : preference === "clear"
                  ? "clear"
                  : preference;
          const current = migrateLegacyPrefs(s);
          const exercisePreferences = setPreference(current, exerciseId, mapped);
          const legacy = prefsToLegacyArrays(exercisePreferences);
          return {
            ...s,
            exercisePreferences,
            likedExerciseIds: legacy.likedExerciseIds,
            dislikedExerciseIds: legacy.dislikedExerciseIds,
          };
        }),
      setExercisePreferences: (prefs) =>
        update((s) => {
          const merged = { ...migrateLegacyPrefs(s), ...prefs };
          const legacy = prefsToLegacyArrays(merged);
          return {
            ...s,
            exercisePreferences: merged,
            likedExerciseIds: legacy.likedExerciseIds,
            dislikedExerciseIds: legacy.dislikedExerciseIds,
          };
        }),
      saveLivingPlanFeedback: (date, vote, reason) =>
        update((s) => ({
          ...s,
          livingPlanFeedback: {
            ...(s.livingPlanFeedback ?? {}),
            [date]: {
              vote,
              at: new Date().toISOString(),
              ...(reason ? { reason } : {}),
            },
          },
        })),
      toggleSupplement: (id) => {
        let took = false;
        update((s) => {
          const prev = withQuests(s, deviceId.current);
          const date = todayKey();
          const taken = prev.supplementLogs[date] ?? [];
          const already = taken.includes(id);
          took = !already;
          let doseLogs = [...(prev.supplementDoseLogs ?? [])];
          let frequencies = { ...(prev.supplementFrequencies ?? {}) };
          let nextTaken: string[];

          if (already) {
            // Remove today's routine_toggle doses for this product
            doseLogs = doseLogs.filter(
              (d) =>
                !(
                  d.productId === id &&
                  d.takenAt.slice(0, 10) === date &&
                  d.source === "routine_toggle"
                ),
            );
            nextTaken = taken.filter((t) => t !== id);
          } else {
            const def = defaultDoseFromProduct(id);
            const freq = (frequencies[id] ?? "1x_day") as DoseFrequency;
            const log: SupplementDoseLog = {
              id: `dose-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              productId: id,
              dose: def.dose,
              unit: def.unit,
              frequency: freq,
              takenAt: new Date().toISOString(),
              source: "routine_toggle",
            };
            doseLogs = [...doseLogs, log];
            frequencies[id] = freq;
            nextTaken = [...taken, id];
          }

          const rolled = rollupSupplementLogsFromDoses(
            { ...prev.supplementLogs, [date]: nextTaken },
            doseLogs,
          );

          let next: AppState = {
            ...prev,
            supplementLogs: rolled,
            supplementDoseLogs: doseLogs,
            supplementFrequencies: frequencies,
          };
          next = { ...next, restockEstimates: refreshRestock(next) };
          next = withSnapshot(next);
          const was = supplementsComplete(prev, date);
          const now = supplementsComplete(next, date);
          if (!was && now) {
            const awarded = applyXpAward(next, XP.supplementsComplete, date);
            next = afterXpSideEffects(prev, awarded.state, deviceId.current);
          }
          return next;
        });
        if (took) {
          emitAppEvent(
            deviceId.current,
            "supplement_taken",
            { productId: id, date: todayKey() },
            { entityType: "supplement", entityId: id },
          );
        } else {
          emitAppEvent(
            deviceId.current,
            "supplement_skipped",
            { productId: id, date: todayKey() },
            { entityType: "supplement", entityId: id },
          );
        }
      },
      logSupplementDose: (opts) => {
        update((s) => {
          const prev = withQuests(s, deviceId.current);
          const takenAt = opts.takenAt ?? new Date().toISOString();
          const date = takenAt.slice(0, 10);
          const log: SupplementDoseLog = {
            id: `dose-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            productId: opts.productId,
            dose: opts.dose,
            unit: opts.unit,
            frequency: opts.frequency,
            takenAt,
            source: opts.source ?? "manual",
          };
          const doseLogs = [...(prev.supplementDoseLogs ?? []), log];
          const frequencies = {
            ...(prev.supplementFrequencies ?? {}),
            [opts.productId]: opts.frequency,
          };
          const taken = new Set(prev.supplementLogs[date] ?? []);
          taken.add(opts.productId);
          const supplementLogs = {
            ...prev.supplementLogs,
            [date]: [...taken],
          };
          let next: AppState = {
            ...prev,
            supplementDoseLogs: doseLogs,
            supplementFrequencies: frequencies,
            supplementLogs,
          };
          next = { ...next, restockEstimates: refreshRestock(next) };
          next = withSnapshot(next);
          const was = supplementsComplete(prev, date);
          const nowDone = supplementsComplete(next, date);
          if (!was && nowDone) {
            const awarded = applyXpAward(next, XP.supplementsComplete, date);
            next = afterXpSideEffects(prev, awarded.state, deviceId.current);
          }
          return next;
        });
        emitAppEvent(
          deviceId.current,
          "supplement_taken",
          {
            productId: opts.productId,
            dose: opts.dose,
            unit: opts.unit,
            frequency: opts.frequency,
            takenAt: opts.takenAt ?? new Date().toISOString(),
          },
          { entityType: "supplement", entityId: opts.productId },
        );
      },
      removeSupplementDose: (id) => {
        update((s) => {
          const doseLogs = (s.supplementDoseLogs ?? []).filter((d) => d.id !== id);
          const next: AppState = {
            ...s,
            supplementDoseLogs: doseLogs,
            restockEstimates: refreshRestock({ ...s, supplementDoseLogs: doseLogs }),
          };
          return withSnapshot(next);
        });
      },
      setRoutine: (ids) => update((s) => ({ ...s, supplementRoutine: ids })),
      toggleChallenge: (id) => {
        const current = stateRef.current;
        const joining = !current.challenges.includes(id);
        const challenge = challengeById(id);
        const baseline = challenge
          ? challengeRawValue(challenge, current.sessions, current.activityLogs, {
              invitesSent: current.challengeInvitesSent ?? 0,
            })
          : 0;
        const personalTarget =
          challenge && isPersonalizedChallenge(challenge)
            ? computePersonalTarget(challenge, baseline)
            : undefined;
        update((s) => {
          if (joining) {
            const nextTargets = { ...(s.challengePersonalTargets ?? {}) };
            if (personalTarget !== undefined) nextTargets[id] = personalTarget;
            const next = {
              ...s,
              challenges: [...s.challenges, id],
              challengeBaselines: { ...(s.challengeBaselines ?? {}), [id]: baseline },
              challengePersonalTargets: nextTargets,
            };
            return grantPendingAchievements(next).state;
          }
          const nextBaselines = { ...(s.challengeBaselines ?? {}) };
          const nextTargets = { ...(s.challengePersonalTargets ?? {}) };
          delete nextBaselines[id];
          delete nextTargets[id];
          return {
            ...s,
            challenges: s.challenges.filter((c) => c !== id),
            challengeBaselines: nextBaselines,
            challengePersonalTargets: nextTargets,
          };
        });
        if (joining) {
          emitAppEvent(
            deviceId.current,
            "challenge_joined",
            { challengeId: id, personalTarget },
            { entityType: "challenge", entityId: id },
          );
        }
        if (!deviceId.current || !current.profile || current.shareProgress === false) return;
        const name = current.profile.name;
        if (joining && challenge) {
          const progress = challengeProgress(challenge, current.sessions, {
            baseline,
            personalTarget,
            activityLogs: current.activityLogs,
            invitesSent: current.challengeInvitesSent ?? 0,
          });
          void joinChallengeRemote(deviceId.current, id, name, baseline, personalTarget)
            .then(() =>
              syncChallengeProgress(deviceId.current, id, progress.current, name, {
                baseline: progress.baseline,
                pct: progress.pct,
                complete: progress.complete,
                personalTarget: progress.personalTarget,
                proofStatus: "self_reported",
                proofSource:
                  challenge.metric === "steps" || challenge.metric === "football_sessions"
                    ? "app_manual"
                    : "app_session",
              }),
            )
            .catch((e) => console.error("Falha ao entrar no desafio remoto", e));
        } else {
          void leaveChallengeRemote(deviceId.current, id).catch((e) =>
            console.error("Falha ao sair do desafio remoto", e),
          );
        }
      },
      bumpChallengeInvitesSent: () =>
        update((s) => ({ ...s, challengeInvitesSent: (s.challengeInvitesSent ?? 0) + 1 })),
      dismissCoachNudge: () =>
        update((s) => ({ ...s, coachNudgeDismissedAt: new Date().toISOString() })),
      markCoachNudgeShown: () =>
        update((s) => ({ ...s, coachNudgeShownAt: new Date().toISOString() })),
      logActivity: (kind, value, date) => {
        const day = date ?? todayKey();
        const fraud = validateActivityLog({ kind, value, date: day });
        const policy = applyFraudPolicy(fraud);
        if (policy.action === "block_input") {
          return { ok: false, message: policy.userMessage ?? "Valor inválido" };
        }
        const entry: ActivityLogEntry = {
          id: crypto.randomUUID(),
          date: day,
          kind,
          value,
          source: "app_manual",
          status: "self_reported",
        };
        update((s) => ({
          ...s,
          activityLogs: [...(s.activityLogs ?? []), entry],
          lastFraudWarning: policy.action === "warn" ? policy.userMessage : s.lastFraudWarning,
        }));
        if (deviceId.current) {
          void syncAllJoinedChallenges(stateRef.current, deviceId.current).catch(() => undefined);
        }
        const out: { ok: true; warning?: string } = { ok: true };
        if (policy.action === "warn" && policy.userMessage) out.warning = policy.userMessage;
        return out;
      },
      ingestActivityLogs: (entries) => {
        if (!entries.length) return;
        update((s) => ({
          ...s,
          activityLogs: mergeActivityLogs(s.activityLogs ?? [], entries),
        }));
        if (deviceId.current) {
          const current = stateRef.current;
          let warning: string | null = current.lastFraudWarning;
          for (const id of current.challenges ?? []) {
            const challenge = challengeById(id);
            if (!challenge) continue;
            const progressOpts: import("@/lib/social").ChallengeProgressOpts = {
              activityLogs: current.activityLogs,
            };
            if (current.challengeBaselines?.[id] != null)
              progressOpts.baseline = current.challengeBaselines[id];
            if (current.challengePersonalTargets?.[id] != null) {
              progressOpts.personalTarget = current.challengePersonalTargets[id];
            }
            const progress = challengeProgress(challenge, current.sessions, progressOpts);
            const fraudInput: import("@/lib/engine/anti-fraud").ChallengeProgressInput = {
              value: progress.current,
              baseline: progress.baseline,
              metric: challenge.metric,
            };
            if (progress.personalTarget != null)
              fraudInput.personalTarget = progress.personalTarget;
            const fraud = validateChallengeProgress(fraudInput);
            const policy = applyFraudPolicy(fraud);
            if (policy.action === "warn" && policy.userMessage) warning = policy.userMessage;
          }
          if (warning !== current.lastFraudWarning) {
            update((s) => ({ ...s, lastFraudWarning: warning }));
          }
          void syncAllJoinedChallenges(stateRef.current, deviceId.current).catch(() => undefined);
        }
      },
      setWearableConnection: (conn) =>
        update((s) => {
          const rest = (s.wearableConnections ?? []).filter((c) => c.provider !== conn.provider);
          return { ...s, wearableConnections: [...rest, conn] };
        }),
      toggleHub: (hubId) => {
        const current = stateRef.current;
        const hub = hubById(hubId);
        if (!hub) return;
        const joining = !(current.joinedHubIds ?? []).includes(hubId);
        const name = current.profile?.name ?? "Soldado";

        if (joining) {
          const baselines = { ...(current.challengeBaselines ?? {}) };
          const challenges = [...current.challenges];
          for (const cid of hub.challengeIds) {
            if (challenges.includes(cid)) continue;
            const challenge = challengeById(cid);
            if (!challenge) continue;
            challenges.push(cid);
            baselines[cid] = challengeRawValue(challenge, current.sessions, current.activityLogs);
          }
          update((s) => ({
            ...s,
            joinedHubIds: [...(s.joinedHubIds ?? []), hubId],
            challenges,
            challengeBaselines: baselines,
          }));
          if (deviceId.current && current.shareProgress !== false) {
            void joinHubRemote(deviceId.current, hubId, name)
              .then(async () => {
                for (const cid of hub.challengeIds) {
                  const challenge = challengeById(cid);
                  if (!challenge) continue;
                  const baseline =
                    baselines[cid] ??
                    challengeRawValue(challenge, current.sessions, current.activityLogs);
                  const progress = challengeProgress(challenge, current.sessions, {
                    baseline,
                    activityLogs: current.activityLogs,
                  });
                  const proof = challengeProofFromLogs(
                    challenge.metric,
                    current.activityLogs ?? [],
                    challenge.durationDays,
                  );
                  await joinChallengeRemote(deviceId.current, cid, name, baseline).catch(
                    () => undefined,
                  );
                  const hubSync: {
                    baseline?: number;
                    pct?: number;
                    complete?: boolean;
                    personalTarget?: number;
                    proofStatus?: string;
                    proofSource?: string;
                  } = {
                    baseline: progress.baseline,
                    pct: progress.pct,
                    complete: progress.complete,
                    proofStatus: proof.status,
                    proofSource: proof.source,
                  };
                  if (progress.personalTarget != null)
                    hubSync.personalTarget = progress.personalTarget;
                  await syncChallengeProgress(
                    deviceId.current,
                    cid,
                    progress.current,
                    name,
                    hubSync,
                  ).catch(() => undefined);
                }
              })
              .catch((e) => console.error("Falha ao entrar no hub remoto", e));
          }
        } else {
          update((s) => ({
            ...s,
            joinedHubIds: (s.joinedHubIds ?? []).filter((id) => id !== hubId),
          }));
          if (deviceId.current) {
            void leaveHubRemote(deviceId.current, hubId).catch((e) =>
              console.error("Falha ao sair do hub remoto", e),
            );
          }
        }
      },
      pushChat: (role, text) =>
        update((s) => ({
          ...s,
          chat: [
            ...s.chat,
            { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, text },
          ],
        })),
      setTheme: (theme) => update((s) => ({ ...s, theme })),
      setShareProgress: (share) =>
        update((s) => {
          const privacy = privacyFromLegacyShareProgress(share);
          if (deviceId.current) {
            void saveSocialPrivacyRemote(deviceId.current, privacy).catch(() => undefined);
          }
          return { ...s, shareProgress: share, socialPrivacy: privacy };
        }),
      setSocialPrivacy: (privacy) =>
        update((s) => {
          const next = normalizeSocialPrivacy(privacy, s.shareProgress);
          if (deviceId.current) {
            void saveSocialPrivacyRemote(deviceId.current, next).catch(() => undefined);
          }
          return { ...s, socialPrivacy: next, shareProgress: isSocialSharingEnabled(next) };
        }),
      setSessionFx: (enabled) => update((s) => ({ ...s, sessionFx: enabled })),
      setRemindersEnabled: (enabled) => update((s) => ({ ...s, remindersEnabled: enabled })),
      setReminderHour: (hour) =>
        update((s) => ({ ...s, reminderHour: Math.min(22, Math.max(6, Math.round(hour))) })),
      setPushPrefs: (prefs) =>
        update((s) => ({
          ...s,
          pushPrefs: { ...(s.pushPrefs ?? emptyState.pushPrefs), ...prefs },
        })),
      acceptLegal: (kind) =>
        update((s) => {
          const at = new Date().toISOString();
          if (kind === "terms") return { ...s, termsAcceptedAt: s.termsAcceptedAt ?? at };
          if (kind === "privacy") return { ...s, privacyAcceptedAt: s.privacyAcceptedAt ?? at };
          return { ...s, healthPurposeAckAt: s.healthPurposeAckAt ?? at };
        }),
      markTipSeen: (id) =>
        update((s) => {
          const seen = s.seenOnboardingTips ?? [];
          if (seen.includes(id)) return s;
          return { ...s, seenOnboardingTips: [...seen, id] };
        }),
      earnBadge: (id) => {
        if (state.earnedBadges.includes(id)) return false;
        update((s) =>
          s.earnedBadges.includes(id) ? s : { ...s, earnedBadges: [...s.earnedBadges, id] },
        );
        if (deviceId.current && state.shareProgress && state.profile) {
          void publishBadgeEvent(deviceId.current, state.profile.name, id).catch((err) =>
            console.warn("publishBadgeEvent failed", err),
          );
        }
        return true;
      },
      recordDimensionSnapshot: () => update((s) => withSnapshot(s)),
      useStreakFreeze: () => {
        const s = stateRef.current;
        const date = todayKey();
        if ((s.streakFreezes ?? 0) <= 0) return false;
        if ((s.freezeUsedDates ?? []).includes(date)) return false;
        if (s.sessions.some((x) => x.date.slice(0, 10) === date)) return false;
        update((prev) => {
          const next = {
            ...prev,
            streakFreezes: Math.max(0, (prev.streakFreezes ?? 0) - 1),
            freezeUsedDates: [...(prev.freezeUsedDates ?? []), date],
          };
          if (deviceId.current && next.shareProgress && next.profile) {
            void publishRetentionEvent(deviceId.current, next.profile.name, "freeze_used", {
              date,
            }).catch(() => undefined);
          }
          return next;
        });
        return true;
      },
      markQuestCoachOpened: () =>
        update((s) => bumpManualQuest(withQuests(s, deviceId.current), "coach")),
      markQuestKudos: () => {
        update((s) => {
          const prev = withQuests(s, deviceId.current);
          let next = bumpManualQuest(prev, "kudos");
          const awarded = applyXpAward(next, XP.kudos);
          // Cap kudos XP via checking progress — simple: only if quest exists and under cap using a counter in progress
          const kudosCount =
            (prev.dailyQuestProgress?.["q-kudos"] ?? 0) +
            (prev.dailyQuestProgress?.["__kudos_xp"] ?? 0);
          if (kudosCount < XP.kudosCap) {
            next = {
              ...awarded.state,
              dailyQuestProgress: {
                ...awarded.state.dailyQuestProgress,
                __kudos_xp: (prev.dailyQuestProgress?.["__kudos_xp"] ?? 0) + 1,
              },
            };
          }
          return afterXpSideEffects(prev, next, deviceId.current);
        });
      },
      setBio: (bio) => update((s) => ({ ...s, bio: bio.slice(0, 160) })),
      setAvatarUrl: (url) => update((s) => ({ ...s, avatarUrl: url })),
      setAuthUserId: (id) => update((s) => ({ ...s, authUserId: id })),
      setAccessGranted: async (opts) => {
        const email = opts.email.trim().toLowerCase();
        const grantedAt = new Date().toISOString();
        const productIds = (opts.productIds ?? []).slice(0, 5);
        const accessTier = opts.accessTier ?? "base";
        const restockEstimates = opts.restockEstimates ?? {};
        const lastPaidAt = opts.lastPaidAt ?? null;
        const accessExpiresAt = opts.accessExpiresAt ?? null;
        const shopifyDisplayName = opts.shopifyDisplayName ?? null;
        update((s) => {
          const applyRoutine = s.supplementRoutine.length === 0 && productIds.length > 0;
          const badges = new Set(s.cosmeticBadges ?? []);
          badges.add("cliente-soldiers");
          const nextRestock = Object.keys(restockEstimates).length
            ? refreshRestock(s, restockEstimates)
            : refreshRestock(s);
          return {
            ...s,
            accessGranted: true,
            accessEmail: email,
            accessGrantedAt: grantedAt,
            lastPurchaseAt: lastPaidAt ?? s.lastPurchaseAt,
            accessExpiresAt: accessExpiresAt ?? s.accessExpiresAt,
            shopifyDisplayName: shopifyDisplayName ?? s.shopifyDisplayName,
            accessTier,
            purchaseProductIds: productIds.length ? productIds : s.purchaseProductIds,
            restockEstimates: nextRestock,
            supplementRoutine: applyRoutine ? productIds : s.supplementRoutine,
            routineFromPurchase: applyRoutine || s.routineFromPurchase,
            cosmeticBadges: [...badges],
            ...(shopifyDisplayName && s.profile && !s.profile.name.trim()
              ? { profile: { ...s.profile, name: shopifyDisplayName } }
              : {}),
          };
        });
        try {
          const session = await establishAccessSession({
            data: {
              email,
              deviceId: deviceId.current,
            },
          });
          if (session.ok) {
            update((s) => ({
              ...s,
              accessTier: session.tier,
              purchaseProductIds: session.productIds?.length
                ? session.productIds
                : s.purchaseProductIds,
              userId: session.userId ?? s.userId,
              lastPurchaseAt: session.lastPaidAt ?? s.lastPurchaseAt,
              accessExpiresAt: session.accessExpiresAt ?? s.accessExpiresAt,
              shopifyDisplayName: session.shopifyDisplayName ?? s.shopifyDisplayName,
              restockEstimates: session.restockEstimates
                ? enrichRestockConfidence(
                    { ...s.restockEstimates, ...session.restockEstimates },
                    s.supplementLogs,
                  )
                : enrichRestockConfidence(s.restockEstimates ?? {}, s.supplementLogs),
            }));
          } else {
            update((s) => ({ ...s, accessGranted: false }));
          }
        } catch (e) {
          console.warn("establishAccessSession failed", e);
        }
      },
      updateAccessFromSession: (opts) => {
        update((s) => ({
          ...s,
          accessGranted: true,
          accessEmail: opts.email,
          accessTier: opts.tier,
          accessGrantedAt: s.accessGrantedAt ?? new Date().toISOString(),
          lastPurchaseAt: opts.lastPaidAt ?? s.lastPurchaseAt,
        }));
      },
      revokeAccessLocal: () => {
        update((s) => ({
          ...s,
          accessGranted: false,
        }));
      },
      dismissRoutineFromPurchase: () =>
        update((s) => ({ ...s, routineFromPurchaseDismissed: true })),
      markUpsellShown: () => update((s) => ({ ...s, upsellShownDate: todayKey() })),
      saveDayCheckIn: (checkIn) => {
        const date = checkIn.date ?? todayKey();
        const prevVersion = stateRef.current.dayCheckIns?.[date]?.version ?? 0;
        const full: DayCheckIn = {
          date,
          sleepHours: checkIn.sleepHours,
          energy: checkIn.energy,
          availableMin: checkIn.availableMin,
          version: prevVersion + 1,
          ...(checkIn.noEquipment ? { noEquipment: true } : {}),
          ...(checkIn.equipment ? { equipment: checkIn.equipment } : {}),
          ...(checkIn.acceptedTrainingMode
            ? { acceptedTrainingMode: checkIn.acceptedTrainingMode }
            : {}),
          ...(checkIn.soreness != null ? { soreness: checkIn.soreness } : {}),
          ...(checkIn.stress != null ? { stress: checkIn.stress } : {}),
          ...(checkIn.notes ? { notes: checkIn.notes.slice(0, 280) } : {}),
          ...(checkIn.lunchOutToday ? { lunchOutToday: true } : {}),
          ...(Array.isArray(checkIn.skippedSlots) ? { skippedSlots: checkIn.skippedSlots } : {}),
        };
        const prevCtx = stateRef.current.decisionContextByDate ?? {};
        const restCtx = { ...prevCtx };
        delete restCtx[date];
        const nextState = withSnapshot({
          ...stateRef.current,
          dayCheckIns: { ...(stateRef.current.dayCheckIns ?? {}), [date]: full },
          decisionContextByDate: restCtx,
        });
        update(() => nextState);
        if (nextState.livingPlans?.[date]?.workout.mode === "rest") {
          emitAppEvent(
            deviceId.current,
            "workout_skipped",
            { date, reason: "rest_day" },
            { entityType: "workout", entityId: date },
          );
          if (deviceId.current) {
            recordDecisionActionBestEffort({
              deviceId: deviceId.current,
              date,
              actionKind: "rest_taken",
              status: "completed",
              primaryKind: "rest",
            });
          }
        }
        emitAppEvent(
          deviceId.current,
          "checkin_completed",
          {
            date,
            sleepHours: full.sleepHours,
            energy: full.energy,
            availableMin: full.availableMin,
            ...(full.soreness != null ? { soreness: full.soreness } : {}),
            ...(full.stress != null ? { stress: full.stress } : {}),
          },
          { entityType: "day_checkin", entityId: date },
        );
        emitAppEvent(
          deviceId.current,
          "plan_modified",
          { date, reason: "checkin" },
          { entityType: "plan", entityId: date },
        );
        if (deviceId.current) {
          enqueueEntity({
            opId: `day_checkin:${date}`,
            kind: "entity",
            createdAt: new Date().toISOString(),
            deviceId: deviceId.current,
            entity: "day_checkin",
            payload: { ...full },
            version: full.version ?? 1,
          });
          void flushOutbox().catch(() => undefined);
          void refreshDecisionContextBestEffort(deviceId.current, date).then((snap) => {
            if (!snap) return;
            update((s) => applyDecisionContextToState(s, snap));
          });
          recordNextDayCheckInBestEffort(deviceId.current, {
            date,
            energy: full.energy,
            sleepHours: full.sleepHours,
          });
          void persistUserPatterns({
            data: {
              deviceId: deviceId.current,
              patterns: buildPatternsBlobV2(nextState),
            },
          }).catch(() => undefined);
        }
      },
      refreshLivingPlan: () => {
        const date = todayKey();
        let rebuilt = false;
        update((s) => {
          const cached = s.decisionContextByDate?.[date];
          if (cached?.source === "server") return s;
          rebuilt = true;
          return withSnapshot(s);
        });
        if (deviceId.current) {
          void refreshDecisionContextBestEffort(deviceId.current, date).then((snap) => {
            if (!snap) return;
            update((cur) => applyDecisionContextToState(cur, snap));
          });
        }
        if (rebuilt) {
          emitAppEvent(
            deviceId.current,
            "plan_modified",
            { date, reason: "refresh" },
            { entityType: "plan", entityId: date },
          );
        }
      },
      reset: () => {
        skipPush.current = true;
        setState(emptyState);
        applyUserCatalog([]);
        applyTheme("dark");
        if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
        // Local-only clear — does not wipe server account data
      },
      clearAccountData: async () => {
        skipPush.current = true;
        setState(emptyState);
        applyUserCatalog([]);
        applyTheme("dark");
        if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
        const { clearUserDataFn } = await import("@/lib/sync.functions");
        return clearUserDataFn({ data: { deviceId: deviceId.current } });
      },
    }),
    [state, hydrated, update, lastSessionXp],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore precisa estar dentro de StoreProvider");
  return ctx;
}

export function todaySupplements(state: AppState) {
  return state.supplementLogs[todayKey()] ?? [];
}

export function todayMetrics(state: AppState) {
  return state.days[todayKey()] ?? { date: todayKey(), waterMl: 0, meals: 0 };
}
