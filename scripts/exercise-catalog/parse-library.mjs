/**
 * Parse Soldiers library from lote 1/2/2b/2c/3 TS (authored PT rows).
 * No third-party catalogs.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const LIBRARY_SOURCE_FILES = [
  "src/data/exercise-library.ts",
  "src/data/exercise-library-lote2.ts",
  "src/data/exercise-library-lote2b.ts",
  "src/data/exercise-library-lote2c.ts",
  "src/data/exercise-library-lote3.ts",
];

export function loadLibrarySource(root) {
  return LIBRARY_SOURCE_FILES.map((rel) => join(root, rel))
    .filter((p) => existsSync(p))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
}

export function parseSoldiersLibrary(root) {
  return parseLibrarySource(loadLibrarySource(root));
}
const PATTERN_ALIASES = {
  fly: "raise",
  carry_iso: "isometric",
  other: "mobility",
};

const CANONICAL_PATTERNS = new Set([
  "press",
  "pull",
  "squat",
  "hinge",
  "lunge",
  "carry",
  "rotation",
  "anti_rotation",
  "raise",
  "curl",
  "extension",
  "cardio",
  "isometric",
  "mobility",
]);

export function normalizeMovementPattern(raw, fallback = "mobility") {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!key) return fallback;
  if (PATTERN_ALIASES[key]) return PATTERN_ALIASES[key];
  if (CANONICAL_PATTERNS.has(key)) return key;
  return fallback;
}

export { PATTERN_ALIASES, CANONICAL_PATTERNS };

function extractExBlocks(src) {
  const blocks = [];
  let search = 0;
  while (true) {
    const start = src.indexOf("ex({", search);
    if (start < 0) break;
    let depth = 0;
    let i = start + 3;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          blocks.push(src.slice(start + 3, i + 1));
          search = i + 1;
          break;
        }
      }
    }
    if (depth !== 0) break;
  }
  return blocks;
}

function extractString(block, key) {
  const m = block.match(new RegExp(`${key}:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  return m ? m[1] : "";
}

function extractNumber(block, key, fallback) {
  const m = block.match(new RegExp(`${key}:\\s*(-?\\d+(?:\\.\\d+)?)`));
  return m ? Number(m[1]) : fallback;
}

function extractStringArray(block, key) {
  const m = block.match(new RegExp(`${key}:\\s*\\[([\\s\\S]*?)\\]`));
  if (!m) return [];
  return [...m[1].matchAll(/"((?:\\\\.|[^"\\\\])*)"/g)].map((x) => x[1]);
}

function extractPlanner(block) {
  if (/plannerEligible:\s*(?:false|LIBRARY_ONLY)\b/.test(block)) return false;
  return true;
}

export function parseLibrarySource(src) {
  return extractExBlocks(src).map((block) => {
    const id = extractString(block, "id");
    const name = extractString(block, "name");
    const group = extractString(block, "group");
    const rawPattern = extractString(block, "movementPattern");
    return {
      id,
      canonicalName: id,
      displayNamePt: name,
      name,
      version: 1,
      group,
      equipment: extractString(block, "equipment"),
      swapGroup: extractString(block, "swapGroup"),
      joints: extractStringArray(block, "joints"),
      unit: extractString(block, "unit") || "kg",
      baseLoad: extractNumber(block, "baseLoad", 20),
      priority: extractNumber(block, "priority", 2),
      primaryMuscles: [group].filter(Boolean),
      secondaryMuscles: extractStringArray(block, "secondaryMuscles"),
      movementPattern: normalizeMovementPattern(rawPattern),
      movementPatternRaw: rawPattern,
      difficulty: extractString(block, "difficulty") || "intermediate",
      plannerEligible: extractPlanner(block),
      active: true,
      instructions: extractStringArray(block, "instructions"),
      alternativeIds: extractStringArray(block, "alternativeIds"),
      equipmentInventory: extractStringArray(block, "equipmentInventory"),
      mediaId: id,
      mediaStatus: "missing",
      animationSpec: {
        start: extractString(block, "start"),
        end: extractString(block, "end"),
        tempo: extractString(block, "tempo") || "controlled",
        durationSec: 4,
        loop: true,
        camera: extractString(block, "camera") || "three-quarter",
      },
    };
  });
}

export function parseManifestExerciseIds(src) {
  const ids = new Set();
  const re = /kind:\s*"exercise"[\s\S]*?entityId:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) ids.add(m[1]);
  const pilot = src.match(/export const PILOT_EXERCISE_IDS = \[([\s\S]*?)\]/);
  if (pilot) {
    for (const hit of pilot[1].matchAll(/"([^"]+)"/g)) ids.add(hit[1]);
  }
  return ids;
}
