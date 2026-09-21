#!/usr/bin/env node
/**
 * Coverage scorecard vs exercise library (not only dirs on disk).
 * npm run media:coverage
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSoldiersLibrary } from "../exercise-catalog/parse-library.mjs";
import { isExternalMediaUrl, isSoldiersOwnedUrl, normalizeStatus } from "./governance-lib.mjs";
import { loadPublishedIds, packageComplete } from "./media-queue-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const mediaRoot = join(root, "public/soldiers-media/v1");

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

const style = JSON.parse(
  readFileSync(join(root, "content/soldiers-media-v1/style-lock.json"), "utf8"),
);
const legal = JSON.parse(
  readFileSync(join(root, "content/soldiers-media-v1/legal-policy.json"), "utf8"),
);
const library = parseSoldiersLibrary(root);
const publishedSet = new Set(loadPublishedIds());

function pickStill(dir) {
  const posterWebp = join(dir, "poster.webp");
  const posterPng = join(dir, "poster.png");
  const thumbWebp = join(dir, "thumb.webp");
  const thumbPng = join(dir, "thumb.png");
  return {
    poster: existsSync(posterWebp) ? posterWebp : existsSync(posterPng) ? posterPng : null,
    thumb: existsSync(thumbWebp) ? thumbWebp : existsSync(thumbPng) ? thumbPng : null,
    webm: existsSync(join(dir, "animation.webm")),
    mp4: existsSync(join(dir, "animation.mp4")),
  };
}

const disk = new Map();
if (existsSync(join(mediaRoot, "exercise"))) {
  for (const entityId of readdirSync(join(mediaRoot, "exercise"))) {
    const dir = join(mediaRoot, "exercise", entityId);
    if (!statSync(dir).isDirectory()) continue;
    disk.set(entityId, pickStill(dir));
  }
}

let mediaComplete = 0;
let posterMissing = 0;
let thumbMissing = 0;
let motionMissing = 0;
let qaPending = 0;
let published = 0;
let rejected = 0;
let legacy = 0;
let externalUrls = 0;

for (const row of library) {
  const id = row.mediaId || row.id;
  const files = disk.get(id);
  const dir = join(mediaRoot, "exercise", id);
  const isPublished = publishedSet.has(id) && packageComplete(dir);
  const status = isPublished ? "published" : "draft";
  if (status === "published") published += 1;
  if (status === "qa") qaPending += 1;
  if (status === "rejected") rejected += 1;

  const hasPoster = Boolean(files?.poster);
  const hasThumb = Boolean(files?.thumb || files?.poster);
  const hasMotion = Boolean(files?.webm || files?.mp4);
  if (isPublished && hasPoster && hasThumb && hasMotion) mediaComplete += 1;
  if (!hasPoster) posterMissing += 1;
  if (!hasThumb) thumbMissing += 1;
  if (!hasMotion) motionMissing += 1;

  for (const url of [row.mediaUrl, row.videoUrl]) {
    if (!url) continue;
    if (isSoldiersOwnedUrl(url)) continue;
    legacy += 1;
    if (isExternalMediaUrl(url)) externalUrls += 1;
  }
}

const report = {
  style: style.id,
  license: legal.license,
  totalExercises: library.length,
  mediaComplete,
  posterMissing,
  thumbMissing,
  motionMissing,
  qaPending,
  published,
  rejected,
  legacy,
  externalUrls,
  publishedListed: publishedSet.size,
};

console.log(JSON.stringify(report, null, 2));

const url = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const key =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
if (url && key) {
  const res = await fetch(
    `${url}/rest/v1/soldiers_media?select=kind,entity_id,status,needs_motion,poster_url,thumbnail_url,webm_url,mp4_url,gif_url`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) {
    console.log("remote: read failed", res.status);
  } else {
    const rows = await res.json();
    const publishedRows = rows.filter((r) => normalizeStatus(r.status) === "published");
    const qaRows = rows.filter((r) => normalizeStatus(r.status) === "qa");
    const rejectedRows = rows.filter((r) => normalizeStatus(r.status) === "rejected");
    console.log(
      JSON.stringify({
        remotePublished: publishedRows.length,
        remoteQaPending: qaRows.length,
        remoteRejected: rejectedRows.length,
      }),
    );
  }
} else {
  console.log("remote: skipped (no SUPABASE_URL / publishable key)");
}
