#!/usr/bin/env node
/**
 * Catalog coverage: Soldiers library vs taxonomy gaps.
 * Optional --from <json> with { name, muscle, equipment }[] (local dump, never committed).
 * Never reads GIFs, stills, or instruction fields.
 *
 * npm run catalog:coverage
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const catalogDir = join(root, "content/exercise-catalog");
const libraryPath = join(root, "src/data/exercise-library.ts");
const lotePath = join(catalogDir, "soldiers-lote1.json");
const taxonomyPath = join(catalogDir, "taxonomy-gaps-v1.json");

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

function parseLibrary(src) {
  const rows = [];
  const re =
    /id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?group:\s*"([^"]+)"[\s\S]*?equipment:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) {
    rows.push({ id: m[1], name: m[2], group: m[3], equipment: m[4] });
  }
  return rows;
}

function matchLibrary(name, library) {
  const needle = normalizeCatalogName(name);
  return (
    library.find((row) => normalizeCatalogName(row.name) === needle) ??
    library.find((row) => normalizeCatalogName(row.id.replace(/-/g, " ")) === needle) ??
    null
  );
}

mkdirSync(catalogDir, { recursive: true });
const library = parseLibrary(readFileSync(libraryPath, "utf8"));
writeFileSync(lotePath, `${JSON.stringify(library, null, 2)}\n`);

const taxonomy = JSON.parse(readFileSync(taxonomyPath, "utf8"));
const applied = taxonomy.map((entry) => {
  if (entry.status === "deferred") return entry;
  const hit = matchLibrary(entry.targetNamePt, library);
  if (!hit) return { ...entry, status: "missing" };
  return { ...entry, status: "covered", soldiersId: hit.id };
});

const fromIdx = process.argv.indexOf("--from");
const extraGaps = [];
if (fromIdx >= 0) {
  const fromPath = process.argv[fromIdx + 1];
  if (!fromPath || !existsSync(fromPath)) {
    console.error("Missing --from file");
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(fromPath, "utf8"));
  const list = Array.isArray(raw) ? raw : raw.exercises ?? [];
  for (const item of list) {
    const name = String(item.name ?? item.targetNamePt ?? "").trim();
    if (!name) continue;
    if (item.gif || item.image || item.animation || item.url || item.instructions) continue;
    if (matchLibrary(name, library)) continue;
    const muscle = MUSCLE_ALIASES[normalizeCatalogName(item.muscle ?? item.muscleHint ?? "")] ?? null;
    const equipment = EQUIP_ALIASES[normalizeCatalogName(item.equipment ?? item.equipmentHint ?? "")] ?? "ambos";
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

console.log(
  JSON.stringify(
    {
      lote1: library.length,
      taxonomy: applied.length,
      covered: covered.length,
      missing: missing.length,
      deferred: deferred.length,
      extraImportGaps: extraGaps.length,
      missingNames: missing.map((e) => e.targetNamePt),
    },
    null,
    2,
  ),
);
