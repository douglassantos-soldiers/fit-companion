import type { SocialPrivacy } from "@/lib/social/visibility";

export type Goal = "massa" | "gordura" | "performance" | "saude";
export type Level = "iniciante" | "intermediario" | "avancado";
export type Equipment = "casa" | "academia";
export type Theme = "dark" | "light";
export type SessionRpe = "facil" | "ok" | "dificil";
export type MealSlot = "cafe" | "almoco" | "lanche" | "jantar";
export type MealQuality = "verde" | "amarelo" | "laranja";
export type MealSourceKind = "informed" | "estimated";
/** Food / nutrient lineage (Phase 2) — AI estimate is never "observed". */
export type FoodLineageSource = "taco" | "user" | "imported" | "ai_estimate" | "internal";

/** Snapshot of macros at log time (Phase 2 MealItem / Meal header). */
export interface MealNutrientSnapshot {
  energyKcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  extras?: Record<string, import("@/lib/nutrition/types").NutrientValue>;
  capturedAt: string;
  source: FoodLineageSource;
  kind: "observed" | "derived" | "estimated";
  confidence: number;
}

export interface MealItemEntry {
  id?: string;
  foodId: string;
  foodName?: string;
  quantity: number;
  unit: string;
  grams: number;
  nutrientSnapshot: MealNutrientSnapshot;
  confidence: number;
  sourceKind: MealSourceKind;
  foodSource?: FoodLineageSource;
}
export type PrimaryBlocker = "sono" | "alimentacao" | "consistencia" | "tempo" | "equipamento";
export type DayEnergy = "baixa" | "ok" | "alta";
export type FocusMuscle = "peito" | "costas" | "pernas" | "ombros" | "biceps" | "triceps" | "core";
export type GymGear = "barra" | "halteres" | "maquinas" | "elasticos" | "peso_corporal";
export type TrainingMode = "full" | "express" | "deload" | "rest";
export type TrafficLight = "green" | "yellow" | "red";
export type DoseUnit = "g" | "ml" | "caps" | "scoop" | "serving";
export type DoseFrequency = "1x_day" | "2x_day" | "as_needed" | "custom";
export type DoseSource = "manual" | "routine_toggle";
export type EatingDifficulty = "baixa" | "media" | "alta";
export type BudgetLevel = "baixo" | "medio" | "alto";
export type EatsOutFrequency = "raro" | "semanal" | "frequente";

/** Nutrition intelligence prefs (FASE 7) — distinct from joint training restrictions. */
export interface NutritionProfile {
  foodPreferences: string[];
  foodRestrictions: string[];
  mealWindows?: Partial<Record<MealSlot, { typicalHour?: number; enabled: boolean }>>;
  eatingDifficulty?: EatingDifficulty;
  budgetLevel?: BudgetLevel;
  eatsOutFrequency?: EatsOutFrequency;
  /** Slots the user actually eats; empty/undefined → derive from skipBreakfast */
  activeSlots?: MealSlot[];
  adherenceNotes?: string;
  /** When true, whey/beef doses of the day count toward protein/kcal */
  countWheyInMacros?: boolean;
}

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
  /** Typical nightly sleep hours (baseline) */
  typicalSleepHours?: number;
  /** What most blocks progress right now */
  primaryBlocker?: PrimaryBlocker;
  /** Behavioral meal prefs */
  skipBreakfast?: boolean;
  lunchOutOften?: boolean;
  /** FASE 7 nutrition intelligence */
  nutritionProfile?: NutritionProfile;
  /** IANA timezone for calendar-day calculations (default America/Sao_Paulo) */
  timezone?: string;
  /** Optimistic concurrency for multi-device sync */
  version?: number;
  /** 0=Dom … 6=Sáb. When set, replaces the default split weekdays. */
  trainingWeekdays?: number[];
  /** Muscles to bias volume toward */
  focusMuscles?: FocusMuscle[];
  /** Concrete gym inventory; empty/undefined falls back to casa vs academia */
  equipmentInventory?: GymGear[];
  /** Habitual session length in minutes (30/45/60/90). Seeds check-in availableMin. */
  typicalSessionMin?: number;
  /** False after fast-path onboarding until body/sleep/blocker are filled */
  onboardingComplete?: boolean;
}

export interface DayCheckIn {
  date: string;
  sleepHours: number;
  energy: DayEnergy;
  availableMin: number;
  noEquipment?: boolean;
  /** Same-day casa/academia override (persisted) */
  equipment?: Equipment;
  /** Coach/user accepted living-plan mode for today */
  acceptedTrainingMode?: TrainingMode;
  /** Muscle soreness 1–5 (optional; FASE 3) */
  soreness?: number;
  /** Stress 1–5 (optional; FASE 3) */
  stress?: number;
  /** Short free-text note (sanitized server-side) */
  notes?: string;
  /** Same-day “almoço fora” override for practical presets */
  lunchOutToday?: boolean;
  /** Slots skipped just for today (does not rewrite the profile) */
  skippedSlots?: MealSlot[];
  /** Optimistic concurrency for multi-device sync */
  version?: number;
}

export interface LivingPlanSnapshot {
  date: string;
  generatedAt: string;
  score: number;
  blocker: { key: string; label: string; score: number } | null;
  traffic: {
    training: TrafficLight;
    nutrition: TrafficLight;
    recovery: TrafficLight;
    consistency: TrafficLight;
  };
  workout: {
    mode: TrainingMode;
    title: string;
    estimatedMin: number;
    dayId: string | null;
    volumeFactor: number;
  };
  nutrition: {
    proteinG: number;
    kcal: number;
    waterMl: number;
    skipBreakfast: boolean;
  };
  supplements: Array<{ id: string; name: string; timing: string }>;
  sleepTargetHours: number;
  habits: { title: string; tip: string; contentId?: string };
  narrative: string;
  why: string[];
  /** Structured why per relevant change (treino, kcal, proteína, stims, recuperação). */
  whyByChange: Array<{ key: string; label: string; reason: string }>;
  diffFromYesterday: string[];
  /** Phase 5 — HOW to execute (mode · minutes · volume). */
  how?: string;
  /** Phase 5 — primary decision confidence 0–1. */
  confidence?: number;
  confidenceLabel?: "baixa" | "media" | "alta";
}

export type SetType = "warmup" | "working" | "drop" | "failure";

export type ExercisePreferenceValue = "preferred" | "neutral" | "disliked" | "avoided";

export type LivingPlanFeedbackVote = "up" | "down";
export type LivingPlanFeedbackReason = "tempo" | "equipamento" | "nao_faz_sentido" | "outro";

export interface LivingPlanFeedback {
  vote: LivingPlanFeedbackVote;
  reason?: LivingPlanFeedbackReason;
  at: string;
}

export interface SetLog {
  reps: number;
  weightKg: number;
  done: boolean;
  /** Optional rich-set fields (backward compatible) */
  id?: string;
  setNumber?: number;
  type?: SetType;
  targetReps?: string;
  targetWeight?: number;
  actualReps?: number;
  actualWeight?: number;
  /** Numeric RPE 1–10 when logged per set */
  rpe?: number;
  rir?: number;
  restSec?: number;
  completed?: boolean;
  timestamp?: string;
  notes?: string;
  /** User skipped this set — does not count as failure */
  skipped?: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
  supersetGroupId?: string;
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

/** Closed set of body sites in cm (weight stays on WeightEntry). */
export interface BodyMeasurementEntry {
  date: string;
  waistCm: number | null;
  armCm: number | null;
  chestCm: number | null;
  hipCm: number | null;
  thighCm: number | null;
}

export type PhotoPose = "front" | "side" | "back";
export type PhotoVisibility = "private" | "card" | "feed";

/** Metadata only — bytes live in the private progress-photos bucket. */
export interface ProgressPhotoEntry {
  id: string;
  takenOn: string;
  pose: PhotoPose;
  storagePath: string;
  visibility: PhotoVisibility;
}

export interface DayMetrics {
  date: string;
  waterMl: number;
  meals: number;
}

export interface SavedMeal {
  id: string;
  label: string;
  items: MealItemEntry[];
  proteinG: number;
  kcal: number;
  carbG?: number;
  fatG?: number;
  fiberG?: number;
  quality: MealQuality;
  createdAt: string;
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
  /** informed = user-stated; estimated = AI suggestion */
  sourceKind?: MealSourceKind;
  /** 0–1; meaningful for estimated entries */
  confidence?: number;
  /** Meal AI mode when estimated */
  aiMode?: "photo" | "voice" | "text";
  /** True after user corrected an AI estimate */
  correctedFromAi?: boolean;
  version?: number;
  /** Phase 2 expanded macros (optional for legacy entries) */
  carbG?: number;
  fatG?: number;
  fiberG?: number;
  /** Composed foods — Meal → MealItem → FoodItem */
  items?: MealItemEntry[];
  /** Frozen nutrient totals at registration time */
  nutrientSnapshot?: MealNutrientSnapshot;
  /** Catalog lineage when known */
  foodSource?: FoodLineageSource;
}

/** FASE 7 — single dose consumption event (purchase ≠ consumption). */
export interface SupplementDoseLog {
  id: string;
  productId: string;
  dose: number;
  unit: DoseUnit;
  frequency: DoseFrequency;
  takenAt: string;
  source: DoseSource;
  version?: number;
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

/** FASE 8 — self-reported activity for steps / football / run (verified sources later). */
export type ActivityLogKind = "steps" | "football" | "run_km";
export type ProofStatus = "self_reported" | "verified" | "pending";
export type ProofSource =
  | "app_session"
  | "app_manual"
  | "apple_health"
  | "health_connect"
  | "garmin"
  | "strava"
  | "wearable";

export interface ActivityLogEntry {
  id: string;
  date: string;
  kind: ActivityLogKind;
  value: number;
  source: ProofSource;
  status: ProofStatus;
  /** Provider activity id — used to dedupe wearable ingest */
  externalId?: string;
}

export type WearableProviderId = "strava" | "garmin" | "apple_health" | "health_connect";
export type WearableLinkStatus = "disconnected" | "pending" | "connected" | "not_configured" | "needs_native";

export interface WearableConnection {
  provider: WearableProviderId;
  status: WearableLinkStatus;
  connectedAt?: string;
}

export interface AppState {
  profile: Profile | null;
  sessions: SessionLog[];
  weights: WeightEntry[];
  measurements: BodyMeasurementEntry[];
  progressPhotos: ProgressPhotoEntry[];
  days: Record<string, DayMetrics>;
  meals: MealEntry[];
  /** Daily rollup: product ids taken that day (derived from dose logs + legacy toggle) */
  supplementLogs: Record<string, string[]>;
  /** FASE 7 — structured dose consumption history */
  supplementDoseLogs: SupplementDoseLog[];
  /** Per-product frequency override from dose logging */
  supplementFrequencies: Record<string, DoseFrequency>;
  supplementRoutine: string[];
  challenges: string[];
  chat: ChatMessage[];
  theme: Theme;
  dimensionSnapshots: DimensionSnapshot[];
  earnedBadges: string[];
  shareProgress: boolean;
  /** Granular social visibility (Fase 12). Weight/photos default private. */
  socialPrivacy: SocialPrivacy;
  /** Sons e vibração durante a sessão de treino */
  sessionFx: boolean;
  favoriteMealPresetIds: string[];
  /** Composed meals the user saved for reuse (Fase 13 library). */
  savedMeals: SavedMeal[];
  remindersEnabled: boolean;
  /** Local hour 0–23 for daily reminder */
  reminderHour: number;
  /** Granular web-push categories */
  pushPrefs: {
    workout: boolean;
    streak: boolean;
    challenge: boolean;
    kudos: boolean;
  };
  termsAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
  healthPurposeAckAt: string | null;
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
  /** App identity user id (Identity Engine) — not device_id */
  userId: string | null;
  bio: string;
  avatarUrl: string | null;
  /** Shopify purchase gate — paid order in the last 40 days */
  accessGranted: boolean;
  accessEmail: string | null;
  accessGrantedAt: string | null;
  /** Last paid Shopify order (ISO) */
  lastPurchaseAt: string | null;
  /** lastPurchaseAt + 40 days */
  accessExpiresAt: string | null;
  /** Name imported from the store customer (first + last) */
  shopifyDisplayName: string | null;
  /** base | performance — from Shopify products/tags */
  accessTier: "base" | "performance";
  /** PRODUCTS.id mapped from last paid order */
  purchaseProductIds: string[];
  /** Restock estimates keyed by product id */
  restockEstimates: Record<
    string,
    {
      emptyAt: string;
      productId: string;
      daysLeft: number;
      quantity: number;
      confidence?: number;
      estimatedServingsLeft?: number;
      kind?: "estimate";
    }
  >;
  /** Banner "rotina da compra" dismissed */
  routineFromPurchase: boolean;
  routineFromPurchaseDismissed: boolean;
  /** YYYY-MM-DD last post-workout upsell shown */
  upsellShownDate: string | null;
  /** Manual daily state check-ins keyed by date */
  dayCheckIns: Record<string, DayCheckIn>;
  /** Living plan snapshots keyed by date */
  livingPlans: Record<string, LivingPlanSnapshot>;
  /** Baseline metric at challenge join (for relative % evolution) */
  challengeBaselines: Record<string, number>;
  /** Personalized absolute targets keyed by challenge id */
  challengePersonalTargets: Record<string, number>;
  /** Self-reported + ingested activity logs (steps, football, run_km) */
  activityLogs: ActivityLogEntry[];
  /** Wearable link state only — tokens never live here */
  wearableConnections: WearableConnection[];
  /** Last anti-fraud warning (spike / revisão). Never a ban. */
  lastFraudWarning: string | null;
  /** Hub ids the user joined (Creator OS MVP) */
  joinedHubIds: string[];
  /** Exercises the user prefers (planner bias) — legacy; prefer exercisePreferences */
  likedExerciseIds: string[];
  /** Exercises the user wants avoided when alternatives exist — legacy */
  dislikedExerciseIds: string[];
  /** Explicit exercise preferences (Deep Training) */
  exercisePreferences: Record<string, ExercisePreferenceValue>;
  /** Thumbs on today's living plan keyed by YYYY-MM-DD */
  livingPlanFeedback: Record<string, LivingPlanFeedback>;
  /** Local mirror of challenge_invites sent (Fase 16 gen-convide-3). */
  challengeInvitesSent: number;
  /** Last Coach overlay dismiss (ISO). Cap 1/day. */
  coachNudgeDismissedAt: string | null;
  /** Last Coach overlay shown (ISO). Cap 1/day. */
  coachNudgeShownAt: string | null;
}

export const emptyState: AppState = {
  profile: null,
  sessions: [],
  weights: [],
  measurements: [],
  progressPhotos: [],
  days: {},
  meals: [],
  supplementLogs: {},
  supplementDoseLogs: [],
  supplementFrequencies: {},
  supplementRoutine: [],
  challenges: [],
  chat: [],
  theme: "dark",
  dimensionSnapshots: [],
  earnedBadges: [],
  shareProgress: true,
  socialPrivacy: {
    profile: "public",
    workouts: "public",
    prs: "public",
    weight: "private",
    photos: "private",
    nutrition: "private",
  },
  sessionFx: true,
  favoriteMealPresetIds: [],
  savedMeals: [],
  remindersEnabled: false,
  reminderHour: 18,
  pushPrefs: { workout: true, streak: true, challenge: true, kudos: true },
  termsAcceptedAt: null,
  privacyAcceptedAt: null,
  healthPurposeAckAt: null,
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
  dayCheckIns: {},
  livingPlans: {},
  challengeBaselines: {},
  challengePersonalTargets: {},
  activityLogs: [],
  wearableConnections: [],
  lastFraudWarning: null,
  joinedHubIds: [],
  likedExerciseIds: [],
  dislikedExerciseIds: [],
  exercisePreferences: {},
  livingPlanFeedback: {},
  challengeInvitesSent: 0,
  coachNudgeDismissedAt: null,
  coachNudgeShownAt: null,
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

export const FOCUS_MUSCLE_LABEL: Record<FocusMuscle, string> = {
  peito: "Peito",
  costas: "Costas",
  pernas: "Pernas",
  ombros: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  core: "Core",
};

export const GYM_GEAR_LABEL: Record<GymGear, string> = {
  barra: "Barra",
  halteres: "Halteres",
  maquinas: "Máquinas",
  elasticos: "Elásticos",
  peso_corporal: "Peso do corpo",
};

export const BLOCKER_LABEL: Record<PrimaryBlocker, string> = {
  sono: "Sono / recuperação",
  alimentacao: "Alimentação",
  consistencia: "Consistência",
  tempo: "Falta de tempo",
  equipamento: "Equipamento limitado",
};

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  cafe: "Café",
  almoco: "Almoço",
  lanche: "Lanche",
  jantar: "Jantar",
};

import { getUserTodayKey, DEFAULT_USER_TIMEZONE } from "@/lib/timezone";

/** Calendar day key — uses America/Sao_Paulo by default (not raw UTC). */
export const todayKey = (d: Date = new Date()) => getUserTodayKey(DEFAULT_USER_TIMEZONE, d);

