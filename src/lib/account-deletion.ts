/**
 * Account deletion / LGPD wipe inventory and execution.
 *
 * Classification:
 * - DELETE: personal/domain data that must disappear
 * - ANONYMIZE: commerce rows that keep integrity but drop identity (via ON DELETE SET NULL on users)
 * - RETAIN: security/commerce/system rows that must survive (documented; never wiped here)
 *
 * Prefer deleting the `users` row last so FK ON DELETE CASCADE cleans residual children.
 */

export type DeletionClass = "delete" | "anonymize" | "retain";

export type TableWipeSpec = {
  table: string;
  class: DeletionClass;
  /** Column(s) matching public.users.id — OR'd when multiple. */
  userIdColumns?: readonly string[];
  /** Wipe via device_id after resolving devices for the user. */
  deviceIdColumn?: string;
  notes?: string;
};

/** Personal / domain tables wiped by user_id (single column). */
export const CLEAR_BY_USER_ID: readonly string[] = [
  // Core training / nutrition / progress
  "sessions",
  "weights",
  "body_measurements",
  "progress_photos",
  "daily_metrics",
  "supplement_logs",
  "supplement_dose_logs",
  "app_state",
  "profiles",
  "meal_entries",
  "meal_items",
  "day_checkins",
  "exercise_performance",
  "personal_records",
  "exercise_preferences",
  "muscle_load_snapshots",
  // Customer 360 / decisions / learning
  "customer_profiles",
  "decision_context_snapshots",
  "decision_outcomes",
  "decision_actions",
  "recommendation_decisions",
  "user_patterns",
  "user_events",
  // Push
  "push_subscriptions",
  "push_sends",
  // Coach / behavior
  "coach_memories",
  "coach_sessions",
  "coach_proposals",
  "behavior_patterns",
  "behavior_interventions",
  "behavior_outcomes",
  "behavior_experiments",
  // AI memory / learning / audit (user-scoped)
  "ai_user_memory",
  "ai_decision_memory",
  "ai_outcome_memory",
  "ai_learning_events",
  "ai_audit_events",
  // Wearables / content progress / impressions
  "wearable_connections",
  "content_progress",
  "feed_impressions",
  "content_impressions",
  "content_dismissals",
  // Social graph (user_id column)
  "activity_comments",
  "activity_reactions",
  "feed_dismissals",
  "challenge_entries",
  "challenge_progress",
  "club_members",
  "hub_members",
  "activity_events",
  "engagement_events",
  "devices",
] as const;

/** Tables with alternate / multi user-id columns. */
export const CLEAR_BY_USER_ID_MULTI: readonly {
  table: string;
  columns: readonly string[];
}[] = [
  { table: "social_follows", columns: ["follower_id", "following_id"] },
  { table: "social_blocks", columns: ["blocker_id", "blocked_id"] },
  { table: "social_mutes", columns: ["user_id", "muted_id"] },
  { table: "challenge_invites", columns: ["from_user_id", "to_user_id"] },
  { table: "friend_quests", columns: ["user_id_a", "user_id_b"] },
  { table: "social_profiles", columns: ["app_user_id", "user_id"] },
  { table: "content_reports", columns: ["reporter_user_id"] },
  { table: "app_entitlements", columns: ["user_id"] },
] as const;

/** Legacy device_id rows (after resolving devices for the user). */
export const CLEAR_BY_DEVICE_ID: readonly string[] = [
  "activity_kudos",
  "club_stories",
  "social_profiles",
  "challenge_entries",
  "challenge_progress",
  "club_members",
  "hub_members",
  "activity_events",
  "engagement_events",
] as const;

/**
 * RETAIN — never deleted by account wipe.
 * Commerce / security / system corpus.
 */
export const RETAIN_ON_ACCOUNT_DELETION: readonly { table: string; reason: string }[] = [
  { table: "orders", reason: "commerce integrity; user_id SET NULL on users delete" },
  { table: "order_items", reason: "commerce line items via orders FK" },
  { table: "app_entitlement_emails", reason: "Shopify entitlement ledger keyed by email" },
  { table: "shopify_webhook_events", reason: "idempotency / audit of commerce webhooks" },
  { table: "shopify_sync_cursors", reason: "system sync state" },
  { table: "admin_audit_log", reason: "security audit retention" },
  { table: "cms_overrides", reason: "global CMS, not user-owned" },
  { table: "ai_knowledge_sources", reason: "shared RAG corpus" },
  { table: "ai_knowledge_documents", reason: "shared RAG corpus" },
  { table: "ai_knowledge_chunks", reason: "shared RAG corpus" },
  { table: "ai_rate_limit_buckets", reason: "abuse control; not personal content" },
  { table: "food_items", reason: "shared nutrition catalog" },
  { table: "catalog_exercises", reason: "shared exercise catalog" },
  { table: "soldiers_media", reason: "brand media library" },
] as const;

/** Backward-compatible export used by sync.server wipe loop. */
export const CLEAR_USER_CORE_TABLES = CLEAR_BY_USER_ID;

export type WipeDb = {
  from: (table: string) => {
    delete: () => {
      eq: (col: string, val: string) => PromiseLike<{ error: { code?: string; message?: string } | null }>;
      in?: (col: string, vals: string[]) => PromiseLike<{ error: { code?: string; message?: string } | null }>;
      or?: (filter: string) => PromiseLike<{ error: { code?: string; message?: string } | null }>;
    };
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => PromiseLike<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
    };
  };
};

export type WipeResult = {
  ok: boolean;
  partial?: boolean;
  errors: Array<{ table: string; code: string }>;
  deletedTables: string[];
  usersRowDeleted: boolean;
};

function isMissingTable(error: { message?: string } | null): boolean {
  return String(error?.message ?? "").includes("does not exist");
}

async function deleteEq(
  db: WipeDb,
  table: string,
  col: string,
  val: string,
): Promise<{ error: { code?: string; message?: string } | null }> {
  return db.from(table).delete().eq(col, val);
}

async function deleteOrUserColumns(
  db: WipeDb,
  table: string,
  columns: readonly string[],
  userId: string,
): Promise<{ error: { code?: string; message?: string } | null }> {
  const del = db.from(table).delete();
  if (typeof del.or === "function") {
    const filter = columns.map((c) => `${c}.eq.${userId}`).join(",");
    return del.or(filter);
  }
  // Fallback: sequential deletes per column
  let last: { error: { code?: string; message?: string } | null } = { error: null };
  for (const col of columns) {
    last = await deleteEq(db, table, col, userId);
    if (last.error && !isMissingTable(last.error)) return last;
  }
  return last;
}

async function deleteInDeviceIds(
  db: WipeDb,
  table: string,
  deviceIds: string[],
): Promise<{ error: { code?: string; message?: string } | null }> {
  if (!deviceIds.length) return { error: null };
  const del = db.from(table).delete();
  if (typeof del.in === "function") {
    return del.in("device_id", deviceIds);
  }
  let last: { error: { code?: string; message?: string } | null } = { error: null };
  for (const id of deviceIds) {
    last = await deleteEq(db, table, "device_id", id);
    if (last.error && !isMissingTable(last.error)) return last;
  }
  return last;
}

/**
 * Execute wipe against an admin/service_role client.
 * Does not touch RETAIN tables. Deletes `users` row last for CASCADE cleanup.
 */
export async function executeAccountWipe(
  db: WipeDb,
  opts: {
    userId: string;
    deviceIds?: string[];
    onError?: (table: string, code: string) => void;
    onOk?: (table: string) => void;
  },
): Promise<WipeResult> {
  const errors: Array<{ table: string; code: string }> = [];
  const deletedTables: string[] = [];
  const { userId } = opts;

  let deviceIds = opts.deviceIds ?? [];
  if (!deviceIds.length) {
    try {
      const { data } = await db.from("devices").select("device_id").eq("user_id", userId);
      deviceIds = (data ?? [])
        .map((r) => String(r["device_id"] ?? ""))
        .filter(Boolean);
    } catch {
      deviceIds = [];
    }
  }

  const record = (
    table: string,
    error: { code?: string; message?: string } | null,
  ) => {
    if (error && !isMissingTable(error)) {
      const code = String(error.code ?? "delete_failed");
      errors.push({ table, code });
      opts.onError?.(table, code);
      return;
    }
    if (!error || isMissingTable(error)) {
      if (!error) {
        deletedTables.push(table);
        opts.onOk?.(table);
      }
    }
  };

  for (const table of CLEAR_BY_USER_ID) {
    // devices deleted near the end before users
    if (table === "devices") continue;
    try {
      const { error } = await deleteEq(db, table, "user_id", userId);
      record(table, error);
    } catch (e) {
      const code = e instanceof Error ? e.message.slice(0, 40) : "exception";
      errors.push({ table, code });
      opts.onError?.(table, code);
    }
  }

  for (const spec of CLEAR_BY_USER_ID_MULTI) {
    try {
      const { error } = await deleteOrUserColumns(db, spec.table, spec.columns, userId);
      record(spec.table, error);
    } catch (e) {
      const code = e instanceof Error ? e.message.slice(0, 40) : "exception";
      errors.push({ table: spec.table, code });
      opts.onError?.(spec.table, code);
    }
  }

  for (const table of CLEAR_BY_DEVICE_ID) {
    try {
      const { error } = await deleteInDeviceIds(db, table, deviceIds);
      record(`${table}:device`, error);
    } catch (e) {
      const code = e instanceof Error ? e.message.slice(0, 40) : "exception";
      errors.push({ table: `${table}:device`, code });
      opts.onError?.(`${table}:device`, code);
    }
  }

  // Devices after domain/social rows that may still reference device_id
  try {
    const { error } = await deleteEq(db, "devices", "user_id", userId);
    record("devices", error);
  } catch (e) {
    const code = e instanceof Error ? e.message.slice(0, 40) : "exception";
    errors.push({ table: "devices", code });
  }

  // Users row last — CASCADE / SET NULL for residual FKs (orders keep commerce)
  let usersRowDeleted = false;
  try {
    const { error } = await deleteEq(db, "users", "id", userId);
    if (!error || isMissingTable(error)) {
      usersRowDeleted = !error;
      if (!error) {
        deletedTables.push("users");
        opts.onOk?.("users");
      }
    } else {
      record("users", error);
    }
  } catch (e) {
    const code = e instanceof Error ? e.message.slice(0, 40) : "exception";
    errors.push({ table: "users", code });
  }

  if (!deletedTables.length && errors.length) {
    return { ok: false, errors, deletedTables, usersRowDeleted };
  }
  if (errors.length) {
    return { ok: false, partial: true, errors, deletedTables, usersRowDeleted };
  }
  return { ok: true, errors, deletedTables, usersRowDeleted };
}

/** Required delete coverage for regression tests. */
export const REQUIRED_WIPE_TABLES = [
  "meal_items",
  "exercise_performance",
  "ai_user_memory",
  "ai_decision_memory",
  "ai_outcome_memory",
  "ai_learning_events",
  "wearable_connections",
  "social_follows",
  "activity_events",
  "devices",
  "users",
] as const;
