import type { SupabaseClient } from "@supabase/supabase-js";
import { adminDbLoose } from "@/lib/db-admin";

export type AppUser = {
  id: string;
  email: string | null;
  authUserId: string | null;
};

async function adminDb(): Promise<SupabaseClient | null> {
  const loose = await adminDbLoose();
  return loose as unknown as SupabaseClient | null;
}

function nowIso() {
  return new Date().toISOString();
}

/** Resolve user by email or create one. */
export async function resolveOrCreateUserByEmail(email: string): Promise<AppUser | null> {
  const db = await adminDb();
  if (!db) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return null;

  const { data: existing } = await db
    .from("users")
    .select("id, email, auth_user_id")
    .ilike("email", normalized)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id as string,
      email: (existing.email as string) ?? normalized,
      authUserId: (existing.auth_user_id as string | null) ?? null,
    };
  }

  const { data: created, error } = await db
    .from("users")
    .insert({ email: normalized, updated_at: nowIso() })
    .select("id, email, auth_user_id")
    .single();

  if (error || !created) {
    // Race: another insert won
    const { data: again } = await db
      .from("users")
      .select("id, email, auth_user_id")
      .ilike("email", normalized)
      .maybeSingle();
    if (!again) {
      console.error("resolveOrCreateUserByEmail failed", error);
      return null;
    }
    return {
      id: again.id as string,
      email: (again.email as string) ?? normalized,
      authUserId: (again.auth_user_id as string | null) ?? null,
    };
  }

  return {
    id: created.id as string,
    email: (created.email as string) ?? normalized,
    authUserId: (created.auth_user_id as string | null) ?? null,
  };
}

/** Create anonymous user (no email yet). */
export async function createAnonymousUser(): Promise<AppUser | null> {
  const db = await adminDb();
  if (!db) return null;
  const { data, error } = await db
    .from("users")
    .insert({ updated_at: nowIso() })
    .select("id, email, auth_user_id")
    .single();
  if (error || !data) {
    console.error("createAnonymousUser failed", error);
    return null;
  }
  return {
    id: data.id as string,
    email: (data.email as string | null) ?? null,
    authUserId: (data.auth_user_id as string | null) ?? null,
  };
}

/**
 * Attach device to user.
 * Safe by default: will not steal a device already owned by a different email user.
 * Use allowReassignFromAnonymous when merging Shopify email onto an anon device.
 */
export async function attachDeviceSafe(opts: {
  deviceId: string;
  userId: string;
  platform?: string;
  /** Allow re-link when current owner has no email (anonymous). */
  allowReassignFromAnonymous?: boolean;
  /** Force re-link (only after verified email ownership of both sides). */
  force?: boolean;
}): Promise<{ userId: string; deviceId: string } | null> {
  const db = await adminDb();
  if (!db) return null;
  const deviceId = opts.deviceId.trim();
  if (!deviceId) return null;

  const { data: existing } = await db
    .from("devices")
    .select("id, user_id, device_id")
    .eq("device_id", deviceId)
    .maybeSingle();

  if (existing) {
    const currentOwnerId = existing.user_id as string;
    if (currentOwnerId !== opts.userId) {
      if (!opts.force) {
        const { data: owner } = await db
          .from("users")
          .select("email")
          .eq("id", currentOwnerId)
          .maybeSingle();
        const ownerEmail = (owner?.email as string | null) ?? null;
        const canReassign =
          opts.allowReassignFromAnonymous === true && (!ownerEmail || !ownerEmail.includes("@"));
        if (!canReassign) {
          console.warn("attachDeviceSafe blocked reassign", { deviceId, currentOwnerId });
          return { userId: currentOwnerId, deviceId };
        }
      }
    }
    await db
      .from("devices")
      .update({
        user_id: opts.userId,
        last_seen_at: nowIso(),
        updated_at: nowIso(),
        platform: opts.platform ?? "web",
      })
      .eq("device_id", deviceId);
    return { userId: opts.userId, deviceId };
  }

  const { error } = await db.from("devices").insert({
    user_id: opts.userId,
    device_id: deviceId,
    platform: opts.platform ?? "web",
    last_seen_at: nowIso(),
    updated_at: nowIso(),
  });

  if (error) {
    console.error("attachDeviceSafe failed", error);
    return null;
  }
  return { userId: opts.userId, deviceId };
}

/** @deprecated Prefer attachDeviceSafe */
export async function attachDevice(opts: {
  deviceId: string;
  userId: string;
  platform?: string;
}): Promise<{ userId: string; deviceId: string } | null> {
  return attachDeviceSafe({ ...opts, allowReassignFromAnonymous: true });
}

/** Ensure device has a user; creates anonymous user if needed. */
export async function ensureUserForDevice(
  deviceId: string,
  platform = "web",
): Promise<AppUser | null> {
  const db = await adminDb();
  if (!db) return null;
  const id = deviceId.trim();
  if (!id) return null;

  const { data: existing } = await db
    .from("devices")
    .select("user_id, users:user_id (id, email, auth_user_id)")
    .eq("device_id", id)
    .maybeSingle();

  if (existing?.user_id) {
    await db
      .from("devices")
      .update({ last_seen_at: nowIso(), updated_at: nowIso() })
      .eq("device_id", id);

    const u = existing.users as unknown as {
      id: string;
      email: string | null;
      auth_user_id: string | null;
    } | null;

    if (u?.id) {
      return { id: u.id, email: u.email, authUserId: u.auth_user_id };
    }

    const { data: user } = await db
      .from("users")
      .select("id, email, auth_user_id")
      .eq("id", existing.user_id)
      .maybeSingle();
    if (user) {
      return {
        id: user.id as string,
        email: (user.email as string | null) ?? null,
        authUserId: (user.auth_user_id as string | null) ?? null,
      };
    }
  }

  const user = await createAnonymousUser();
  if (!user) return null;
  await attachDeviceSafe({ deviceId: id, userId: user.id, platform, allowReassignFromAnonymous: true });
  return user;
}

export async function getUserIdForDevice(deviceId: string): Promise<string | null> {
  const db = await adminDb();
  if (!db) return null;
  const { data } = await db
    .from("devices")
    .select("user_id")
    .eq("device_id", deviceId.trim())
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

/** Link Shopify customer identity to user. */
export async function linkShopifyIdentity(opts: {
  userId: string;
  shopifyCustomerId: string;
  externalEmail?: string | null;
}): Promise<boolean> {
  const db = await adminDb();
  if (!db) return false;
  const cid = String(opts.shopifyCustomerId).trim();
  if (!cid) return false;

  const { error } = await db.from("customer_identities").upsert(
    {
      user_id: opts.userId,
      provider: "shopify",
      external_customer_id: cid,
      external_email: opts.externalEmail?.trim().toLowerCase() ?? null,
      updated_at: nowIso(),
    },
    { onConflict: "provider,external_customer_id" },
  );

  if (error) {
    console.error("linkShopifyIdentity failed", error);
    return false;
  }
  return true;
}

/**
 * On Shopify access: resolve/create user by email, attach device, link Shopify identity.
 * Prefer email user over anonymous device user (merge by re-linking device).
 */
export async function linkDeviceToShopifyUser(opts: {
  deviceId: string;
  email: string;
  shopifyCustomerId?: string | null;
}): Promise<AppUser | null> {
  const user = await resolveOrCreateUserByEmail(opts.email);
  if (!user) return null;

  if (opts.deviceId) {
    await attachDeviceSafe({
      deviceId: opts.deviceId,
      userId: user.id,
      allowReassignFromAnonymous: true,
    });
    // Stamp user_id on domain rows for this device (best-effort)
    await stampUserIdOnDeviceRows(opts.deviceId, user.id);
  }

  if (opts.shopifyCustomerId) {
    await linkShopifyIdentity({
      userId: user.id,
      shopifyCustomerId: opts.shopifyCustomerId,
      externalEmail: opts.email,
    });
  }

  return user;
}

async function stampUserIdOnDeviceRows(deviceId: string, userId: string): Promise<void> {
  const db = await adminDbLoose();
  if (!db) return;
  const tables = [
    "profiles",
    "sessions",
    "weights",
    "daily_metrics",
    "supplement_logs",
    "app_state",
    "engagement_events",
    "meal_entries",
  ] as const;
  await Promise.all(
    tables.map(async (table) => {
      try {
        await db.from(table).update({ user_id: userId }).eq("device_id", deviceId);
      } catch {
        /* column may not exist yet */
      }
    }),
  );
}

/** Bind Supabase Auth UUID to public.users.auth_user_id for the given app user. */
export async function linkAuthUserId(opts: {
  userId: string;
  authUserId: string;
}): Promise<boolean> {
  const db = await adminDb();
  if (!db) return false;
  const userId = opts.userId.trim();
  const authUserId = opts.authUserId.trim();
  if (!userId || !authUserId) return false;

  // Clear previous binding if auth uuid already linked elsewhere
  await db
    .from("users")
    .update({ auth_user_id: null, updated_at: nowIso() })
    .eq("auth_user_id", authUserId)
    .neq("id", userId);

  const { error } = await db
    .from("users")
    .update({ auth_user_id: authUserId, updated_at: nowIso() })
    .eq("id", userId);

  if (error) {
    console.error("linkAuthUserId failed", error);
    return false;
  }
  return true;
}

/** List device_ids belonging to a user (for multi-device pull). */
export async function listDeviceIdsForUser(userId: string): Promise<string[]> {
  const db = await adminDb();
  if (!db) return [];
  const { data } = await db.from("devices").select("device_id").eq("user_id", userId);
  return (data ?? []).map((r) => String(r.device_id)).filter(Boolean);
}

export async function findUserByShopifyCustomerId(
  shopifyCustomerId: string,
): Promise<AppUser | null> {
  const db = await adminDb();
  if (!db) return null;
  const { data } = await db
    .from("customer_identities")
    .select("user_id")
    .eq("provider", "shopify")
    .eq("external_customer_id", String(shopifyCustomerId).trim())
    .maybeSingle();
  if (!data?.user_id) return null;
  const { data: user } = await db
    .from("users")
    .select("id, email, auth_user_id")
    .eq("id", data.user_id)
    .maybeSingle();
  if (!user) return null;
  return {
    id: user.id as string,
    email: (user.email as string | null) ?? null,
    authUserId: (user.auth_user_id as string | null) ?? null,
  };
}
