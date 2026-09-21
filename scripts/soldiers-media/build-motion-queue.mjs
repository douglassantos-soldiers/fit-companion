#!/usr/bin/env node
/**
 * Build motion backlog queue: library − pilot → 6 batches of ~40.
 * npm run media:queue
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  QUEUE_PATH,
  buildMotionQueue,
  writePublishedIds,
  loadPublishedIds,
  PILOT_EXERCISE_IDS,
} from "./media-queue-lib.mjs";

const queue = buildMotionQueue();
mkdirSync(dirname(QUEUE_PATH), { recursive: true });
writeFileSync(QUEUE_PATH, `${JSON.stringify(queue, null, 2)}\n`);

const published = loadPublishedIds();
for (const id of PILOT_EXERCISE_IDS) {
  if (!published.includes(id)) published.push(id);
}
writePublishedIds(published);

console.log(
  JSON.stringify(
    {
      queuePath: QUEUE_PATH,
      total: queue.total,
      byBatch: queue.byBatch,
      publishedSeed: published.length,
    },
    null,
    2,
  ),
);

if (queue.total !== 240) {
  console.error(`expected 240 backlog items, got ${queue.total}`);
  process.exit(1);
}
