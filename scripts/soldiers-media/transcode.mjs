#!/usr/bin/env node
/**
 * Transcode a source video into WebM + MP4 + poster/thumb WebP (<80KB poster).
 * Usage: node scripts/soldiers-media/transcode.mjs <input> <kind> <entityId>
 * Requires ffmpeg on PATH.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, statSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [, , input, kind, entityId] = process.argv;
if (!input || !kind || !entityId) {
  console.error("usage: node scripts/soldiers-media/transcode.mjs <input> <kind> <entityId>");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = join(root, "public/soldiers-media/v1", kind, entityId);
mkdirSync(outDir, { recursive: true });
const POSTER_BUDGET = 80 * 1024;

function run(args) {
  const res = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

function runQuiet(args) {
  return spawnSync("ffmpeg", args, { stdio: "pipe" });
}

function writeWebp(src, dest, vf, maxBytes) {
  for (const q of [72, 62, 52, 42, 32, 24]) {
    const res = runQuiet(["-y", "-i", src, "-vf", vf, "-q:v", String(q), dest]);
    if (res.status !== 0) process.exit(res.status ?? 1);
    if (statSync(dest).size <= maxBytes) return;
  }
}

run([
  "-y",
  "-i",
  input,
  "-an",
  "-c:v",
  "libvpx-vp9",
  "-b:v",
  "600k",
  "-vf",
  "scale=720:-2",
  join(outDir, "animation.webm"),
]);
run([
  "-y",
  "-i",
  input,
  "-an",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-b:v",
  "900k",
  "-vf",
  "scale=720:-2",
  join(outDir, "animation.mp4"),
]);
writeWebp(
  input,
  join(outDir, "poster.webp"),
  "scale=512:512:force_original_aspect_ratio=increase,crop=512:512",
  POSTER_BUDGET,
);
writeWebp(join(outDir, "poster.webp"), join(outDir, "thumb.webp"), "scale=256:256", 40 * 1024);
for (const leftover of ["poster.png", "thumb.png"]) {
  const p = join(outDir, leftover);
  if (existsSync(p)) unlinkSync(p);
}
console.log("transcoded", outDir);
