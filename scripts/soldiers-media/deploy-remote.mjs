#!/usr/bin/env node
/**
 * Deploy all local public/soldiers-media/v1 packages to Supabase Storage + soldiers_media.
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env (never prints secrets).
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnv(join(root, ".env"));

const url = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const MOTION_KINDS = new Set(["exercise", "brand", "howto"]);
const base = join(root, "public/soldiers-media/v1");

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[name]) process.env[name] = value;
  }
}

function mime(file) {
  if (file.endsWith(".webm")) return "video/webm";
  if (file.endsWith(".mp4")) return "video/mp4";
  if (file.endsWith(".gif")) return "image/gif";
  if (file.endsWith(".webp")) return "image/webp";
  return "image/png";
}

function publicUrl(objectPath) {
  return `${url}/storage/v1/object/public/soldiers-media/${objectPath}`;
}

async function putObject(objectPath, body, contentType) {
  const headers = {
    Authorization: `Bearer ${key}`,
    apikey: key,
    "Content-Type": contentType,
    "x-upsert": "true",
  };
  const endpoint = `${url}/storage/v1/object/soldiers-media/${objectPath}`;
  let res = await fetch(endpoint, { method: "POST", headers, body });
  if (res.status === 409 || res.status === 400) {
    res = await fetch(endpoint, { method: "PUT", headers, body });
  }
  if (!res.ok) {
    throw new Error(`upload ${objectPath} failed: ${res.status} ${await res.text()}`);
  }
}

async function existingStatus(kind, entityId) {
  const qs = new URLSearchParams({
    kind: `eq.${kind}`,
    entity_id: `eq.${entityId}`,
    version: "eq.v1",
    variant: "eq.default",
    region: "eq.global",
    select: "status",
  });
  const res = await fetch(`${url}/rest/v1/soldiers_media?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0]?.status ?? null;
}

async function upsertRow(row) {
  const res = await fetch(
    `${url}/rest/v1/soldiers_media?on_conflict=kind,entity_id,version,variant,region`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
    },
  );
  if (!res.ok) {
    throw new Error(`upsert ${row.kind}/${row.entity_id} failed: ${res.status} ${await res.text()}`);
  }
}

const packages = [];
for (const kind of readdirSync(base)) {
  const kindDir = join(base, kind);
  for (const entityId of readdirSync(kindDir)) {
    const dir = join(kindDir, entityId);
    const files = readdirSync(dir).filter((f) => {
      if (f.startsWith(".") || f.startsWith("_") || f.startsWith("pose-end")) return false;
      return /\.(webp|png|webm|mp4|gif)$/i.test(f);
    });
    if (!files.length) continue;
    packages.push({ kind, entityId, dir, files });
  }
}

let ok = 0;
const failures = [];
for (const pkg of packages) {
  try {
    const checksums = {};
    const uploaded = {};
    for (const file of pkg.files) {
      const objectPath = `v1/${pkg.kind}/${pkg.entityId}/${file}`;
      const body = readFileSync(join(pkg.dir, file));
      const hash = createHash("sha256").update(body).digest("hex");
      if (file.startsWith("poster.")) checksums.poster = hash;
      if (file.startsWith("thumb.")) checksums.thumbnail = hash;
      if (file === "animation.webm") checksums.webm = hash;
      if (file === "animation.mp4") checksums.mp4 = hash;
      if (file === "animation.gif") checksums.gif = hash;
      await putObject(objectPath, body, mime(file));
      uploaded[file] = publicUrl(objectPath);
    }
    const prev = await existingStatus(pkg.kind, pkg.entityId);
    const status = prev === "published" ? "published" : "generated";
    await upsertRow({
      kind: pkg.kind,
      entity_id: pkg.entityId,
      version: "v1",
      variant: "default",
      region: "global",
      style: "soldiers-v1",
      source: "soldiers",
      ownership: "owned",
      license: "soldiers-owned",
      status,
      needs_motion: MOTION_KINDS.has(pkg.kind),
      poster_url: uploaded["poster.webp"] ?? uploaded["poster.png"] ?? null,
      thumbnail_url: uploaded["thumb.webp"] ?? uploaded["thumb.png"] ?? uploaded["poster.webp"] ?? uploaded["poster.png"] ?? null,
      webm_url: uploaded["animation.webm"] ?? null,
      mp4_url: uploaded["animation.mp4"] ?? null,
      gif_url: uploaded["animation.gif"] ?? null,
      checksums,
      updated_at: new Date().toISOString(),
    });
    ok += 1;
    console.log(status, pkg.kind, pkg.entityId);
  } catch (err) {
    failures.push(`${pkg.kind}/${pkg.entityId}: ${err instanceof Error ? err.message : String(err)}`);
    console.error("failed", pkg.kind, pkg.entityId);
  }
}

console.log(`done ${ok}/${packages.length}`);
if (failures.length) {
  for (const line of failures) console.error(line);
  process.exit(1);
}
