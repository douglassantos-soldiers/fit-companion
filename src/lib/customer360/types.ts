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

export type { AppState };
