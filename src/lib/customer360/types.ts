/**
 * Customer 360 type system.
 * Flat metrics stay for DB/UI compatibility; lineage + estimates mark origin and uncertainty.
 */
import type { AppState, Goal, Level } from "@/lib/types";

export type LineageKind = "raw" | "derived" | "estimate" | "observed" | "estimated" | "inferred";

export type LineageEntry = {
  source: string;
  kind: LineageKind;
};

export type MetricConfidence = {
  value: number | null;
  confidence: number;
  basis: "full_logging" | "partial_logging" | "inferred" | "none";
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
  /** Deep Training extensions */
  exerciseCount?: number;
  prCount?: number;
  estimated1rmTrend?: "up" | "flat" | "down" | "unknown" | null;
  volumeTrend?: "up" | "flat" | "down" | "unknown" | null;
  muscleBalance?: number | null;
  strengthTrend?: "up" | "flat" | "down" | "unknown" | null;
};

export type Nutrition360 = {
  proteinAdherence7d: number | null;
  /** Logging completeness 0–1 (days with any meal / 7) — distinct from adherence */
  loggingCompleteness7d?: number | null;
  proteinAdherence?: MetricConfidence;
  /** Phase 2 */
  kcalAdherence?: MetricConfidence;
  macroDistribution7d?: { protein: number; carb: number; fat: number } | null;
  mealFrequency7d?: number | null;
  nutritionConfidence?: number | null;
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
  patterns?: Array<{ key: string; confidence: number; supportCount: number }>;
  triggerCount?: number;
  interventionCount?: number;
  successfulInterventionCount?: number;
  engagement?: number;
  adherence?: {
    training: number;
    meal: number;
    sleep: number;
  };
  behaviorConfidence?: number;
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
  lastRecomputedAt?: string | null;
  dataVersion?: number | null;
};

export type { AppState };

/** Default lineage map for a fully built 360. */
export function buildDefaultLineage(): Record<string, LineageEntry> {
  return {
    total_spend: { source: "orders", kind: "observed" },
    total_orders: { source: "orders", kind: "observed" },
    average_order_value: { source: "orders", kind: "derived" },
    purchase_frequency: { source: "orders", kind: "derived" },
    favorite_products: { source: "order_items", kind: "derived" },
    first_purchase_at: { source: "orders", kind: "observed" },
    last_purchase_at: { source: "orders", kind: "observed" },
    estimated_ltv: { source: "orders", kind: "estimated" },
    estimated_next_purchase: { source: "orders", kind: "estimated" },
    training_frequency: { source: "sessions", kind: "derived" },
    nutrition_adherence: { source: "meal_entries", kind: "estimated" },
    recovery_score: { source: "sessions+dayCheckIns", kind: "derived" },
    supplement_adherence: { source: "supplement_logs", kind: "derived" },
    restock_estimates: { source: "order_items+supplement_dose_logs", kind: "estimated" },
    current_goal: { source: "profiles", kind: "observed" },
    performance_level: { source: "profiles", kind: "observed" },
    behavioral_streak: { source: "sessions", kind: "derived" },
    user_patterns: { source: "decision_outcomes", kind: "inferred" },
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
