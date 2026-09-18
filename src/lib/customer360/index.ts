/**
 * Customer 360 — aggregation layer (not a monolithic table).
 * Goals come from profile/onboarding — NEVER inferred solely from purchased products.
 */
import type { AppState, Goal, Level } from "@/lib/types";

export type Commerce360 = {
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number | null;
  purchaseFrequencyDays: number | null;
  favoriteProducts: string[];
  productIds: string[];
  estimatedLtv: number | null;
  estimatedNextPurchase: string | null;
};

export type Performance360 = {
  sessions28d: number;
  volume28d: number;
  trainingFrequency: number;
  avgRpeHardStreak: number;
  performanceLevel: Level | null;
};

export type Nutrition360 = {
  proteinAdherence7d: number | null;
  mealsLogged7d: number;
  weightTrendKg7d: number | null;
  latestWeightKg: number | null;
};

export type Recovery360 = {
  recoveryScore: number | null;
  sleepAvg7d: number | null;
  fatigueSignal: boolean;
};

export type Supplements360 = {
  routineIds: string[];
  adherence30d: number | null;
  restockEstimates: Record<
    string,
    { emptyAt: string; daysLeft: number; confidence: number; productId: string }
  >;
};

export type Behavior360 = {
  workoutsCompleted: number;
  mealsLogged: number;
  weightLogs: number;
  supplementDays: number;
  coachMessages: number;
  streak: number;
};

export type Goals360 = {
  currentGoal: Goal | null;
  level: Level | null;
  daysPerWeek: number | null;
  /** Explicit only — never from Shopify products alone */
  source: "profile" | "none";
};

export type Customer360 = {
  userId: string | null;
  commerce: Commerce360;
  performance: Performance360;
  nutrition: Nutrition360;
  recovery: Recovery360;
  supplements: Supplements360;
  behavior: Behavior360;
  goals: Goals360;
  updatedAt: string;
};

function emptyCommerce(): Commerce360 {
  return {
    firstPurchaseAt: null,
    lastPurchaseAt: null,
    totalOrders: 0,
    totalSpend: 0,
    averageOrderValue: null,
    purchaseFrequencyDays: null,
    favoriteProducts: [],
    productIds: [],
    estimatedLtv: null,
    estimatedNextPurchase: null,
  };
}

/** Build Customer 360 from local AppState (client-safe, no secrets). */
export function buildCustomer360FromState(
  state: AppState,
  opts?: { userId?: string | null },
): Customer360 {
  const profile = state.profile;
  const sessions28 = state.sessions.filter((s) => {
    const d = new Date(s.date);
    const lim = new Date();
    lim.setDate(lim.getDate() - 28);
    return d >= lim;
  });
  const volume28d = sessions28.reduce((s, x) => s + x.volumeKg, 0);
  const hardStreak = (() => {
    const sorted = [...state.sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
    let n = 0;
    for (const s of sorted) {
      if (s.rpe === "dificil") n += 1;
      else break;
    }
    return n;
  })();

  const meals7 = (state.meals ?? []).filter((m) => {
    const lim = new Date();
    lim.setDate(lim.getDate() - 7);
    return new Date(m.date) >= lim;
  });

  const weights = [...(state.weights ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  let weightTrend: number | null = null;
  if (weights.length >= 2) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const inW = weights.filter((w) => new Date(w.date) >= cutoff);
    if (inW.length >= 2) {
      weightTrend =
        Math.round((inW[inW.length - 1]!.weightKg - inW[0]!.weightKg) * 10) / 10;
    }
  }

  const sleepEntries = Object.values(state.dayCheckIns ?? {})
    .filter((c) => c.sleepHours > 0)
    .slice(0, 7);
  const sleepAvg = sleepEntries.length
    ? sleepEntries.reduce((s, c) => s + c.sleepHours, 0) / sleepEntries.length
    : null;

  const restock: Supplements360["restockEstimates"] = {};
  for (const [id, r] of Object.entries(state.restockEstimates ?? {})) {
    const daysLeft = Math.max(
      0,
      Math.round((new Date(r.emptyAt).getTime() - Date.now()) / 86_400_000),
    );
    restock[id] = {
      productId: id,
      emptyAt: r.emptyAt,
      daysLeft,
      confidence: 0.45, // purchase-only estimate; raised when consumption logs exist
    };
  }

  // Raise confidence when user logs supplements regularly
  const logDays = Object.values(state.supplementLogs ?? {}).filter((ids) => ids.length > 0).length;
  if (logDays >= 7) {
    for (const k of Object.keys(restock)) {
      restock[k] = { ...restock[k]!, confidence: Math.min(0.85, 0.45 + logDays * 0.02) };
    }
  }

  const productIds = state.purchaseProductIds ?? [];

  return {
    userId: opts?.userId ?? null,
    commerce: {
      ...emptyCommerce(),
      productIds,
      favoriteProducts: productIds.slice(0, 5),
      totalOrders: productIds.length ? 1 : 0,
    },
    performance: {
      sessions28d: sessions28.length,
      volume28d: Math.round(volume28d),
      trainingFrequency: profile?.daysPerWeek ?? 0,
      avgRpeHardStreak: hardStreak,
      performanceLevel: profile?.level ?? null,
    },
    nutrition: {
      proteinAdherence7d: null,
      mealsLogged7d: meals7.length,
      weightTrendKg7d: weightTrend,
      latestWeightKg: weights.length ? weights[weights.length - 1]!.weightKg : null,
    },
    recovery: {
      recoveryScore: null,
      sleepAvg7d: sleepAvg != null ? Math.round(sleepAvg * 10) / 10 : null,
      fatigueSignal: hardStreak >= 2 || (sleepAvg != null && sleepAvg < 6),
    },
    supplements: {
      routineIds: state.supplementRoutine ?? [],
      adherence30d: null,
      restockEstimates: restock,
    },
    behavior: {
      workoutsCompleted: state.sessions.length,
      mealsLogged: (state.meals ?? []).length,
      weightLogs: state.weights.length,
      supplementDays: logDays,
      coachMessages: (state.chat ?? []).length,
      streak: 0,
    },
    goals: {
      currentGoal: profile?.goal ?? null,
      level: profile?.level ?? null,
      daysPerWeek: profile?.daysPerWeek ?? null,
      source: profile ? "profile" : "none",
    },
    updatedAt: new Date().toISOString(),
  };
}

/** Merge DB commerce metrics into a Customer360 built from state. */
export function mergeCommerceInto360(
  base: Customer360,
  commerce: Partial<Commerce360>,
): Customer360 {
  return {
    ...base,
    commerce: { ...base.commerce, ...commerce },
    updatedAt: new Date().toISOString(),
  };
}
