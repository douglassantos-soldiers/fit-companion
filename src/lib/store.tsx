import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { allQuestsComplete, bumpManualQuest, ensureDailyQuests } from "@/data/daily-quests";
import { presetById } from "@/data/meal-presets";
import { performanceDimensions } from "@/lib/engine/dimensions";
import { buildLivingPlan } from "@/lib/engine/living-plan";
import { scalePreset } from "@/lib/engine/nutrition";
import { applyXpAward, dailyXpGoalMet, supplementsComplete, waterGoalReached, XP } from "@/lib/engine/xp";
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
} from "@/lib/social";
import { challengeById } from "@/data/challenges";
import { hubById } from "@/data/hubs";
import { joinHub as joinHubRemote, leaveHub as leaveHubRemote } from "@/lib/hubs";
import { clearRemoteState, getDeviceId, pullState, pushState } from "@/lib/sync";
import { fetchEntitlement } from "@/lib/entitlements";
import { establishAccessSession } from "@/lib/access.functions";
import { ensureIdentityForDevice } from "@/lib/identity.functions";
import { clearLocalReminders, scheduleLocalReminders } from "@/lib/notifications";
import { planDayForToday, buildWeeklyPlan } from "@/lib/engine/plan";
import { learningWeekHint } from "@/lib/engine/learning";
import { rollCosmeticReward } from "@/lib/engine/rewards";
import {
  emptyState,
  todayKey,
  type AppState,
  type DayCheckIn,
  type MealEntry,
  type Profile,
  type SessionLog,
  type Theme,
} from "@/lib/types";

const KEY = "soldiers-os-v1";

interface Store {
  state: AppState;
  hydrated: boolean;
  deviceId: string;
  setProfile: (p: Profile) => void;
  addSession: (s: SessionLog, opts?: { imageUrl?: string }) => void;
  addWeight: (kg: number) => void;
  addWater: (ml: number) => void;
  addMealEntry: (entry: Omit<MealEntry, "id" | "date"> & { date?: string; servings?: number }) => void;
  removeMealEntry: (id: string) => void;
  updateMealEntry: (
    id: string,
    patch: Partial<Pick<MealEntry, "label" | "slot" | "servings" | "proteinG" | "kcal" | "quality">>,
  ) => void;
  toggleFavoriteMeal: (presetId: string) => void;
  toggleSupplement: (id: string) => void;
  setRoutine: (ids: string[]) => void;
  toggleChallenge: (id: string) => void;
  toggleHub: (hubId: string) => void;
  pushChat: (role: "coach" | "user", text: string) => void;
  setTheme: (theme: Theme) => void;
  setShareProgress: (share: boolean) => void;
  setSessionFx: (enabled: boolean) => void;
  setRemindersEnabled: (enabled: boolean) => void;
  setReminderHour: (hour: number) => void;
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
  }) => Promise<void>;
  /** Sync UX flag from validated server cookie (no entitlement write). */
  updateAccessFromSession: (opts: { email: string; tier: "base" | "performance" }) => void;
  /** Clear local grant when server session is missing. */
  revokeAccessLocal: () => void;
  dismissRoutineFromPurchase: () => void;
  markUpsellShown: () => void;
  saveDayCheckIn: (checkIn: Omit<DayCheckIn, "date"> & { date?: string }) => void;
  refreshLivingPlan: () => void;
  lastSessionXp: number;
  reset: () => void;
}

const StoreContext = createContext<Store | null>(null);

function load(): AppState {
  if (typeof window === "undefined") return emptyState;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyState;
    return { ...emptyState, ...(JSON.parse(raw) as AppState) };
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
  const date = todayKey();
  const dims = performanceDimensions(s, s.profile);
  const scores = Object.fromEntries(dims.map((d) => [d.key, d.score]));
  const rest = s.dimensionSnapshots.filter((x) => x.date !== date);
  const withDims: AppState = {
    ...s,
    dayCheckIns: s.dayCheckIns ?? {},
    livingPlans: s.livingPlans ?? {},
    challengeBaselines: s.challengeBaselines ?? {},
    joinedHubIds: s.joinedHubIds ?? [],
    dimensionSnapshots: [...rest, { date, scores }].sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
  const plan = buildLivingPlan(withDims, date);
  if (!plan) return withDims;
  return {
    ...withDims,
    livingPlans: { ...withDims.livingPlans, [date]: plan },
  };
}

function syncMealCount(s: AppState, date: string): AppState {
  const count = s.meals.filter((m) => m.date === date).length;
  const d = s.days[date] ?? { date, waterMl: 0, meals: 0 };
  return { ...s, days: { ...s.days, [date]: { ...d, meals: count } } };
}

function withQuests(s: AppState, deviceId: string): AppState {
  return ensureDailyQuests(s, deviceId);
}

function afterXpSideEffects(
  prev: AppState,
  next: AppState,
  deviceId: string,
  opts?: { fromSession?: SessionLog },
): AppState {
  let out = next;
  const date = todayKey();
  if (allQuestsComplete(out, date) && !allQuestsComplete(prev, date)) {
    const bonus = applyXpAward(out, XP.questsCompleteBonus, date);
    out = bonus.state;
  }
  if (dailyXpGoalMet(out, date) && !dailyXpGoalMet(prev, date) && out.profile && out.shareProgress && deviceId) {
    void publishRetentionEvent(deviceId, out.profile.name, "xp_goal", { xp: out.xpByDate[date] ?? 0 }).catch(
      (err) => console.warn("publishRetentionEvent failed", err),
    );
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

  const deviceId = useRef("");
  const skipPush = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const local = load();
    const id = getDeviceId();
    deviceId.current = id;
    setState(withQuests({ ...emptyState, ...local }, id));
    applyTheme(local.theme ?? "dark");
    setHydrated(true);

    void (async () => {
      try {
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

        const [remote, entitlement] = await Promise.all([pullState(id), fetchEntitlement(id)]);
        const accessFromRemote = entitlement
          ? {
              accessGranted: true,
              accessEmail: entitlement.email,
              accessGrantedAt: entitlement.grantedAt,
              accessTier: entitlement.accessTier,
              purchaseProductIds: entitlement.productIds,
            }
          : {};

        if (remote) {
          skipPush.current = true;
          const merged = withQuests(
            {
              ...emptyState,
              ...remote,
              meals: remote.meals?.length ? remote.meals : local.meals ?? [],
              theme: local.theme ?? remote.theme ?? "dark",
              earnedBadges: local.earnedBadges?.length ? local.earnedBadges : remote.earnedBadges ?? [],
              dimensionSnapshots: local.dimensionSnapshots?.length
                ? local.dimensionSnapshots
                : remote.dimensionSnapshots ?? [],
              shareProgress: local.shareProgress ?? remote.shareProgress ?? true,
              sessionFx: local.sessionFx ?? remote.sessionFx ?? true,
              favoriteMealPresetIds: local.favoriteMealPresetIds ?? remote.favoriteMealPresetIds ?? [],
              remindersEnabled: local.remindersEnabled ?? false,
              reminderHour: local.reminderHour ?? remote.reminderHour ?? 18,
              seenOnboardingTips: local.seenOnboardingTips ?? remote.seenOnboardingTips ?? [],
              xpByDate: { ...(remote.xpByDate ?? {}), ...(local.xpByDate ?? {}) },
              streakFreezes: local.streakFreezes ?? remote.streakFreezes ?? 1,
              freezeUsedDates: [
                ...new Set([...(remote.freezeUsedDates ?? []), ...(local.freezeUsedDates ?? [])]),
              ],
              xpGoalMetDates: [
                ...new Set([...(remote.xpGoalMetDates ?? []), ...(local.xpGoalMetDates ?? [])]),
              ],
              dailyQuestIds: local.dailyQuestDate === todayKey() ? local.dailyQuestIds : remote.dailyQuestIds,
              dailyQuestDate: local.dailyQuestDate === todayKey() ? local.dailyQuestDate : remote.dailyQuestDate,
              dailyQuestProgress:
                local.dailyQuestDate === todayKey() ? local.dailyQuestProgress : remote.dailyQuestProgress,
              cosmeticBadges: [
                ...new Set([...(remote.cosmeticBadges ?? []), ...(local.cosmeticBadges ?? [])]),
              ],
              authUserId: local.authUserId ?? remote.authUserId ?? null,
              userId: resolvedUserId ?? local.userId ?? remote.userId ?? null,
              bio: local.bio || remote.bio || "",
              avatarUrl: local.avatarUrl ?? remote.avatarUrl ?? null,
              accessGranted:
                entitlement != null ||
                local.accessGranted === true ||
                remote.accessGranted === true,
              accessEmail:
                entitlement?.email ?? local.accessEmail ?? remote.accessEmail ?? null,
              accessGrantedAt:
                entitlement?.grantedAt ?? local.accessGrantedAt ?? remote.accessGrantedAt ?? null,
              accessTier:
                entitlement?.accessTier ?? local.accessTier ?? remote.accessTier ?? "base",
              purchaseProductIds:
                entitlement?.productIds?.length
                  ? entitlement.productIds
                  : local.purchaseProductIds?.length
                    ? local.purchaseProductIds
                    : remote.purchaseProductIds ?? [],
              restockEstimates:
                Object.keys(local.restockEstimates ?? {}).length
                  ? local.restockEstimates
                  : remote.restockEstimates ?? {},
              routineFromPurchase: local.routineFromPurchase || remote.routineFromPurchase || false,
              routineFromPurchaseDismissed:
                local.routineFromPurchaseDismissed || remote.routineFromPurchaseDismissed || false,
              upsellShownDate: local.upsellShownDate ?? remote.upsellShownDate ?? null,
              ...accessFromRemote,
            },
            id,
          );
          setState(merged);
          applyTheme(merged.theme ?? "dark");
        } else {
          if (entitlement) {
            skipPush.current = true;
            setState((s) =>
              withQuests(
                {
                  ...s,
                  accessGranted: true,
                  accessEmail: entitlement.email,
                  accessGrantedAt: entitlement.grantedAt,
                  accessTier: entitlement.accessTier,
                  purchaseProductIds: entitlement.productIds,
                },
                id,
              ),
            );
          }
          if (local.profile) {
            void pushState(id, withQuests({ ...emptyState, ...local, ...accessFromRemote }, id));
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

  useEffect(() => {
    if (!hydrated) return;
    applyTheme(state.theme);
  }, [state.theme, hydrated]);

  useEffect(() => {
    if (!hydrated || !state.profile || !state.shareProgress || !deviceId.current) return;
    void ensureSocialProfile(deviceId.current, state.profile.name).catch((err) =>
      console.warn("ensureSocialProfile failed", err),
    );
  }, [hydrated, state.profile?.name, state.shareProgress]);

  useEffect(() => {
    if (!hydrated) return;
    if (!state.remindersEnabled) {
      clearLocalReminders();
      return;
    }
    const day =
      state.profile != null
        ? planDayForToday(buildWeeklyPlan(state.profile, state.sessions, learningWeekHint(state)))
        : null;
    scheduleLocalReminders({
      enabled: true,
      hour: state.reminderHour ?? 18,
      sessions: state.sessions,
      freezeUsedDates: state.freezeUsedDates ?? [],
      streakFreezes: state.streakFreezes ?? 0,
      xpToday: state.xpByDate?.[todayKey()] ?? 0,
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
  ]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);

  const day = (s: AppState) => s.days[todayKey()] ?? { date: todayKey(), waterMl: 0, meals: 0 };

  const value = useMemo<Store>(
    () => ({
      state,
      hydrated,
      deviceId: deviceId.current,
      lastSessionXp,
      setProfile: (profile) => {
        update((s) => withSnapshot(withQuests({ ...s, profile }, deviceId.current)));
        if (deviceId.current && state.shareProgress !== false) {
          void ensureSocialProfile(deviceId.current, profile.name).catch((err) =>
            console.warn("ensureSocialProfile failed", err),
          );
        }
      },
      addSession: (session, opts) => {
        const xpGain = session.express ? XP.express : XP.session;
        setLastSessionXp(xpGain);
        update((s) => {
          const prev = withQuests(s, deviceId.current);
          let next = withSnapshot({ ...prev, sessions: [session, ...prev.sessions] });
          const awarded = applyXpAward(next, xpGain);
          next = afterXpSideEffects(prev, awarded.state, deviceId.current, { fromSession: session });
          if (deviceId.current && next.shareProgress && next.profile) {
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
          return next;
        });
      },
      addWeight: (weightKg) =>
        update((s) =>
          withSnapshot({
            ...s,
            weights: [...s.weights.filter((w) => w.date !== todayKey()), { date: todayKey(), weightKg }].sort((a, b) =>
              a.date < b.date ? -1 : 1,
            ),
            profile: s.profile ? { ...s.profile, weightKg } : s.profile,
          }),
        ),
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
      addMealEntry: (entry) =>
        update((s) => {
          const prev = withQuests(s, deviceId.current);
          const date = entry.date ?? todayKey();
          const servings = entry.servings ?? 1;
          const full: MealEntry = {
            ...entry,
            date,
            servings,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          };
          let next = syncMealCount({ ...prev, meals: [...prev.meals, full] }, date);
          next = withSnapshot(next);
          const mealsBefore = prev.meals.filter((m) => m.date.slice(0, 10) === date).length;
          if (mealsBefore * XP.meal < XP.mealCap) {
            const awarded = applyXpAward(next, XP.meal, date);
            next = afterXpSideEffects(prev, awarded.state, deviceId.current);
          }
          return next;
        }),
      removeMealEntry: (id) =>
        update((s) => {
          const target = s.meals.find((m) => m.id === id);
          const meals = s.meals.filter((m) => m.id !== id);
          const next = target ? syncMealCount({ ...s, meals }, target.date) : { ...s, meals };
          return withSnapshot(next);
        }),
      updateMealEntry: (id, patch) =>
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
            };
          });
          const target = meals.find((m) => m.id === id);
          const base = target ? syncMealCount({ ...s, meals }, target.date) : { ...s, meals };
          return withSnapshot(base);
        }),
      toggleFavoriteMeal: (presetId) =>
        update((s) => {
          const ids = s.favoriteMealPresetIds ?? [];
          const next = ids.includes(presetId) ? ids.filter((x) => x !== presetId) : [...ids, presetId];
          return { ...s, favoriteMealPresetIds: next };
        }),
      toggleSupplement: (id) =>
        update((s) => {
          const prev = withQuests(s, deviceId.current);
          const date = todayKey();
          const taken = prev.supplementLogs[date] ?? [];
          const nextTaken = taken.includes(id) ? taken.filter((t) => t !== id) : [...taken, id];
          let next = withSnapshot({
            ...prev,
            supplementLogs: { ...prev.supplementLogs, [date]: nextTaken },
          });
          const was = supplementsComplete(prev, date);
          const now = supplementsComplete(next, date);
          if (!was && now) {
            const awarded = applyXpAward(next, XP.supplementsComplete, date);
            next = afterXpSideEffects(prev, awarded.state, deviceId.current);
          }
          return next;
        }),
      setRoutine: (ids) => update((s) => ({ ...s, supplementRoutine: ids })),
      toggleChallenge: (id) => {
        const current = stateRef.current;
        const joining = !current.challenges.includes(id);
        const challenge = challengeById(id);
        const baseline = challenge ? challengeRawValue(challenge, current.sessions) : 0;
        update((s) => {
          if (joining) {
            return {
              ...s,
              challenges: [...s.challenges, id],
              challengeBaselines: { ...(s.challengeBaselines ?? {}), [id]: baseline },
            };
          }
          const nextBaselines = { ...(s.challengeBaselines ?? {}) };
          delete nextBaselines[id];
          return {
            ...s,
            challenges: s.challenges.filter((c) => c !== id),
            challengeBaselines: nextBaselines,
          };
        });
        if (!deviceId.current || !current.profile || current.shareProgress === false) return;
        const name = current.profile.name;
        if (joining && challenge) {
          const progress = challengeProgress(challenge, current.sessions, baseline);
          void joinChallengeRemote(deviceId.current, id, name, baseline)
            .then(() =>
              syncChallengeProgress(deviceId.current, id, progress.current, name, {
                baseline: progress.baseline,
                pct: progress.pct,
                complete: progress.complete,
              }),
            )
            .catch((e) => console.error("Falha ao entrar no desafio remoto", e));
        } else {
          void leaveChallengeRemote(deviceId.current, id).catch((e) =>
            console.error("Falha ao sair do desafio remoto", e),
          );
        }
      },
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
            baselines[cid] = challengeRawValue(challenge, current.sessions);
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
                  const baseline = baselines[cid] ?? challengeRawValue(challenge, current.sessions);
                  const progress = challengeProgress(challenge, current.sessions, baseline);
                  await joinChallengeRemote(deviceId.current, cid, name, baseline).catch(() => undefined);
                  await syncChallengeProgress(deviceId.current, cid, progress.current, name, {
                    baseline: progress.baseline,
                    pct: progress.pct,
                    complete: progress.complete,
                  }).catch(() => undefined);
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
          chat: [...s.chat, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, text }],
        })),
      setTheme: (theme) => update((s) => ({ ...s, theme })),
      setShareProgress: (share) => update((s) => ({ ...s, shareProgress: share })),
      setSessionFx: (enabled) => update((s) => ({ ...s, sessionFx: enabled })),
      setRemindersEnabled: (enabled) => update((s) => ({ ...s, remindersEnabled: enabled })),
      setReminderHour: (hour) =>
        update((s) => ({ ...s, reminderHour: Math.min(22, Math.max(6, Math.round(hour))) })),
      markTipSeen: (id) =>
        update((s) => {
          const seen = s.seenOnboardingTips ?? [];
          if (seen.includes(id)) return s;
          return { ...s, seenOnboardingTips: [...seen, id] };
        }),
      earnBadge: (id) => {
        if (state.earnedBadges.includes(id)) return false;
        update((s) => (s.earnedBadges.includes(id) ? s : { ...s, earnedBadges: [...s.earnedBadges, id] }));
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
            void publishRetentionEvent(deviceId.current, next.profile.name, "freeze_used", { date }).catch(
              () => undefined,
            );
          }
          return next;
        });
        return true;
      },
      markQuestCoachOpened: () => update((s) => bumpManualQuest(withQuests(s, deviceId.current), "coach")),
      markQuestKudos: () => {
        update((s) => {
          const prev = withQuests(s, deviceId.current);
          let next = bumpManualQuest(prev, "kudos");
          const awarded = applyXpAward(next, XP.kudos);
          // Cap kudos XP via checking progress — simple: only if quest exists and under cap using a counter in progress
          const kudosCount = (prev.dailyQuestProgress?.["q-kudos"] ?? 0) + (prev.dailyQuestProgress?.["__kudos_xp"] ?? 0);
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
        update((s) => {
          const applyRoutine = s.supplementRoutine.length === 0 && productIds.length > 0;
          const badges = new Set(s.cosmeticBadges ?? []);
          badges.add("cliente-soldiers");
          return {
            ...s,
            accessGranted: true,
            accessEmail: email,
            accessGrantedAt: grantedAt,
            accessTier,
            purchaseProductIds: productIds.length ? productIds : s.purchaseProductIds,
            restockEstimates: Object.keys(restockEstimates).length ? restockEstimates : s.restockEstimates,
            supplementRoutine: applyRoutine ? productIds : s.supplementRoutine,
            routineFromPurchase: applyRoutine || s.routineFromPurchase,
            cosmeticBadges: [...badges],
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
              restockEstimates: session.restockEstimates
                ? { ...s.restockEstimates, ...session.restockEstimates }
                : s.restockEstimates,
            }));
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
        }));
      },
      revokeAccessLocal: () => {
        update((s) => ({
          ...s,
          accessGranted: false,
          accessEmail: null,
          accessGrantedAt: null,
        }));
      },
      dismissRoutineFromPurchase: () =>
        update((s) => ({ ...s, routineFromPurchaseDismissed: true })),
      markUpsellShown: () => update((s) => ({ ...s, upsellShownDate: todayKey() })),
      saveDayCheckIn: (checkIn) =>
        update((s) => {
          const date = checkIn.date ?? todayKey();
          const full: DayCheckIn = {
            date,
            sleepHours: checkIn.sleepHours,
            energy: checkIn.energy,
            availableMin: checkIn.availableMin,
            ...(checkIn.noEquipment ? { noEquipment: true } : {}),
          };
          return withSnapshot({
            ...s,
            dayCheckIns: { ...(s.dayCheckIns ?? {}), [date]: full },
          });
        }),
      refreshLivingPlan: () => update((s) => withSnapshot(s)),
      reset: () => {
        skipPush.current = true;
        setState(emptyState);
        applyTheme("dark");
        if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
        void clearRemoteState(deviceId.current);
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
