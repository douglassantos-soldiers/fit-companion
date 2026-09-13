import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clearRemoteState, getDeviceId, pullState, pushState } from "@/lib/sync";
import { emptyState, todayKey, type AppState, type Profile, type SessionLog } from "@/lib/types";

const KEY = "soldiers-os-v1";

interface Store {
  state: AppState;
  hydrated: boolean;
  setProfile: (p: Profile) => void;
  addSession: (s: SessionLog) => void;
  addWeight: (kg: number) => void;
  addWater: (ml: number) => void;
  addMeal: () => void;
  toggleSupplement: (id: string) => void;
  setRoutine: (ids: string[]) => void;
  toggleChallenge: (id: string) => void;
  pushChat: (role: "coach" | "user", text: string) => void;
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(emptyState);
  const [hydrated, setHydrated] = useState(false);

  const deviceId = useRef("");
  const skipPush = useRef(true);

  useEffect(() => {
    const local = load();
    setState(local);
    setHydrated(true);
    deviceId.current = getDeviceId();

    // Se o banco já tem dados deste aparelho, eles têm prioridade.
    void pullState(deviceId.current)
      .then((remote) => {
        if (remote) {
          skipPush.current = true;
          setState(remote);
        } else if (local.profile) {
          void pushState(deviceId.current, local);
        }
      })
      .catch((e) => console.error("Falha ao carregar dados do banco", e));
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

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);

  const day = (s: AppState) => s.days[todayKey()] ?? { date: todayKey(), waterMl: 0, meals: 0 };

  const value = useMemo<Store>(
    () => ({
      state,
      hydrated,
      setProfile: (profile) => update((s) => ({ ...s, profile })),
      addSession: (session) => update((s) => ({ ...s, sessions: [session, ...s.sessions] })),
      addWeight: (weightKg) =>
        update((s) => ({
          ...s,
          weights: [...s.weights.filter((w) => w.date !== todayKey()), { date: todayKey(), weightKg }].sort((a, b) =>
            a.date < b.date ? -1 : 1,
          ),
          profile: s.profile ? { ...s.profile, weightKg } : s.profile,
        })),
      addWater: (ml) =>
        update((s) => {
          const d = day(s);
          return { ...s, days: { ...s.days, [todayKey()]: { ...d, waterMl: d.waterMl + ml } } };
        }),
      addMeal: () =>
        update((s) => {
          const d = day(s);
          return { ...s, days: { ...s.days, [todayKey()]: { ...d, meals: d.meals + 1 } } };
        }),
      toggleSupplement: (id) =>
        update((s) => {
          const taken = s.supplementLogs[todayKey()] ?? [];
          const next = taken.includes(id) ? taken.filter((t) => t !== id) : [...taken, id];
          return { ...s, supplementLogs: { ...s.supplementLogs, [todayKey()]: next } };
        }),
      setRoutine: (ids) => update((s) => ({ ...s, supplementRoutine: ids })),
      toggleChallenge: (id) =>
        update((s) => ({
          ...s,
          challenges: s.challenges.includes(id) ? s.challenges.filter((c) => c !== id) : [...s.challenges, id],
        })),
      pushChat: (role, text) =>
        update((s) => ({
          ...s,
          chat: [...s.chat, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, text }],
        })),
      reset: () => {
        skipPush.current = true;
        setState(emptyState);
        if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
        void clearRemoteState(deviceId.current);
      },
    }),
    [state, hydrated, update],
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
