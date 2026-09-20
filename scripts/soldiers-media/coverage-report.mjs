#!/usr/bin/env node
/**
 * Coverage: manifest kinds + files on disk + optional remote soldiers_media.
 * Run: node scripts/soldiers-media/coverage-report.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const mediaRoot = join(root, "public/soldiers-media/v1");
const POSTER_BUDGET = 80 * 1024;

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

loadEnv(join(root, ".env"));

const style = JSON.parse(readFileSync(join(root, "content/soldiers-media-v1/style-lock.json"), "utf8"));
const legal = JSON.parse(readFileSync(join(root, "content/soldiers-media-v1/legal-policy.json"), "utf8"));

const MOTION_KINDS = new Set(["exercise", "brand", "howto"]);
const kinds = ["exercise", "meal", "product", "hub", "challenge", "brand", "howto"];

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

const byKind = {};
const motionWithoutVideo = [];
const overBudget = [];
let packages = 0;

for (const kind of kinds) {
  const kindDir = join(mediaRoot, kind);
  const row = { total: 0, onDisk: 0, motion: 0, withVideo: 0, overBudget: 0 };
  if (existsSync(kindDir)) {
    for (const entityId of readdirSync(kindDir)) {
      const dir = join(kindDir, entityId);
      if (!statSync(dir).isDirectory()) continue;
      row.total += 1;
      packages += 1;
      const files = pickStill(dir);
      if (files.poster) row.onDisk += 1;
      const needsMotion = MOTION_KINDS.has(kind);
      if (needsMotion) {
        row.motion += 1;
        if (files.webm || files.mp4) row.withVideo += 1;
        else motionWithoutVideo.push(`${kind}/${entityId}`);
      }
      if (files.poster) {
        const size = statSync(files.poster).size;
        if (size > POSTER_BUDGET) {
          row.overBudget += 1;
          overBudget.push(`${kind}/${entityId} ${size}`);
        }
      }
    }
  }
  byKind[kind] = row;
}

console.log(`style=${style.id} license=${legal.license}`);
console.log("forbidden inputs:", legal.forbidden.length);
console.log("packages on disk:", packages);
for (const kind of kinds) {
  const r = byKind[kind];
  console.log(
    `${kind}\ttotal=${r.total} disk=${r.onDisk} motion=${r.motion} video=${r.withVideo} overBudget=${r.overBudget}`,
  );
}
console.log("motion without video:", motionWithoutVideo.length);
for (const id of motionWithoutVideo) console.log("  -", id);
if (overBudget.length) {
  console.log("posters over 80KB:", overBudget.length);
  for (const line of overBudget.slice(0, 12)) console.log("  -", line);
}

const url = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
if (url && key) {
  const res = await fetch(
    `${url}/rest/v1/soldiers_media?select=kind,entity_id,status,needs_motion,poster_url,webm_url,mp4_url`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) {
    console.log("remote: read failed", res.status);
  } else {
    const rows = await res.json();
    const published = rows.filter((r) => r.status === "published");
    const remoteMotionGap = published.filter((r) => r.needs_motion && !r.webm_url && !r.mp4_url);
    console.log(`remote published=${published.length} motionWithoutVideo=${remoteMotionGap.length}`);
  }
} else {
  console.log("remote: skipped (no SUPABASE_URL / publishable key)");
}
