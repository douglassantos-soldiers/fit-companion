/**
 * Controlled live wipe proof (service_role).
 * Creates throwaway user → marker rows → executeAccountWipe → AFTER counts.
 * Never uses a real customer email.
 *
 * Usage (with .env loaded):
 *   node --experimental-strip-types scripts/operator-wipe-live.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { executeAccountWipe } from "../src/lib/account-deletion.ts";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env["SUPABASE_URL"]?.trim();
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
if (!url || !key) {
  console.error("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(3);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const stamp = Date.now();
const email = `wipe-live-${stamp}@soldiers-test.invalid`;
const userId = crypto.randomUUID();
const deviceId = `wipe-device-${stamp}`;

async function count(table, col, val) {
  const { count, error } = await db
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(col, val);
  if (error) return { error: error.message, count: null };
  return { count: count ?? 0 };
}

const before = {};
const { error: userErr } = await db.from("users").insert({
  id: userId,
  email,
});
if (userErr) {
  console.error("create user failed", userErr);
  process.exit(1);
}

await db.from("devices").upsert({
  device_id: deviceId,
  user_id: userId,
  platform: "web",
});
await db.from("profiles").upsert({
  user_id: userId,
  device_id: deviceId,
  name: "Wipe Live Probe",
  goal: "hypertrophy",
  level: "beginner",
  days_per_week: 3,
});
await db.from("app_state").upsert({
  user_id: userId,
  device_id: deviceId,
  retention: {},
});

before.users = await count("users", "id", userId);
before.devices = await count("devices", "user_id", userId);
before.profiles = await count("profiles", "user_id", userId);
before.app_state = await count("app_state", "user_id", userId);

const wipe = await executeAccountWipe(db, {
  userId,
  deviceIds: [deviceId],
});

const after = {
  users: await count("users", "id", userId),
  devices: await count("devices", "user_id", userId),
  profiles: await count("profiles", "user_id", userId),
  app_state: await count("app_state", "user_id", userId),
};

const ok =
  wipe.ok &&
  (after.users.count === 0 || after.users.count === null) &&
  (after.devices.count === 0 || after.devices.count === null) &&
  (after.profiles.count === 0 || after.profiles.count === null) &&
  (after.app_state.count === 0 || after.app_state.count === null);

const detail = {
  at: new Date().toISOString(),
  email,
  userId,
  deviceId,
  before,
  after,
  wipeOk: wipe.ok,
  wipeErrors: wipe.errors ?? [],
  deletedTables: wipe.deletedTables ?? [],
};

console.log(JSON.stringify({ ok, ...detail }, null, 2));

const proofsPath = join(process.cwd(), "docs", "certification", "operator-live-proofs.json");
let proofs = {};
if (existsSync(proofsPath)) {
  try {
    proofs = JSON.parse(readFileSync(proofsPath, "utf8"));
  } catch {
    proofs = {};
  }
} else {
  const template = join(
    process.cwd(),
    "docs",
    "certification",
    "operator-live-proofs.template.json",
  );
  if (existsSync(template)) proofs = JSON.parse(readFileSync(template, "utf8"));
}

proofs.account_deletion_live = {
  status: ok ? "pass" : "fail",
  at: detail.at,
  detail: ok
    ? `Controlled wipe ${userId}: BEFORE users/profiles/devices/app_state=${JSON.stringify(before)} AFTER zero/absent=${JSON.stringify(after)}`
    : `Wipe failed: ${JSON.stringify(detail).slice(0, 500)}`,
};

mkdirSync(join(process.cwd(), "docs", "certification"), { recursive: true });
writeFileSync(proofsPath, `${JSON.stringify(proofs, null, 2)}\n`);
console.log(`wrote ${proofsPath} account_deletion_live=${proofs.account_deletion_live.status}`);
process.exit(ok ? 0 : 1);
