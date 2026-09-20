#!/usr/bin/env node
/**
 * Upload a local package folder to Supabase Storage + upsert soldiers_media.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Usage: node scripts/soldiers-media/upload.mjs <kind> <entityId> [--motion]
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [, , kind, entityId, flag] = process.argv;
if (!kind || !entityId) {
  console.error("usage: node scripts/soldiers-media/upload.mjs <kind> <entityId> [--motion]");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const dir = join(root, "public/soldiers-media/v1", kind, entityId);
const files = readdirSync(dir);
const needsMotion = flag === "--motion";

async function putObject(path, body, contentType) {
  const res = await fetch(`${url}/storage/v1/object/soldiers-media/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`upload ${path} failed: ${res.status} ${await res.text()}`);
  }
}

function publicUrl(path) {
  return `${url}/storage/v1/object/public/soldiers-media/${path}`;
}

const uploaded = {};
for (const file of files) {
  const body = readFileSync(join(dir, file));
  const objectPath = `v1/${kind}/${entityId}/${file}`;
  const type = file.endsWith(".webm")
    ? "video/webm"
    : file.endsWith(".mp4")
      ? "video/mp4"
      : file.endsWith(".gif")
        ? "image/gif"
        : "image/png";
  await putObject(objectPath, body, type);
  uploaded[file] = publicUrl(objectPath);
}

const row = {
  kind,
  entity_id: entityId,
  version: "v1",
  style: "soldiers-v1",
  source: "soldiers",
  ownership: "owned",
  license: "soldiers-owned",
  status: "published",
  needs_motion: needsMotion,
  poster_url: uploaded["poster.webp"] ?? uploaded["poster.png"] ?? null,
  thumbnail_url: uploaded["thumb.webp"] ?? uploaded["thumb.png"] ?? uploaded["poster.webp"] ?? uploaded["poster.png"] ?? null,
  webm_url: uploaded["animation.webm"] ?? null,
  mp4_url: uploaded["animation.mp4"] ?? null,
  gif_url: uploaded["animation.gif"] ?? null,
  updated_at: new Date().toISOString(),
};

const upsert = await fetch(`${url}/rest/v1/soldiers_media`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    apikey: key,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal",
  },
  body: JSON.stringify(row),
});
if (!upsert.ok) {
  throw new Error(`upsert failed: ${upsert.status} ${await upsert.text()}`);
}
console.log("published", kind, entityId);
