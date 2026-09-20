#!/usr/bin/env node
/**
 * Ensure an admin Auth user + public.users + entitlement email.
 * Usage: node scripts/ensure-admin-user.mjs
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(join(root, ".env"));

const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || process.env.ADMIN_PIN || "";

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!email.includes("@") || !password) {
  console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD");
  process.exit(1);
}

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[name]) process.env[name] = value;
  }
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findAuthUserByEmail() {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => String(u.email ?? "").toLowerCase() === email);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

let user;
const created = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role: "admin" },
});

if (created.error) {
  const msg = created.error.message.toLowerCase();
  if (!msg.includes("already") && !msg.includes("registered") && created.error.status !== 422) {
    throw created.error;
  }
  user = await findAuthUserByEmail();
  if (!user) throw new Error("Auth user exists but could not be listed");
  const updated = await db.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    app_metadata: { ...(user.app_metadata ?? {}), role: "admin" },
  });
  if (updated.error) throw updated.error;
  user = updated.data.user;
  console.log("auth user updated");
} else {
  user = created.data.user;
  console.log("auth user created");
}

const now = new Date().toISOString();
const { data: existingAppUser, error: appLookupError } = await db
  .from("users")
  .select("id")
  .ilike("email", email)
  .maybeSingle();
if (appLookupError) throw appLookupError;

let appUserId = existingAppUser?.id ?? null;
if (!appUserId) {
  const { data: inserted, error } = await db
    .from("users")
    .insert({ email, auth_user_id: user.id, updated_at: now })
    .select("id")
    .single();
  if (error) throw error;
  appUserId = inserted.id;
  console.log("app user created");
} else {
  const { error } = await db
    .from("users")
    .update({ auth_user_id: user.id, updated_at: now })
    .eq("id", appUserId);
  if (error) throw error;
  console.log("app user linked");
}

const { error: entitlementError } = await db.from("app_entitlement_emails").upsert(
  {
    email,
    access_tier: "performance",
    product_ids: ["whey-protein", "creatina"],
    order_snapshot: {
      email,
      accessTier: "performance",
      productIds: ["whey-protein", "creatina"],
      source: "admin_seed",
    },
    last_order_at: now,
    updated_at: now,
  },
  { onConflict: "email" },
);
if (entitlementError) throw entitlementError;
console.log("entitlement upserted");
console.log("ok", email);
