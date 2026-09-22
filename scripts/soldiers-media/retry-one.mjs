#!/usr/bin/env node
/**
 * Retry a single exercise package deploy (e.g. after 504).
 * Usage: node scripts/soldiers-media/retry-one.mjs burpee-step
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { packageComplete } from "./media-queue-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const id = process.argv[2];
if (!id) {
  console.error("Usage: node scripts/soldiers-media/retry-one.mjs <exercise-id>");
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

loadEnv(join(root, ".env"));
const url = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const dir = join(root, "public/soldiers-media/v1/exercise", id);
if (!packageComplete(dir)) {
  console.error("package incomplete:", dir);
  process.exit(1);
}

function mime(file) {
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".webm")) return "video/webm";
  if (file.endsWith(".mp4")) return "video/mp4";
  return "image/gif";
}

const publicUrl = (p) => `${url}/storage/v1/object/public/soldiers-media/${p}`;
const files = readdirSync(dir).filter(
  (f) =>
    /\.(webp|png|webm|mp4|gif)$/i.test(f) &&
    !f.startsWith("pose-end") &&
    !f.startsWith(".") &&
    !f.startsWith("_"),
);

const checksums = {};
const uploaded = {};
for (const file of files) {
  const objectPath = `v1/exercise/${id}/${file}`;
  const body = readFileSync(join(dir, file));
  const hash = createHash("sha256").update(body).digest("hex");
  if (file.startsWith("poster.")) checksums.poster = hash;
  if (file.startsWith("thumb.")) checksums.thumbnail = hash;
  if (file === "animation.webm") checksums.webm = hash;
  if (file === "animation.mp4") checksums.mp4 = hash;
  if (file === "animation.gif") checksums.gif = hash;
  const put = await fetch(`${url}/storage/v1/object/soldiers-media/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": mime(file),
      "x-upsert": "true",
    },
    body,
  });
  if (!put.ok && put.status !== 400) {
    throw new Error(`upload ${file} failed: ${put.status} ${await put.text()}`);
  }
  uploaded[file] = publicUrl(objectPath);
  console.log("uploaded", file);
}

const row = {
  kind: "exercise",
  entity_id: id,
  version: "v1",
  variant: "default",
  region: "global",
  style: "soldiers-v1",
  source: "soldiers",
  ownership: "owned",
  license: "soldiers-owned",
  status: "published",
  needs_motion: true,
  poster_url: uploaded["poster.webp"] ?? uploaded["poster.png"] ?? null,
  thumbnail_url:
    uploaded["thumb.webp"] ??
    uploaded["thumb.png"] ??
    uploaded["poster.webp"] ??
    uploaded["poster.png"] ??
    null,
  webm_url: uploaded["animation.webm"] ?? null,
  mp4_url: uploaded["animation.mp4"] ?? null,
  gif_url: uploaded["animation.gif"] ?? null,
  checksums,
  updated_at: new Date().toISOString(),
};

const up = await fetch(
  `${url}/rest/v1/soldiers_media?on_conflict=kind,entity_id,version,variant,region`,
  {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  },
);
if (!up.ok) throw new Error(`upsert failed: ${up.status} ${await up.text()}`);

const cat = await fetch(`${url}/rest/v1/catalog_exercises?id=eq.${id}`, {
  method: "PATCH",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  },
  body: JSON.stringify({ media_status: "published" }),
});
console.log("ok", id, "catalog", cat.status);
