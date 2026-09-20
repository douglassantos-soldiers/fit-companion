#!/usr/bin/env node
/**
 * Convert every package still to poster.webp / thumb.webp under 80KB.
 * Usage: node scripts/soldiers-media/compress-stills.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const base = join(root, "public/soldiers-media/v1");
const POSTER_BUDGET = 80 * 1024;
const THUMB_BUDGET = 40 * 1024;

function runQuiet(args) {
  return spawnSync("ffmpeg", args, { stdio: "pipe" });
}

function writeWebp(src, dest, vf, maxBytes) {
  let lastSize = Infinity;
  for (const q of [72, 62, 52, 42, 32, 24, 18]) {
    const res = runQuiet(["-y", "-i", src, "-vf", vf, "-q:v", String(q), dest]);
    if (res.status !== 0) {
      console.error(res.stderr?.toString() || "ffmpeg failed");
      process.exit(res.status ?? 1);
    }
    lastSize = statSync(dest).size;
    if (lastSize <= maxBytes) return lastSize;
  }
  return lastSize;
}

let ok = 0;
let over = 0;
for (const kind of readdirSync(base)) {
  const kindDir = join(base, kind);
  if (!statSync(kindDir).isDirectory()) continue;
  for (const entityId of readdirSync(kindDir)) {
    const dir = join(kindDir, entityId);
    if (!statSync(dir).isDirectory()) continue;
    const src = existsSync(join(dir, "poster.webp"))
      ? join(dir, "poster.webp")
      : existsSync(join(dir, "poster.png"))
        ? join(dir, "poster.png")
        : null;
    if (!src) continue;
    const poster = join(dir, "poster.webp");
    const thumb = join(dir, "thumb.webp");
    const posterSize = writeWebp(
      src,
      poster,
      "scale=512:512:force_original_aspect_ratio=increase,crop=512:512",
      POSTER_BUDGET,
    );
    writeWebp(poster, thumb, "scale=256:256", THUMB_BUDGET);
    for (const leftover of ["poster.png", "thumb.png"]) {
      const p = join(dir, leftover);
      if (existsSync(p)) unlinkSync(p);
    }
    ok += 1;
    if (posterSize > POSTER_BUDGET) {
      over += 1;
      console.warn("over budget", kind, entityId, posterSize);
    } else {
      console.log("webp", kind, entityId, posterSize);
    }
  }
}
console.log(`compressed ${ok} packages, overBudget=${over}`);
if (over) process.exit(1);
