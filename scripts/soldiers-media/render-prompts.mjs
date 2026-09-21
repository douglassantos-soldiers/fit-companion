#!/usr/bin/env node
/**
 * Write image-to-video / still prompts from library specs.
 * Never includes third-party media paths.
 *
 * Usage:
 *   node scripts/soldiers-media/render-prompts.mjs
 *   node scripts/soldiers-media/render-prompts.mjs --batch 1
 *   node scripts/soldiers-media/render-prompts.mjs --pilot
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  root,
  loadQueue,
  itemsForBatch,
  parseArg,
  PILOT_EXERCISE_IDS,
} from "./media-queue-lib.mjs";
import { parseSoldiersLibrary } from "../exercise-catalog/parse-library.mjs";

const outDir = join(root, "content/soldiers-media-v1/prompts");
mkdirSync(outDir, { recursive: true });

const styleLock = JSON.parse(
  readFileSync(join(root, "content/soldiers-media-v1/style-lock.json"), "utf8"),
);
const style = `${styleLock.name}. Dark studio ${styleLock.palette.background}, gold rim light, original Soldiers athlete, matte black kit, 3/4 camera locked, no text, no watermark, no third-party likeness.`;

const batchArg = parseArg("--batch");
const pilotOnly = process.argv.includes("--pilot") || (batchArg == null && !process.argv.includes("--all"));

function lineFor(kind, id, motion) {
  return `# ${kind}/${id}\n${style} Kind=${kind} id=${id}. Motion: ${motion}. Input: Soldiers still of this exercise only. Never use openGym, Gym Visual, or Unsplash as a frame.\n`;
}

if (batchArg != null) {
  const queue = loadQueue();
  if (!queue) {
    console.error("Missing motion backlog. Run: npm run media:queue");
    process.exit(1);
  }
  const items = itemsForBatch(queue, batchArg);
  const lines = items.map((item) => {
    const motion = item.hold
      ? `isometric hold ${item.duration}s loop; start ${item.start}`
      : `start ${item.start}; end ${item.end}; ${item.duration}s loop xfade`;
    return lineFor("exercise", item.id, motion);
  });
  const out = join(outDir, `batch-${batchArg}.txt`);
  writeFileSync(out, lines.join("\n"), "utf8");
  console.log(`wrote ${items.length} prompts to ${out}`);
} else if (pilotOnly) {
  const library = parseSoldiersLibrary(root);
  const byId = new Map(library.map((r) => [r.id, r]));
  const lines = [];
  for (const id of PILOT_EXERCISE_IDS) {
    const row = byId.get(id);
    const start = row?.animationSpec?.start ?? "start pose";
    const end = row?.animationSpec?.end ?? "end pose";
    const hold = id === "prancha";
    const motion = hold
      ? `isometric hold 4s loop; start ${start}`
      : `start ${start}; end ${end}; 4s loop`;
    lines.push(lineFor("exercise", id, motion));
  }
  lines.push(
    lineFor("brand", "welcome-hero", "athlete looping a clean squat in Soldiers studio 4s"),
  );
  lines.push(lineFor("howto", "log-meal", "logging a meal on a dark phone 3s"));
  lines.push(lineFor("howto", "mix-whey", "mixing whey in a black shaker 3s"));
  lines.push(lineFor("howto", "complete-set", "racking a barbell after a set 3s"));
  const out = join(outDir, "pilot-v1.txt");
  writeFileSync(out, lines.join("\n"), "utf8");
  console.log(`wrote ${lines.length} prompts to ${out}`);
} else {
  const queue = loadQueue();
  if (!queue) {
    console.error("Missing motion backlog. Run: npm run media:queue");
    process.exit(1);
  }
  for (let b = 1; b <= (queue.batchCount || 6); b += 1) {
    const items = itemsForBatch(queue, b);
    const lines = items.map((item) => {
      const motion = item.hold
        ? `isometric hold ${item.duration}s loop; start ${item.start}`
        : `start ${item.start}; end ${item.end}; ${item.duration}s loop xfade`;
      return lineFor("exercise", item.id, motion);
    });
    const out = join(outDir, `batch-${b}.txt`);
    writeFileSync(out, lines.join("\n"), "utf8");
    console.log(`wrote ${items.length} prompts to ${out}`);
  }
}
