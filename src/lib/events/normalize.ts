/**
 * Event normalization + metadata sanitization (no unnecessary sensitive data).
 */
import {
  LEGACY_EVENT_ALIASES,
  type LegacyEventAlias,
  type TrackUserEventInput,
  type UserEventType,
} from "@/lib/events/types";

const SENSITIVE_KEY_RE =
  /^(email|password|token|secret|authorization|cookie|ssn|cpf|phone|raw_snapshot|access_token|refresh_token|waist_cm|arm_cm|chest_cm|hip_cm|thigh_cm|waistcm|armcm|chestcm|hipcm|thighcm|storage_path|storagepath)$/i;

const MAX_METADATA_KEYS = 40;
const MAX_STRING_LEN = 500;
const MAX_NOTES_LEN = 280;

export function normalizeEventType(raw: string): UserEventType {
  const t = String(raw ?? "").trim();
  if (!t) return t;
  if (t in LEGACY_EVENT_ALIASES) {
    return LEGACY_EVENT_ALIASES[t as LegacyEventAlias];
  }
  return t;
}

export function resolveMetadata(input: Pick<TrackUserEventInput, "metadata" | "payload">): Record<string, unknown> {
  const raw =
    input.metadata && typeof input.metadata === "object"
      ? input.metadata
      : input.payload && typeof input.payload === "object"
        ? input.payload
        : {};
  return sanitizeMetadata(raw);
}

export function sanitizeMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, value] of Object.entries(input)) {
    if (count >= MAX_METADATA_KEYS) break;
    if (SENSITIVE_KEY_RE.test(key)) continue;
    const cleaned = sanitizeValue(key, value);
    if (cleaned === undefined) continue;
    out[key] = cleaned;
    count += 1;
  }
  return out;
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "boolean" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) return undefined;
    return value;
  }
  if (typeof value === "string") {
    const max = key === "notes" ? MAX_NOTES_LEN : MAX_STRING_LEN;
    return value.slice(0, max);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => {
      if (typeof v === "string") return v.slice(0, MAX_STRING_LEN);
      if (typeof v === "number" || typeof v === "boolean") return v;
      return undefined;
    }).filter((v) => v !== undefined);
  }
  if (typeof value === "object") {
    // Flatten one level only — avoid nested blobs
    return sanitizeMetadata(value as Record<string, unknown>);
  }
  return undefined;
}

/** Build idempotency keys for common entity events. */
export function buildIdempotencyKey(
  eventType: string,
  opts: { entityId?: string | null; date?: string | null; suffix?: string },
): string | undefined {
  const type = normalizeEventType(eventType);
  const id = opts.entityId?.trim();
  const date = opts.date?.slice(0, 10);
  switch (type) {
    case "workout_started":
    case "workout_completed":
    case "set_completed":
    case "workout_skipped":
    case "workout_modified":
      return id ? `workout:${id}:${type}${opts.suffix ? `:${opts.suffix}` : ""}` : undefined;
    case "meal_logged":
    case "meal_updated":
    case "meal_deleted":
      return id ? `meal:${id}:${type}${date ? `:${date}` : ""}` : undefined;
    case "checkin_completed":
      return date ? `checkin:${date}` : id ? `checkin:${id}` : undefined;
    case "weight_logged":
      return date ? `weight:${date}` : undefined;
    case "measurements_logged":
      return date ? `measurements:${date}` : undefined;
    case "progress_photo_uploaded":
      return id ? `progress_photo:${id}` : undefined;
    case "supplement_taken":
    case "supplement_skipped":
      return id && date ? `supplement:${id}:${type}:${date}` : undefined;
    case "challenge_joined":
    case "challenge_completed":
      return id ? `challenge:${id}:${type}` : undefined;
    case "purchase":
    case "refund":
      return id ? `${type}:${id}${opts.suffix ? `:${opts.suffix}` : ""}` : undefined;
    default:
      return undefined;
  }
}
