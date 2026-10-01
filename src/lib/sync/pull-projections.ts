/**
 * Explicit column projections + history windows for pull/hydrate.
 * Avoid select("*") on large domain tables.
 * Columns must match generated Supabase types (no phantom fields).
 */

/** Days of history to pull for dated tables (sessions, meals, weights, …). */
export const PULL_HISTORY_DAYS = 90;

/** Max progress photos per user on pull. */
export const PULL_PHOTOS_LIMIT = 60;

/** Max supplement dose logs on pull. */
export const PULL_DOSE_LOGS_LIMIT = 500;

export function pullHistorySinceIso(days = PULL_HISTORY_DAYS): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export const PROFILE_PULL_COLS =
  "user_id, name, goal, level, days_per_week, age, height_cm, weight_kg, equipment, restrictions, prefs, timezone, version, created_at, updated_at";

export const SESSION_PULL_COLS =
  "user_id, client_id, day_id, title, date, duration_min, exercises, volume_kg, rpe, express, version, updated_at";

export const WEIGHT_PULL_COLS = "user_id, date, weight_kg, updated_at";

export const DAILY_METRICS_PULL_COLS = "user_id, date, water_ml, meals, updated_at";

export const SUPPLEMENT_LOG_PULL_COLS = "user_id, date, supplement_ids, updated_at";

/** Columns used by assembleStateFromRows + hydrateAppStateFromDb (extras live in retention JSON). */
export const APP_STATE_PULL_COLS =
  "user_id, supplement_routine, challenges, chat, retention, version, updated_at";

export const MEAL_ENTRY_PULL_COLS =
  "user_id, id, client_id, date, name, meal_type, protein_g, carbs_g, fat_g, fiber_g, kcal, payload, version, updated_at";

export const DAY_CHECKIN_PULL_COLS =
  "user_id, date, sleep, energy, soreness, stress, available_time, equipment, notes, version, updated_at";

export const DOSE_LOG_PULL_COLS =
  "user_id, id, client_id, product_id, dose, unit, frequency, taken_at, source, version, updated_at";

export const MEASUREMENT_PULL_COLS =
  "user_id, date, waist_cm, arm_cm, chest_cm, hip_cm, thigh_cm, updated_at";

export const PHOTO_PULL_COLS =
  "user_id, id, taken_on, pose, storage_path, visibility, updated_at";

export const DECISION_SNAPSHOT_PULL_COLS = "date, payload";
