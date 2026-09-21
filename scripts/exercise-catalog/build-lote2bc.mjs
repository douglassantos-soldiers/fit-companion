/**
 * One-shot: lote 2b/2c TS + taxonomy-gaps-v2.json. Delete after run.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** @typedef {{ id: string, lote: "2b"|"2c", name: string, en: string, group: string, equipment: string, inv: string[], swap: string, joints: string[], unit: string, load: number, pattern: string, secondary: string[], difficulty?: string, start: string, end: string, steps: string[], cues?: string[], tempo?: string }} Row */

/** @type {Row[]} */
const ROWS = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "lote2bc-rows.json"), "utf8"),
);

function esc(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function emitExercise(r, plannerFlag) {
  const sec =
    r.secondary.length > 0
      ? `\n    secondaryMuscles: [${r.secondary.map((x) => `"${x}"`).join(", ")}],`
      : "\n    secondaryMuscles: [],";
  const inv = `\n    equipmentInventory: [${r.inv.map((x) => `"${x}"`).join(", ")}],`;
  const joints =
    r.joints.length > 0
      ? `\n    joints: [${r.joints.map((x) => `"${x}"`).join(", ")}],`
      : "\n    joints: [],";
  const cues = r.cues?.length
    ? `\n    cues: [${r.cues.map((x) => `"${esc(x)}"`).join(", ")}],`
    : "";
  const tempo = r.tempo ? `\n    tempo: "${r.tempo}",` : "";
  const diff = r.difficulty ?? "intermediate";
  const steps = r.steps.map((x) => `"${esc(x)}"`).join(",\n      ");
  return `  ex({
    id: "${r.id}",
    name: "${esc(r.name)}",
    displayNameEn: "${esc(r.en)}",
    aliases: [],
    group: "${r.group}",
    equipment: "${r.equipment}",${inv}
    swapGroup: "${r.swap}",${joints}
    unit: "${r.unit}",
    baseLoad: ${r.load},
    priority: 3,${sec}
    movementPattern: "${r.pattern}",
    difficulty: "${diff}",
    plannerEligible: ${plannerFlag},
    instructions: [
      ${steps},
    ],${cues}
    start: "${esc(r.start)}",
    end: "${esc(r.end)}",${tempo}
  })`;
}

function emitTs(exportName, comment, lote, plannerConst) {
  const subset = ROWS.filter((r) => r.lote === lote);
  const blocks = subset.map((r) => emitExercise(r, plannerConst)).join(",\n");
  return `/**
 * ${comment}
 * No third-party media or licensed copy.
 */
import {
  ex,
  ${plannerConst === "PLANNER" ? "PLANNER_ELIGIBLE as PLANNER" : "LIBRARY_ONLY"},
  type LibraryExercise,
} from "@/data/exercise-library-helpers";

export const ${exportName}: LibraryExercise[] = [
${blocks},
];
`;
}

const twoB = ROWS.filter((r) => r.lote === "2b");
const twoC = ROWS.filter((r) => r.lote === "2c");
if (twoB.length !== 35 || twoC.length !== 80) {
  console.error(`Expected 35+80 rows, got ${twoB.length}+${twoC.length}`);
  process.exit(1);
}

const ids = new Set();
for (const r of ROWS) {
  if (ids.has(r.id)) {
    console.error("Duplicate id in seed:", r.id);
    process.exit(1);
  }
  ids.add(r.id);
}

const existingSrc = [
  "src/data/exercise-library.ts",
  "src/data/exercise-library-lote2.ts",
  "src/data/exercise-library-lote3.ts",
]
  .map((rel) => join(root, rel))
  .filter((p) => existsSync(p))
  .map((p) => readFileSync(p, "utf8"))
  .join("\n");

for (const r of ROWS) {
  if (existingSrc.includes(`id: "${r.id}"`)) {
    console.error("Collides with existing library id:", r.id);
    process.exit(1);
  }
}

writeFileSync(
  join(root, "src/data/exercise-library-lote2b.ts"),
  `${emitTs(
    "EXERCISE_LIBRARY_LOTE2B",
    "Lote 2b — planner pool expansion (~35).",
    "2b",
    "PLANNER",
  )}\n`,
);
writeFileSync(
  join(root, "src/data/exercise-library-lote2c.ts"),
  `${emitTs(
    "EXERCISE_LIBRARY_LOTE2C",
    "Lote 2c — library-only variations (~80).",
    "2c",
    "LIBRARY_ONLY",
  )}\n`,
);

const taxonomy = ROWS.map((r) => ({
  targetNamePt: r.name,
  muscleHint: r.group,
  equipmentHint: r.equipment,
  status: "missing",
  loteHint: r.lote,
}));

mkdirSync(join(root, "content/exercise-catalog"), { recursive: true });
writeFileSync(
  join(root, "content/exercise-catalog/taxonomy-gaps-v2.json"),
  `${JSON.stringify(taxonomy, null, 2)}\n`,
);

console.log("Wrote lote2b, lote2c, taxonomy-v2:", twoB.length, twoC.length, taxonomy.length);
