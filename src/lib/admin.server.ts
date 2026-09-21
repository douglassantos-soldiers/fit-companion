/**
 * Server-only Admin Console helpers (CMS, lookup, entitlement, Shopify ops).
 */
import { requireAdminSession } from "@/lib/access-session.server";
import { adminDbLoose } from "@/lib/db-admin";
import { emptyCmsState, type CmsState } from "@/lib/cms";
import { isSoldiersOwnedUrl } from "@/lib/soldiers-media-governance";
import type { AccessTier } from "@/data/shopify-product-map";
import { isAccountBlocked, normalizeAccountStatus } from "@/lib/account-status";

export const ADMIN_ACTOR = "pin-admin";

export type AdminAuditAction =
  | "cms_save"
  | "entitlement_resync"
  | "entitlement_grant"
  | "entitlement_revoke"
  | "user_suspend"
  | "user_ban"
  | "user_unsuspend"
  | "catalog_exercise_save"
  | "catalog_challenge_save"
  | "training_rules_save"
  | "content_item_save"
  | "content_item_delete"
  | "expert_save"
  | "program_save"
  | "collection_save"
  | "content_report_resolve"
  | "activity_hide"
  | "activity_unhide"
  | "comment_hide"
  | "comment_unhide"
  | "shopify_customers_import"
  | "media_status_change";

export type AdminUserLookup = {
  email: string;
  userId: string | null;
  accountStatus: {
    status: "active" | "suspended" | "banned";
    statusUntil: string | null;
    statusReason: string | null;
    blocked: boolean;
  } | null;
  profile: {
    customerId: string | null;
    productIds: string[];
    accessTier: AccessTier;
    orderCount: number;
  } | null;
  entitlement: {
    accessTier: AccessTier;
    productIds: string[];
    customerId: string | null;
    lastOrderAt: string | null;
    updatedAt: string | null;
  } | null;
  devices: Array<{ deviceId: string; lastSeenAt: string | null }>;
  orders: Array<{
    shopifyOrderId: string;
    orderedAt: string | null;
    total: number | null;
    financialStatus: string | null;
    productTitles: string[];
  }>;
};

export type ShopifyOpsSnapshot = {
  webhooks: Array<{
    id: string;
    topic: string;
    webhookId: string | null;
    shopDomain: string | null;
    processedAt: string;
  }>;
  cursors: Array<{ id: string; cursorValue: string | null; updatedAt: string }>;
};

const emptyCms = (): CmsState => emptyCmsState();

export function assertAdmin() {
  requireAdminSession();
}

export async function writeAudit(
  action: AdminAuditAction,
  target: Record<string, unknown>,
  actor: string = ADMIN_ACTOR,
): Promise<void> {
  const db = await adminDbLoose();
  if (!db) return;
  const { error } = await db.from("admin_audit_log").insert({
    action,
    target,
    actor,
  });
  if (error) console.error("admin_audit_log insert failed", error);
}

export async function readCmsOverrides(): Promise<CmsState> {
  const db = await adminDbLoose();
  if (!db) return emptyCms();
  let { data, error } = await db
    .from("cms_overrides")
    .select("entity_type, entity_id, media_url, note, authorized");
  if (error) {
    console.warn("cms_overrides authorized column missing, falling back", error.message);
    const retry = await db.from("cms_overrides").select("entity_type, entity_id, media_url, note");
    data = retry.data;
    error = retry.error;
  }
  if (error) {
    console.error("cms_overrides read failed", error);
    return emptyCms();
  }
  const state = emptyCms();
  for (const row of data ?? []) {
    const type = String(row.entity_type);
    const id = String(row.entity_id);
    const media = row.media_url != null ? String(row.media_url) : "";
    const note = row.note != null ? String(row.note) : "";
    const authorized = Boolean(row.authorized) && isSoldiersOwnedUrl(media);
    if (type === "exercise") {
      if (media) state.exerciseMedia[id] = media;
      if (note) state.workoutNotes[id] = note;
      if (media) state.exerciseMediaAuthorized[id] = authorized;
    } else if (type === "meal") {
      if (media) state.mealImages[id] = media;
      if (media) state.mealImagesAuthorized[id] = authorized;
    }
  }
  return state;
}

export async function upsertCmsOverrides(
  cms: CmsState,
  actor: string = ADMIN_ACTOR,
): Promise<{ ok: true; count: number } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };

  const now = new Date().toISOString();
  const rows: Array<{
    entity_type: "exercise" | "meal";
    entity_id: string;
    media_url: string | null;
    note: string | null;
    authorized: boolean;
    authorized_at: string | null;
    authorized_by: string | null;
    updated_at: string;
    updated_by: string;
  }> = [];

  const exerciseIds = new Set([
    ...Object.keys(cms.exerciseMedia),
    ...Object.keys(cms.workoutNotes),
  ]);
  for (const id of exerciseIds) {
    const media = (cms.exerciseMedia[id] ?? "").trim();
    const note = (cms.workoutNotes[id] ?? "").trim();
    if (!media && !note) continue;
    const authorized = Boolean(cms.exerciseMediaAuthorized[id]) && isSoldiersOwnedUrl(media);
    rows.push({
      entity_type: "exercise",
      entity_id: id,
      media_url: media || null,
      note: note || null,
      authorized,
      authorized_at: authorized ? now : null,
      authorized_by: authorized ? actor : null,
      updated_at: now,
      updated_by: actor,
    });
  }

  for (const [id, url] of Object.entries(cms.mealImages)) {
    const media = url.trim();
    if (!media) continue;
    const authorized = Boolean(cms.mealImagesAuthorized[id]) && isSoldiersOwnedUrl(media);
    rows.push({
      entity_type: "meal",
      entity_id: id,
      media_url: media,
      note: null,
      authorized,
      authorized_at: authorized ? now : null,
      authorized_by: authorized ? actor : null,
      updated_at: now,
      updated_by: actor,
    });
  }

  if (rows.length === 0) {
    const { error: delAllErr } = await db.from("cms_overrides").delete().neq("entity_id", "");
    if (delAllErr) {
      console.error("cms_overrides clear failed", delAllErr);
      return { ok: false, reason: "upsert_failed" };
    }
    await writeAudit("cms_save", { count: 0, empty: true }, actor);
    return { ok: true, count: 0 };
  }

  const { error: delErr } = await db.from("cms_overrides").delete().neq("entity_id", "");
  if (delErr) {
    console.error("cms_overrides replace-delete failed", delErr);
    return { ok: false, reason: "upsert_failed" };
  }

  const { error } = await db.from("cms_overrides").insert(rows);
  if (error) {
    console.error("cms_overrides insert failed", error);
    return { ok: false, reason: "upsert_failed" };
  }

  await writeAudit("cms_save", { count: rows.length }, actor);
  return { ok: true, count: rows.length };
}

export async function lookupUserByEmail(email: string): Promise<AdminUserLookup> {
  const normalized = email.trim().toLowerCase();
  const empty: AdminUserLookup = {
    email: normalized,
    userId: null,
    accountStatus: null,
    profile: null,
    entitlement: null,
    devices: [],
    orders: [],
  };
  if (!normalized.includes("@")) return empty;

  const db = await adminDbLoose();
  const { resolveAccessProfileForEmail, findEntitlementByEmail } =
    await import("@/lib/shopify.server");

  const profile = await resolveAccessProfileForEmail(normalized);
  const ent = await findEntitlementByEmail(normalized);

  let userId: string | null = null;
  let devices: AdminUserLookup["devices"] = [];
  let orders: AdminUserLookup["orders"] = [];
  let entitlementMeta: AdminUserLookup["entitlement"] = null;
  let accountStatus: AdminUserLookup["accountStatus"] = null;

  if (db) {
    const { data: user } = await db
      .from("users")
      .select("id, email, status, status_until, status_reason")
      .ilike("email", normalized)
      .maybeSingle();
    userId = (user?.id as string | undefined) ?? null;
    if (user) {
      const status = normalizeAccountStatus(user.status as string | null);
      const statusUntil = (user.status_until as string | null) ?? null;
      accountStatus = {
        status,
        statusUntil,
        statusReason: (user.status_reason as string | null) ?? null,
        blocked: isAccountBlocked({ status, statusUntil }),
      };
    }

    if (userId) {
      const { data: deviceRows } = await db
        .from("devices")
        .select("device_id, last_seen_at")
        .eq("user_id", userId);
      devices = (deviceRows ?? []).map((d: { device_id: unknown; last_seen_at: unknown }) => ({
        deviceId: String(d.device_id),
        lastSeenAt: (d.last_seen_at as string | null) ?? null,
      }));

      const { data: orderRows } = await db
        .from("orders")
        .select("id, shopify_order_id, ordered_at, total, financial_status")
        .eq("user_id", userId)
        .order("ordered_at", { ascending: false })
        .limit(10);

      for (const o of orderRows ?? []) {
        const oid = o.id as string;
        const { data: items } = await db
          .from("order_items")
          .select("product_title")
          .eq("order_id", oid)
          .limit(8);
        orders.push({
          shopifyOrderId: String(o.shopify_order_id),
          orderedAt: (o.ordered_at as string | null) ?? null,
          total: typeof o.total === "number" ? o.total : o.total != null ? Number(o.total) : null,
          financialStatus: (o.financial_status as string | null) ?? null,
          productTitles: (items ?? [])
            .map((i: { product_title: unknown }) => (i.product_title as string | null) ?? "")
            .filter(Boolean),
        });
      }
    }

    const { data: emailRow } = await db
      .from("app_entitlement_emails")
      .select("access_tier, product_ids, shopify_customer_id, last_order_at, updated_at")
      .eq("email", normalized)
      .maybeSingle();

    if (emailRow) {
      entitlementMeta = {
        accessTier: emailRow.access_tier === "performance" ? "performance" : "base",
        productIds: (emailRow.product_ids as string[]) ?? [],
        customerId: (emailRow.shopify_customer_id as string | null) ?? null,
        lastOrderAt: (emailRow.last_order_at as string | null) ?? null,
        updatedAt: (emailRow.updated_at as string | null) ?? null,
      };
    } else if (ent) {
      entitlementMeta = {
        accessTier: ent.accessTier,
        productIds: ent.productIds,
        customerId: ent.customerId,
        lastOrderAt: ent.snapshot?.orderedAt ?? null,
        updatedAt: null,
      };
    }
  }

  return {
    email: normalized,
    userId,
    accountStatus,
    profile: profile
      ? {
          customerId: profile.customerId,
          productIds: profile.productIds,
          accessTier: profile.accessTier,
          orderCount: profile.orderCount,
        }
      : null,
    entitlement: entitlementMeta,
    devices,
    orders,
  };
}

export async function resyncEntitlementForEmail(
  email: string,
): Promise<{ ok: true; lookup: AdminUserLookup } | { ok: false; reason: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return { ok: false, reason: "invalid_email" };

  const { resolveAccessProfileForEmail, upsertEntitlementEmail, upsertDeviceEntitlementAdmin } =
    await import("@/lib/shopify.server");
  const { resolveOrCreateUserByEmail } = await import("@/lib/identity");
  const { upsertOrdersFromPaidList } = await import("@/lib/orders.server");

  const profile = await resolveAccessProfileForEmail(normalized);
  if (!profile) return { ok: false, reason: "no_entitlement" };

  const appUser = await resolveOrCreateUserByEmail(normalized);
  const userId = appUser?.id ?? null;

  const snapshot: OrderSnapshot = {
    orderId: null,
    email: normalized,
    customerId: profile.customerId,
    tags: [],
    lineItems: [],
    productIds: profile.productIds,
    accessTier: profile.accessTier,
    orderedAt: new Date().toISOString(),
    restockEstimates: profile.restockEstimates,
  };

  const magicToken = crypto.randomUUID();
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  await upsertEntitlementEmail({
    snapshot,
    magicTokenPlain: magicToken,
    magicExpiresAt: expires.toISOString(),
  });

  const db = await adminDbLoose();
  if (db && userId) {
    const { data: devices } = await db.from("devices").select("device_id").eq("user_id", userId);
    for (const d of devices ?? []) {
      await upsertDeviceEntitlementAdmin({
        deviceId: String(d.device_id),
        email: normalized,
        shopifyCustomerId: profile.customerId,
        orderCount: profile.orderCount,
        accessTier: profile.accessTier,
        productIds: profile.productIds,
      });
    }
    try {
      const { fetchPaidOrdersByEmailServer } = await import("@/lib/shopify-orders.server");
      const { orders } = await fetchPaidOrdersByEmailServer(normalized);
      await upsertOrdersFromPaidList({ userId, orders });
    } catch (e) {
      console.warn("resyncEntitlement order sync skipped", e);
    }
    void import("@/lib/customer360/recompute.server")
      .then(({ recomputeCustomerProfile }) => recomputeCustomerProfile(userId))
      .catch(() => undefined);
  }

  await writeAudit("entitlement_resync", {
    email: normalized,
    accessTier: profile.accessTier,
    orderCount: profile.orderCount,
  });

  const lookup = await lookupUserByEmail(normalized);
  return { ok: true, lookup };
}

export async function setEntitlementManual(opts: {
  email: string;
  action: "grant" | "revoke";
  tier?: AccessTier;
}): Promise<{ ok: true; lookup: AdminUserLookup } | { ok: false; reason: string }> {
  const normalized = opts.email.trim().toLowerCase();
  if (!normalized.includes("@")) return { ok: false, reason: "invalid_email" };

  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };

  const { resolveOrCreateUserByEmail } = await import("@/lib/identity");
  const { upsertEntitlementEmail, upsertDeviceEntitlementAdmin } =
    await import("@/lib/shopify.server");

  if (opts.action === "revoke") {
    const { data: user } = await db
      .from("users")
      .select("id")
      .ilike("email", normalized)
      .maybeSingle();
    const userId = (user?.id as string | undefined) ?? null;
    if (userId) {
      const { data: devices } = await db.from("devices").select("device_id").eq("user_id", userId);
      for (const d of devices ?? []) {
        await db.from("app_entitlements").delete().eq("device_id", d.device_id);
      }
    }
    await db.from("app_entitlement_emails").delete().eq("email", normalized);
    await db.from("app_entitlements").delete().eq("email", normalized);

    await writeAudit("entitlement_revoke", { email: normalized });
    const lookup = await lookupUserByEmail(normalized);
    return { ok: true, lookup };
  }

  const tier: AccessTier = opts.tier === "performance" ? "performance" : "base";
  const appUser = await resolveOrCreateUserByEmail(normalized);
  const userId = appUser?.id ?? null;

  const now = new Date().toISOString();
  const snapshot: OrderSnapshot = {
    orderId: null,
    email: normalized,
    customerId: null,
    tags: ["admin_manual"],
    lineItems: [],
    productIds: [],
    accessTier: tier,
    orderedAt: now,
    restockEstimates: {},
  };

  const magicToken = crypto.randomUUID();
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  await upsertEntitlementEmail({
    snapshot,
    magicTokenPlain: magicToken,
    magicExpiresAt: expires.toISOString(),
  });

  if (userId) {
    const { data: devices } = await db.from("devices").select("device_id").eq("user_id", userId);
    for (const d of devices ?? []) {
      await upsertDeviceEntitlementAdmin({
        deviceId: String(d.device_id),
        email: normalized,
        shopifyCustomerId: null,
        orderCount: 1,
        accessTier: tier,
        productIds: [],
      });
    }
  }

  await writeAudit("entitlement_grant", { email: normalized, accessTier: tier });
  const lookup = await lookupUserByEmail(normalized);
  return { ok: true, lookup };
}

export async function importShopifyCustomersBatch(opts?: {
  reset?: boolean;
}): Promise<import("@/lib/shopify-customers").ShopifyCustomerImportBatchResult> {
  const { importShopifyCustomersBatch: run } = await import("@/lib/shopify-customers.server");
  const result = await run(opts);
  await writeAudit("shopify_customers_import", {
    processed: result.processed,
    created: result.created,
    linked: result.linked,
    skippedNoEmail: result.skippedNoEmail,
    ordersUpserted: result.ordersUpserted,
    hasMore: result.hasMore,
    errorCount: result.errors.length,
    reset: opts?.reset === true,
  });
  return result;
}

export async function listShopifyOps(limit = 40): Promise<ShopifyOpsSnapshot> {
  const db = await adminDbLoose();
  if (!db) return { webhooks: [], cursors: [] };

  const { data: webhookRows } = await db
    .from("shopify_webhook_events")
    .select("id, topic, webhook_id, shop_domain, processed_at")
    .order("processed_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));

  const { data: cursorRows } = await db
    .from("shopify_sync_cursors")
    .select("id, cursor_value, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);

  return {
    webhooks: (webhookRows ?? []).map(
      (w: {
        id: unknown;
        topic: unknown;
        webhook_id: unknown;
        shop_domain: unknown;
        processed_at: unknown;
      }) => ({
        id: String(w.id),
        topic: String(w.topic),
        webhookId: (w.webhook_id as string | null) ?? null,
        shopDomain: (w.shop_domain as string | null) ?? null,
        processedAt: String(w.processed_at),
      }),
    ),
    cursors: (cursorRows ?? []).map(
      (c: { id: unknown; cursor_value: unknown; updated_at: unknown }) => ({
        id: String(c.id),
        cursorValue: (c.cursor_value as string | null) ?? null,
        updatedAt: String(c.updated_at),
      }),
    ),
  };
}
