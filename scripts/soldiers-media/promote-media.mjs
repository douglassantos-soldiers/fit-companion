#!/usr/bin/env node
/**
 * Promote exercise packages to published when poster+thumb+motion exist on disk.
 * Updates published-exercises.json + soldiers-media-published-ids.ts
 *
 * Usage:
 *   node scripts/soldiers-media/promote-media.mjs --batch 1
 *   node scripts/soldiers-media/promote-media.mjs --id remada-elastico
 *   node scripts/soldiers-media/promote-media.mjs --all-ready
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  root,
  loadQueue,
  loadPublishedIds,
  writePublishedIds,
  itemsForBatch,
  parseArg,
  packageComplete,
  PILOT_EXERCISE_IDS,
} from "./media-queue-lib.mjs";

const queue = loadQueue();
if (!queue) {
  console.error("Missing motion backlog. Run: npm run media:queue");
  process.exit(1);
}

const batchArg = parseArg("--batch");
const idArg = parseArg("--id");
const allReady = process.argv.includes("--all-ready");

let candidates = [];
if (idArg) {
  const hit = queue.items.find((i) => i.id === idArg);
  if (!hit) {
    console.error(`id not in backlog: ${idArg}`);
    process.exit(1);
  }
  candidates = [hit];
} else if (batchArg != null) {
  candidates = itemsForBatch(queue, batchArg);
  if (!candidates.length) {
    console.error(`empty batch ${batchArg}`);
    process.exit(1);
  }
} else if (allReady) {
  candidates = queue.items;
} else {
  console.error("Usage: --batch N | --id <exerciseId> | --all-ready");
  process.exit(1);
}

const published = new Set(loadPublishedIds());
for (const id of PILOT_EXERCISE_IDS) published.add(id);

const promoted = [];
const skipped = [];

for (const item of candidates) {
  const dir = join(root, "public/soldiers-media/v1/exercise", item.id);
  if (!existsSync(dir) || !packageComplete(dir)) {
    skipped.push(item.id);
    continue;
  }
  if (!published.has(item.id)) {
    published.add(item.id);
    promoted.push(item.id);
  }
}

const next = writePublishedIds([...published]);
console.log(
  JSON.stringify(
    {
      promoted: promoted.length,
      promotedIds: promoted,
      skippedIncomplete: skipped.length,
      publishedTotal: next.length,
    },
    null,
    2,
  ),
);
