#!/usr/bin/env node
/**
 * Generate canonical-seed.json from Soldiers lote 1+2+3 TS.
 * Does not rewrite Fase 3 SQL (overlay seed stays idempotent).
 * npm run catalog:generate-seed
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSoldiersLibrary } from "./parse-library.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const jsonPath = join(root, "content/exercise-catalog/canonical-seed.json");

const rows = parseSoldiersLibrary(root);
if (rows.length < 135) {
  console.error(`Expected >= 135 library rows, got ${rows.length}`);
  process.exit(1);
}

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(rows, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      rows: rows.length,
      json: "content/exercise-catalog/canonical-seed.json",
    },
    null,
    2,
  ),
);
