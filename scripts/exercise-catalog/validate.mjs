#!/usr/bin/env node
/**
 * Validate canonical exercise catalog (Soldiers lote 1).
 * Does not download or import third-party catalogs.
 *
 * npm run catalog:validate
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_PATTERNS,
  parseManifestExerciseIds,
  parseSoldiersLibrary,
} from "./parse-library.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const jsonPath = join(root, "content/exercise-catalog/canonical-seed.json");
const manifestPath = join(root, "src/data/soldiers-media-manifest.ts");

const GROUPS = new Set([
  "peito",
  "costas",
  "pernas",
  "ombros",
  "biceps",
  "triceps",
  "core",
  "cardio",
]);
const EQUIPMENT = new Set(["casa", "academia", "ambos"]);

const library = parseSoldiersLibrary(root);
if (!existsSync(jsonPath)) {
  console.error("Missing content/exercise-catalog/canonical-seed.json — run catalog:generate-seed");
  process.exit(1);
}
const seed = JSON.parse(readFileSync(jsonPath, "utf8"));
const manifestIds = existsSync(manifestPath)
  ? parseManifestExerciseIds(readFileSync(manifestPath, "utf8"))
  : new Set();

const errors = [];
const ids = library.map((r) => r.id);
const idSet = new Set(ids);
if (new Set(ids).size !== ids.length) {
  errors.push("duplicateIds");
}

const seedIds = seed.map((r) => r.id).sort();
const libIds = [...ids].sort();
if (JSON.stringify(seedIds) !== JSON.stringify(libIds)) {
  errors.push("seedJsonDrift");
}

const nameCounts = new Map();
for (const row of library) {
  const key = String(row.name).trim().toLowerCase();
  nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
}
const duplicateNames = [...nameCounts.entries()].filter(([, n]) => n > 1).map(([n]) => n);

const missingAlternatives = [];
const invalidPatterns = [];
const invalidGroups = [];
const invalidEquipment = [];
const missingInstructions = [];
const missingAnimationSpec = [];
const missingMedia = [];

for (const row of library) {
  if (!GROUPS.has(row.group)) invalidGroups.push(row.id);
  if (!EQUIPMENT.has(row.equipment)) invalidEquipment.push(row.id);
  if (!CANONICAL_PATTERNS.has(row.movementPattern)) invalidPatterns.push(row.id);
  for (const alt of row.alternativeIds ?? []) {
    if (!idSet.has(alt)) missingAlternatives.push(`${row.id}->${alt}`);
  }
  if (!row.instructions?.length) missingInstructions.push(row.id);
  if (!row.animationSpec?.start || !row.animationSpec?.end) missingAnimationSpec.push(row.id);
  const mediaId = row.mediaId || row.id;
  if (!manifestIds.has(mediaId) && !manifestIds.has(row.id)) missingMedia.push(row.id);
}

if (invalidPatterns.length) errors.push("invalidPatterns");
if (invalidGroups.length) errors.push("invalidGroups");
if (invalidEquipment.length) errors.push("invalidEquipment");
if (missingAlternatives.length) errors.push("missingAlternatives");
if (duplicateNames.length) errors.push("duplicateNames");
if (missingInstructions.length) errors.push("missingInstructions");
if (missingAnimationSpec.length) errors.push("missingAnimationSpec");

const report = {
  total: library.length,
  active: library.filter((r) => r.active).length,
  plannerEligible: library.filter((r) => r.plannerEligible).length,
  missingAlternatives: missingAlternatives.length,
  missingMedia: missingMedia.length,
  missingInstructions: missingInstructions.length,
  missingAnimationSpec: missingAnimationSpec.length,
  duplicateNames,
  invalidPatterns: invalidPatterns.length,
  invalidGroups: invalidGroups.length,
  invalidEquipment: invalidEquipment.length,
  seedJsonAligned: !errors.includes("seedJsonDrift"),
  errors,
};

console.log(JSON.stringify(report, null, 2));

if (errors.length) {
  process.exit(1);
}
