#!/usr/bin/env node
/**
 * Build WebM/MP4 for needsMotion packages from Soldiers stills only.
 *
 * Fallback: two Soldiers keyframes (poster + pose-end) xfade loop — not a Ken Burns zoom.
 * Isometric hold: encode the Soldiers still as a 4s loop.
 *
 * Usage:
 *   node scripts/soldiers-media/generate-motion.mjs
 *   node scripts/soldiers-media/generate-motion.mjs --batch 1
 *   node scripts/soldiers-media/generate-motion.mjs --id remada-elastico
 *   node scripts/soldiers-media/generate-motion.mjs --pilot
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  root,
  loadQueue,
  itemsForBatch,
  parseArg,
  PILOT_EXERCISE_IDS,
} from "./media-queue-lib.mjs";

loadEnv(join(root, ".env"));

const PILOT_PACKAGES = [
  { kind: "exercise", id: "supino-reto", duration: 4, hold: false },
  { kind: "exercise", id: "flexao", duration: 4, hold: false },
  { kind: "exercise", id: "remada-curvada", duration: 4, hold: false },
  { kind: "exercise", id: "barra-fixa", duration: 4, hold: false },
  { kind: "exercise", id: "agachamento", duration: 4, hold: false },
  { kind: "exercise", id: "terra-romeno", duration: 4, hold: false },
  { kind: "exercise", id: "desenvolvimento", duration: 4, hold: false },
  { kind: "exercise", id: "elevacao-lateral", duration: 4, hold: false },
  { kind: "exercise", id: "rosca-direta", duration: 4, hold: false },
  { kind: "exercise", id: "prancha", duration: 4, hold: true },
  { kind: "brand", id: "welcome-hero", duration: 4, hold: false },
  { kind: "howto", id: "log-meal", duration: 3, hold: false },
  { kind: "howto", id: "mix-whey", duration: 3, hold: false },
  { kind: "howto", id: "complete-set", duration: 3, hold: false },
];

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

function run(args) {
  const res = spawnSync("ffmpeg", args, { stdio: "pipe" });
  if (res.status !== 0) {
    console.error(res.stderr?.toString() || "ffmpeg failed");
    process.exit(res.status ?? 1);
  }
}

function stillPath(dir) {
  for (const name of ["poster.webp", "poster.png"]) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

function endPath(dir) {
  for (const name of ["pose-end.webp", "pose-end.png"]) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

function transcodePair(src, dir) {
  run([
    "-y",
    "-i",
    src,
    "-an",
    "-c:v",
    "libvpx-vp9",
    "-b:v",
    "600k",
    "-deadline",
    "good",
    join(dir, "animation.webm"),
  ]);
  run([
    "-y",
    "-i",
    src,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-b:v",
    "900k",
    join(dir, "animation.mp4"),
  ]);
}

function encodeHold(still, dir, duration) {
  const srcMp4 = join(dir, "_hold.mp4");
  run([
    "-y",
    "-loop",
    "1",
    "-i",
    still,
    "-t",
    String(duration),
    "-vf",
    "scale=720:-2,format=yuv420p",
    "-r",
    "24",
    "-an",
    srcMp4,
  ]);
  transcodePair(srcMp4, dir);
  unlinkSync(srcMp4);
}

function stillToClip(src, dest, seconds) {
  run([
    "-y",
    "-loop",
    "1",
    "-i",
    src,
    "-t",
    String(seconds),
    "-r",
    "24",
    "-vf",
    "scale=720:720:force_original_aspect_ratio=increase,crop=720:720,setsar=1,format=yuv420p",
    "-an",
    dest,
  ]);
}

function encodeXfade(start, end, dir, duration) {
  const half = Math.max(1.2, duration / 2);
  const fade = Math.min(0.8, half - 0.3);
  const offset = (half - fade).toFixed(2);
  const startClip = join(dir, "_start.mp4");
  const endClip = join(dir, "_end.mp4");
  const srcMp4 = join(dir, "_loop.mp4");
  stillToClip(start, startClip, half);
  stillToClip(end, endClip, half);
  run([
    "-y",
    "-i",
    startClip,
    "-i",
    endClip,
    "-filter_complex",
    `[0:v][1:v]xfade=transition=fade:duration=${fade}:offset=${offset}[fwd];[1:v][0:v]xfade=transition=fade:duration=${fade}:offset=${offset}[rev];[fwd][rev]concat=n=2:v=1:a=0,fps=24,format=yuv420p[v]`,
    "-map",
    "[v]",
    "-an",
    "-t",
    String(duration),
    srcMp4,
  ]);
  transcodePair(srcMp4, dir);
  for (const tmp of [startClip, endClip, srcMp4]) unlinkSync(tmp);
}

function resolvePackages() {
  const batchArg = parseArg("--batch");
  const idArg = parseArg("--id");
  const pilot = process.argv.includes("--pilot");

  if (idArg) {
    const queue = loadQueue();
    const fromQueue = queue?.items?.find((i) => i.id === idArg);
    if (fromQueue) {
      return [
        {
          kind: fromQueue.kind || "exercise",
          id: fromQueue.id,
          duration: fromQueue.duration || 4,
          hold: Boolean(fromQueue.hold),
        },
      ];
    }
    if (PILOT_EXERCISE_IDS.includes(idArg)) {
      return PILOT_PACKAGES.filter((p) => p.id === idArg);
    }
    return [{ kind: "exercise", id: idArg, duration: 4, hold: false }];
  }

  if (batchArg != null) {
    const queue = loadQueue();
    if (!queue) {
      console.error("Missing motion backlog. Run: npm run media:queue");
      process.exit(1);
    }
    return itemsForBatch(queue, batchArg).map((item) => ({
      kind: item.kind || "exercise",
      id: item.id,
      duration: item.duration || 4,
      hold: Boolean(item.hold),
    }));
  }

  if (pilot) return PILOT_PACKAGES;

  // Default: pilot packages (brand/howto) + full backlog that has stills ready
  const queue = loadQueue();
  const backlog = (queue?.items ?? []).map((item) => ({
    kind: item.kind || "exercise",
    id: item.id,
    duration: item.duration || 4,
    hold: Boolean(item.hold),
  }));
  return [...PILOT_PACKAGES, ...backlog];
}

if (
  process.env.FAL_KEY ||
  process.env.FAL_API_KEY ||
  process.env.RUNWAY_API_KEY ||
  process.env.KLING_API_KEY
) {
  console.log(
    "image-to-video env is set; keyframe fallback still used unless pose-end is replaced by provider output",
  );
}

const PACKAGES = resolvePackages();
let done = 0;
const skipped = [];

for (const pkg of PACKAGES) {
  const dir = join(root, "public/soldiers-media/v1", pkg.kind, pkg.id);
  mkdirSync(dir, { recursive: true });
  const start = stillPath(dir);
  if (!start) {
    skipped.push(`${pkg.kind}/${pkg.id} missing poster`);
    continue;
  }
  const end = endPath(dir);
  console.log("motion", pkg.kind, pkg.id);
  if (pkg.hold) encodeHold(start, dir, pkg.duration);
  else if (end) encodeXfade(start, end, dir, pkg.duration);
  else {
    skipped.push(`${pkg.kind}/${pkg.id} missing pose-end (and no video API)`);
    continue;
  }
  const webm = join(dir, "animation.webm");
  const mp4 = join(dir, "animation.mp4");
  if (existsSync(webm) && existsSync(mp4)) {
    console.log(
      "  ok",
      `${(statSync(webm).size / 1024).toFixed(0)}KB webm`,
      `${(statSync(mp4).size / 1024).toFixed(0)}KB mp4`,
    );
    done += 1;
  }
}

console.log(`motion packages ${done}/${PACKAGES.length}`);
if (skipped.length) {
  for (const line of skipped) console.error("skip", line);
  // Batch mode: skip incomplete stills without failing the whole run
  const batchMode = parseArg("--batch") != null || parseArg("--id") != null;
  if (!batchMode && done === 0) process.exit(1);
  if (!batchMode && skipped.length === PACKAGES.length) process.exit(1);
}
