/**
 * Shared numeric thresholds for Context / Safety / Decision engines.
 * Single source — do not re-declare sleep/time cutoffs in those modules.
 */

/** Check-in / decision: sleep below this (hours) → sleep_low / prefer light / block stims. */
export const SLEEP_LOW_HOURS = 6;

/** Available minutes below this → time_limited / express bias. */
export const TIME_LIMITED_MIN = 40;

/** Sleep hours (check-in) for “good sleep” seed when at or above. */
export const SLEEP_GOOD_HOURS = 7;

/** Very low sleep used for stronger deload volume in Decision Engine. */
export const SLEEP_VERY_LOW_HOURS = 5.5;
