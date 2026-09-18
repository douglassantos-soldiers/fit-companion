export type Goal = "massa" | "gordura" | "performance" | "saude";
export type Level = "iniciante" | "intermediario" | "avancado";
export type Equipment = "casa" | "academia";
export type Theme = "dark" | "light";
export type SessionRpe = "facil" | "ok" | "dificil";
export type MealSlot = "cafe" | "almoco" | "lanche" | "jantar";
export type MealQuality = "verde" | "amarelo" | "laranja";

export interface Profile {
  name: string;
  goal: Goal;
  level: Level;
  daysPerWeek: number;
  age: number;
  heightCm: number;
  weightKg: number;
  equipment: Equipment;
  restrictions: string[];
  createdAt: string;
}

export interface SetLog {
  reps: number;
  weightKg: number;
  done: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
}

export interface SessionLog {
  id: string;
  dayId: string;
  title: string;
  date: string;
  durationMin: number;
  exercises: ExerciseLog[];
  volumeKg: number;
  rpe?: SessionRpe;
  /** Shortened session that still protects streak */
  express?: boolean;
}

export interface WeightEntry {
  date: string;
  weightKg: number;
}

export interface DayMetrics {
  date: string;
  waterMl: number;
  meals: number;
}

export interface MealEntry {
  id: string;
  date: string;
  slot: MealSlot;
  label: string;
  proteinG: number;
  kcal: number;
  quality: MealQuality;
  presetId?: string;
  /** Portion multiplier; proteinG/kcal are already scaled */
  servings?: number;
}

export interface ChatMessage {
  id: string;
  role: "coach" | "user";
  text: string;
}

export interface DimensionSnapshot {
  date: string;
  scores: Record<string, number>;
}

export interface AppState {
  profile: Profile | null;
  sessions: SessionLog[];
  weights: WeightEntry[];
  days: Record<string, DayMetrics>;
  meals: MealEntry[];
  supplementLogs: Record<string, string[]>;
  supplementRoutine: string[];
  challenges: string[];
  chat: ChatMessage[];
  theme: Theme;
  dimensionSnapshots: DimensionSnapshot[];
  earnedBadges: string[];
  shareProgress: boolean;
  /** Sons e vibração durante a sessão de treino */
  sessionFx: boolean;
  favoriteMealPresetIds: string[];
  remindersEnabled: boolean;
  /** Local hour 0–23 for daily reminder */
  reminderHour: number;
  seenOnboardingTips: string[];
  /** Daily XP ledger by YYYY-MM-DD */
  xpByDate: Record<string, number>;
  /** Available streak freezes (cap 2) */
  streakFreezes: number;
  /** Dates where a freeze was spent */
  freezeUsedDates: string[];
  /** Dates that already counted toward weekly freeze refill */
  xpGoalMetDates: string[];
  dailyQuestIds: string[];
  dailyQuestDate: string;
  dailyQuestProgress: Record<string, number>;
  /** Cosmetic / variable reward badges */
  cosmeticBadges: string[];
  /** Auth user id when logged in (Phase 4) */
  authUserId: string | null;
  bio: string;
  avatarUrl: string | null;
  /** Shopify purchase gate — permanent after any paid order */
  accessGranted: boolean;
  accessEmail: string | null;
  accessGrantedAt: string | null;
  /** base | performance — from Shopify products/tags */
  accessTier: "base" | "performance";
  /** PRODUCTS.id mapped from last paid order */
  purchaseProductIds: string[];
  /** Restock estimates keyed by product id */
  restockEstimates: Record<string, { emptyAt: string; productId: string; daysLeft: number; quantity: number }>;
  /** Banner "rotina da compra" dismissed */
  routineFromPurchase: boolean;
  routineFromPurchaseDismissed: boolean;
  /** YYYY-MM-DD last post-workout upsell shown */
  upsellShownDate: string | null;
}

export const emptyState: AppState = {
  profile: null,
  sessions: [],
  weights: [],
  days: {},
  meals: [],
  supplementLogs: {},
  supplementRoutine: [],
  challenges: [],
  chat: [],
  theme: "dark",
  dimensionSnapshots: [],
  earnedBadges: [],
  shareProgress: true,
  sessionFx: true,
  favoriteMealPresetIds: [],
  remindersEnabled: false,
  reminderHour: 18,
  seenOnboardingTips: [],
  xpByDate: {},
  streakFreezes: 1,
  freezeUsedDates: [],
  xpGoalMetDates: [],
  dailyQuestIds: [],
  dailyQuestDate: "",
  dailyQuestProgress: {},
  cosmeticBadges: [],
  authUserId: null,
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
};

export const DAILY_XP_GOAL = 20;

export const GOAL_LABEL: Record<Goal, string> = {
  massa: "Ganhar massa",
  gordura: "Perder gordura",
  performance: "Performance",
  saude: "Saúde e bem-estar",
};

export const LEVEL_LABEL: Record<Level, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  cafe: "Café",
  almoco: "Almoço",
  lanche: "Lanche",
  jantar: "Jantar",
};

export const todayKey = (d: Date = new Date()) => d.toISOString().slice(0, 10);
