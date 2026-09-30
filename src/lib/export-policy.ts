/**
 * LGPD export policy — what is included vs intentionally excluded.
 */

export const EXPORT_INCLUDED = [
  "profile",
  "sessions",
  "weights",
  "measurements",
  "progressPhotos",
  "meals",
  "mealItems",
  "dailyMetrics",
  "supplementLogs",
  "supplementDoseLogs",
  "events",
  "prefs",
  "devices",
] as const;

/** Explicit exclusions (not secrets — policy transparency). */
export const EXPORT_EXCLUDED = [
  {
    key: "orders",
    reason: "Shopify commerce ledger retained separately; not dumped to client export",
  },
  {
    key: "app_entitlement_emails",
    reason: "Entitlement ledger; not personal content export",
  },
  {
    key: "admin_audit_log",
    reason: "Internal security audit",
  },
  {
    key: "ai_audit_events",
    reason: "Internal AI security/observability; not user-portable content",
  },
  {
    key: "other_users",
    reason: "Never include other users' data",
  },
  {
    key: "secrets_tokens",
    reason: "Never include API keys, session secrets, wearable refresh tokens in raw form",
  },
] as const;

export const EXPORT_PARTIAL = [
  {
    key: "social",
    reason: "Export includes own activity_events summary when available; full graph may be limited",
  },
  {
    key: "wearable_connections",
    reason: "Provider ids only — tokens excluded",
  },
  {
    key: "ai_user_memory",
    reason: "Included when table readable; otherwise omitted with note",
  },
] as const;
