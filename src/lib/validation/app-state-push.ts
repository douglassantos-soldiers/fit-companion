import { z } from "zod";
import { sanitizeBio, sanitizeDisplayName, sanitizePlainText } from "@/lib/validation/common";
import type { AppState } from "@/lib/types";

const GoalSchema = z.enum(["massa", "gordura", "performance", "saude"]);
const LevelSchema = z.enum(["iniciante", "intermediario", "avancado"]);
const EquipmentSchema = z.enum(["casa", "academia"]);
const ThemeSchema = z.enum(["dark", "light"]);

const ProfilePushSchema = z
  .object({
    name: z.string().max(120).optional(),
    goal: GoalSchema.optional(),
    level: LevelSchema.optional(),
    daysPerWeek: z.number().int().min(1).max(7).optional(),
    age: z.number().finite().min(0).max(120).optional(),
    heightCm: z.number().finite().min(0).max(300).optional(),
    weightKg: z.number().finite().min(0).max(500).optional(),
    equipment: EquipmentSchema.optional(),
    restrictions: z.array(z.string().max(80)).max(40).optional(),
    timezone: z.string().max(64).optional(),
    skipBreakfast: z.boolean().optional(),
    lunchOutOften: z.boolean().optional(),
    typicalSleepHours: z.number().finite().min(0).max(24).optional(),
    primaryBlocker: z.string().max(40).optional(),
    trainingWeekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    focusMuscles: z.array(z.string().max(40)).max(20).optional(),
    equipmentInventory: z.array(z.string().max(40)).max(30).optional(),
    typicalSessionMin: z.number().finite().min(0).max(300).optional(),
    onboardingComplete: z.boolean().optional(),
    version: z.number().finite().optional(),
    nutritionProfile: z.unknown().optional(),
  })
  .passthrough()
  .transform((p) => {
    if (typeof p.name === "string") {
      return { ...p, name: sanitizeDisplayName(p.name) };
    }
    return p;
  });

/** Cap large collections to limit abuse / DoS on push. */
function capArray<T>(arr: unknown, max: number): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, max) as T[];
}

/**
 * Boundary validation for pushState — not a full AppState schema.
 * Ensures object shape, profile enums, and array size caps.
 */
export const AppStatePushSchema = z
  .object({
    profile: ProfilePushSchema.nullable().optional(),
    sessions: z.array(z.unknown()).optional(),
    weights: z.array(z.unknown()).optional(),
    measurements: z.array(z.unknown()).optional(),
    progressPhotos: z.array(z.unknown()).optional(),
    meals: z.array(z.unknown()).optional(),
    chat: z.array(z.unknown()).optional(),
    theme: ThemeSchema.optional(),
    challenges: z.array(z.string().max(64)).optional(),
    earnedBadges: z.array(z.string().max(64)).optional(),
    favoriteMealPresetIds: z.array(z.string().max(64)).optional(),
    favoriteFoodIds: z.array(z.string().max(64)).optional(),
    customFoods: z.array(z.unknown()).optional(),
    savedMeals: z.array(z.unknown()).optional(),
    savedTrainingPlans: z.array(z.unknown()).optional(),
    activityLogs: z.array(z.unknown()).optional(),
    bio: z.string().max(500).optional(),
    appStateVersion: z.number().finite().optional(),
  })
  .passthrough()
  .transform((raw) => {
    const state = { ...raw } as Record<string, unknown>;
    if (typeof state["bio"] === "string") {
      state["bio"] = sanitizeBio(state["bio"]);
    }
    for (const [key, max] of [
      ["sessions", 500],
      ["weights", 500],
      ["measurements", 500],
      ["meals", 2000],
      ["chat", 200],
      ["progressPhotos", 200],
      ["activityLogs", 500],
      ["challenges", 100],
      ["earnedBadges", 200],
      ["favoriteMealPresetIds", 100],
      ["favoriteFoodIds", 80],
      ["customFoods", 80],
      ["savedMeals", 100],
      ["savedTrainingPlans", 50],
    ] as const) {
      if (key in state) state[key] = capArray(state[key], max);
    }
    if (typeof state["profile"] === "object" && state["profile"] && "name" in (state["profile"] as object)) {
      const profile = state["profile"] as { name?: string };
      if (typeof profile.name === "string") {
        profile.name = sanitizeDisplayName(profile.name);
      }
    }
    return state as unknown as AppState;
  });

export function parseAppStatePush(input: unknown): { deviceId: string; state: AppState } {
  const v = input as { deviceId?: string; state?: unknown } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  if (!v?.state || typeof v.state !== "object") throw new Error("state obrigatório");
  const state = AppStatePushSchema.parse(v.state);
  return { deviceId, state };
}

/** Soft text sanitize for free-form notes on check-in. */
export function sanitizeNotes(raw: string): string {
  return sanitizePlainText(raw, 280);
}
