/**
 * Single contract for onboarding / activation completeness.
 * Gate uses profileExists; macros need activationReady; meal slots need nutritionReady;
 * sleep/blocker stay progressive as recoveryReady.
 */
import type { Profile } from "@/lib/types";

export function isBodyComplete(profile: Pick<Profile, "age" | "heightCm" | "weightKg">): boolean {
  return profile.age >= 16 && profile.heightCm >= 130 && profile.weightKg >= 35;
}

export function isBodyValidForSave(age: number, heightCm: number, weightKg: number): boolean {
  return (
    age >= 16 &&
    age <= 80 &&
    heightCm >= 130 &&
    heightCm <= 220 &&
    weightKg >= 35 &&
    weightKg <= 250
  );
}

/** First-party profile row exists (wizard finished enough to leave gate). */
export function profileExists(profile: Profile | null | undefined): boolean {
  return Boolean(profile?.name?.trim());
}

/** Body metrics good enough for calibrated nutrition / water. */
export function isActivationReady(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return isBodyComplete(profile);
}

/**
 * Nutrition prefs persisted — nutritionProfile present (even empty restrictions)
 * or legacy flags that imply meal-slot derivation was intentional.
 */
export function isNutritionReady(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.nutritionProfile != null) return true;
  // Explicit false/true on skipBreakfast after onboarding counts as set
  if (profile.skipBreakfast === true || profile.lunchOutOften === true) return true;
  return false;
}

export function isRecoveryReady(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(profile.typicalSleepHours) && Boolean(profile.primaryBlocker);
}

/** Wizard should set onboardingComplete only when body + nutrition are ready. */
export function isOnboardingFullyComplete(profile: Profile | null | undefined): boolean {
  return isActivationReady(profile) && isNutritionReady(profile);
}

/** Home soft-prompt: recovery missing, or legacy user missing body/nutri. */
export function needsProfileEnrichment(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.onboardingComplete === false) return true;
  if (!isActivationReady(profile)) return true;
  if (!isNutritionReady(profile)) return true;
  if (!isRecoveryReady(profile)) return true;
  return false;
}

export type EnrichmentKind = "body" | "nutrition" | "recovery";

export function enrichmentPriority(profile: Profile): EnrichmentKind {
  if (!isActivationReady(profile)) return "body";
  if (!isNutritionReady(profile)) return "nutrition";
  return "recovery";
}
