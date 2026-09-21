#!/usr/bin/env node
/**
 * Catalog coverage scorecard: Soldiers library vs taxonomy gaps.
 * Optional --from <json> with { name, muscle, equipment }[] (local dump, never committed).
 * Never reads GIFs, stills, or third-party media URLs.
 *
 * npm run catalog:coverage
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSoldiersLibrary } from "./parse-library.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const catalogDir = join(root, "content/exercise-catalog");
const lotePath = join(catalogDir, "soldiers-lote1.json");
const taxonomyPaths = [
  join(catalogDir, "taxonomy-gaps-v1.json"),
  join(catalogDir, "taxonomy-gaps-v2.json"),
];

function normalizeCatalogName(value) {
  return String(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MUSCLE_ALIASES = {
  peito: "peito",
  chest: "peito",
  costas: "costas",
  back: "costas",
  lats: "costas",
  pernas: "pernas",
  legs: "pernas",
  quads: "pernas",
  hamstrings: "pernas",
  glutes: "pernas",
  calves: "pernas",
  ombros: "ombros",
  shoulders: "ombros",
  biceps: "biceps",
  triceps: "triceps",
  core: "core",
  abs: "core",
  cardio: "cardio",
};

const EQUIP_ALIASES = {
  casa: "casa",
  academia: "academia",
  ambos: "ambos",
  barbell: "academia",
  dumbbell: "academia",
  machine: "academia",
  cable: "academia",
  "body weight": "casa",
  bodyweight: "casa",
  band: "casa",
};

function matchLibrary(name, library) {
  const needle = normalizeCatalogName(name);
  return (
    library.find((row) => normalizeCatalogName(row.name) === needle) ??
    library.find((row) => normalizeCatalogName(row.id.replace(/-/g, " ")) === needle) ??
    null
  );
}

function countBy(rows, keyFn) {
  const out = {};
  for (const row of rows) {
    const key = keyFn(row) || "(empty)";
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => a[0].localeCompare(b[0])));
}

mkdirSync(catalogDir, { recursive: true });
const library = parseSoldiersLibrary(root);
writeFileSync(
  lotePath,
  `${JSON.stringify(
    library.map((row) => ({
      id: row.id,
      name: row.name,
      group: row.group,
      equipment: row.equipment,
      movementPattern: row.movementPattern,
      plannerEligible: row.plannerEligible,
    })),
    null,
    2,
  )}\n`,
);

const taxonomyReports = [];
let applied = [];
for (const taxonomyPath of taxonomyPaths) {
  if (!existsSync(taxonomyPath)) continue;
  const taxonomy = JSON.parse(readFileSync(taxonomyPath, "utf8"));
  const fileApplied = taxonomy.map((entry) => {
    if (entry.status === "deferred") return entry;
    const hit = matchLibrary(entry.targetNamePt, library);
    if (!hit) return { ...entry, status: "missing" };
    return { ...entry, status: "covered", soldiersId: hit.id };
  });
  applied = applied.concat(fileApplied);
  const fileMissing = fileApplied.filter((e) => e.status === "missing");
  const fileCovered = fileApplied.filter((e) => e.status === "covered");
  const fileDeferred = fileApplied.filter((e) => e.status === "deferred");
  taxonomyReports.push({
    file: taxonomyPath.replace(`${root}/`, "").replace(/\\/g, "/"),
    taxonomy: fileApplied.length,
    covered: fileCovered.length,
    missing: fileMissing.length,
    deferred: fileDeferred.length,
    missingNames: fileMissing.map((e) => e.targetNamePt),
  });
}

const fromIdx = process.argv.indexOf("--from");
const extraGaps = [];
if (fromIdx >= 0) {
  const fromPath = process.argv[fromIdx + 1];
  if (!fromPath || !existsSync(fromPath)) {
    console.error("Missing --from file");
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(fromPath, "utf8"));
  const list = Array.isArray(raw) ? raw : (raw.exercises ?? []);
  for (const item of list) {
    const name = String(item.name ?? item.targetNamePt ?? "").trim();
    if (!name) continue;
    if (item.gif || item.image || item.animation || item.url || item.instructions) continue;
    if (matchLibrary(name, library)) continue;
    const muscle =
      MUSCLE_ALIASES[normalizeCatalogName(item.muscle ?? item.muscleHint ?? "")] ?? null;
    const equipment =
      EQUIP_ALIASES[normalizeCatalogName(item.equipment ?? item.equipmentHint ?? "")] ?? "ambos";
    extraGaps.push({
      name,
      muscle: muscle ?? "core",
      equipment,
    });
  }
}

const missing = applied.filter((e) => e.status === "missing");
const covered = applied.filter((e) => e.status === "covered");
const deferred = applied.filter((e) => e.status === "deferred");

const nameCounts = new Map();
for (const row of library) {
  const key = String(row.name).trim().toLowerCase();
  nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
}
const duplicateNames = [...nameCounts.entries()].filter(([, n]) => n > 1).map(([n]) => n);

const gymGear = {};
for (const row of library) {
  for (const gear of row.equipmentInventory ?? []) {
    gymGear[gear] = (gymGear[gear] ?? 0) + 1;
  }
}

const missingInstructions = library.filter((r) => !r.instructions?.length).map((r) => r.id);
const missingAlternatives = library.filter((r) => !r.alternativeIds?.length).map((r) => r.id);
const missingMedia = library.filter((r) => r.mediaStatus !== "published").map((r) => r.id);

console.log(
  JSON.stringify(
    {
      library: library.length,
      plannerEligible: library.filter((r) => r.plannerEligible).length,
      taxonomy: applied.length,
      covered: covered.length,
      missing: missing.length,
      deferred: deferred.length,
      taxonomyFiles: taxonomyReports,
      extraImportGaps: extraGaps.length,
      missingNames: missing.map((e) => e.targetNamePt),
      byMuscle: countBy(library, (r) => r.group),
      byEquipment: countBy(library, (r) => r.equipment),
      byMovementPattern: countBy(library, (r) => r.movementPattern),
      byGymGear: Object.fromEntries(
        Object.entries(gymGear).sort((a, b) => a[0].localeCompare(b[0])),
      ),
      duplicateNames,
      missingInstructions: missingInstructions.length,
      missingAlternatives: missingAlternatives.length,
      missingMedia: missingMedia.length,
      taxonomyByStatus: {
        covered: covered.map((e) => e.targetNamePt),
        missing: missing.map((e) => e.targetNamePt),
        deferred: deferred.map((e) => e.targetNamePt),
      },
    },
    null,
    2,
  ),
);
