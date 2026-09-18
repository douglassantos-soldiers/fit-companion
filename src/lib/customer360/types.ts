/**
 * Customer 360 type system.
 * Flat metrics stay for DB/UI compatibility; lineage + estimates mark origin and uncertainty.
 */
import type { AppState, Goal, Level } from "@/lib/types";

export type LineageKind = "raw" | "derived" | "estimate";

export type LineageEntry = {
  source: string;
  kind: LineageKind;
};

export type EstimateField<T> = {
  value: T;
  kind: "estimate";
  method: string;
};

export type Commerce360 = {
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number | null;
  purchaseFrequencyDays: number | null;
  favoriteProducts: string[];
  productIds: string[];
  /** Flat for DB columns — also mirrored in estimates.ltv */
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
  /** FASE 5 Recovery v2 */
  level?: "recovered" | "moderate" | "low" | null;
  explanation?: string | null;
  manualOnly?: boolean;
  confidence?: number | null;
};

export type RestockEstimate360 = {
  emptyAt: string;
  daysLeft: number;
  confidence: number;
  productId: string;
  kind: "estimate";
};

export type Supplements360 = {
  routineIds: string[];
  adherence30d: number | null;
  restockEstimates: Record<string, RestockEstimate360>;
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

export type Customer360Estimates = {
  ltv: EstimateField<number | null>;
  nextPurchase: EstimateField<string | null>;
};

export type Customer360 = {
  userId: string | null;
  shopifyCustomerId: string | null;
  commerce: Commerce360;
  performance: Performance360;
  nutrition: Nutrition360;
  recovery: Recovery360;
  supplements: Supplements360;
  behavior: Behavior360;
  goals: Goals360;
  /** Data lineage for important metrics */
  lineage: Record<string, LineageEntry>;
  /** Explicit estimate wrappers (do not present as facts) */
  estimates: Customer360Estimates;
  updatedAt: string;
};

export type { AppState };

/** Default lineage map for a fully built 360. */
export function buildDefaultLineage(): Record<string, LineageEntry> {
  return {
    total_spend: { source: "orders", kind: "raw" },
    total_orders: { source: "orders", kind: "raw" },
    average_order_value: { source: "orders", kind: "derived" },
    purchase_frequency: { source: "orders", kind: "derived" },
    favorite_products: { source: "order_items", kind: "derived" },
    first_purchase_at: { source: "orders", kind: "raw" },
    last_purchase_at: { source: "orders", kind: "raw" },
    estimated_ltv: { source: "orders", kind: "estimate" },
    estimated_next_purchase: { source: "orders", kind: "estimate" },
    training_frequency: { source: "sessions", kind: "derived" },
    nutrition_adherence: { source: "meal_entries", kind: "derived" },
    recovery_score: { source: "sessions+dayCheckIns", kind: "derived" },
    supplement_adherence: { source: "supplement_logs", kind: "derived" },
    restock_estimates: { source: "order_items+supplement_logs", kind: "estimate" },
    current_goal: { source: "profiles", kind: "raw" },
    performance_level: { source: "profiles", kind: "raw" },
    behavioral_streak: { source: "sessions", kind: "derived" },
  };
}

export function buildEstimatesFromCommerce(commerce: Commerce360): Customer360Estimates {
  return {
    ltv: {
      value: commerce.estimatedLtv,
      kind: "estimate",
      method: "spend_x_frequency_heuristic",
    },
    nextPurchase: {
      value: commerce.estimatedNextPurchase,
      kind: "estimate",
      method: "last_purchase_plus_avg_frequency_days",
    },
  };
}
