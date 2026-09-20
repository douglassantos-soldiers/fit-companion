#!/usr/bin/env node
/**
 * Write image-to-video / still prompts from library specs.
 * Never includes third-party media paths.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = join(root, "content/soldiers-media-v1/prompts");
mkdirSync(outDir, { recursive: true });

const style =
  "Soldiers Animation Style v1. Dark studio #080808, gold rim light, original Soldiers athlete, matte black kit, 3/4 camera locked, no text, no watermark, no third-party likeness.";

const pilot = [
  ["exercise", "supino-reto", "barbell bench press start bar on chest end arms extended 4s loop"],
  ["exercise", "flexao", "push-up start chest near floor end arms extended 4s loop"],
  ["exercise", "remada-curvada", "bent over row start bar hanging end bar at torso 4s loop"],
  ["exercise", "barra-fixa", "pull-up start hang end chin over bar 4s loop"],
  ["exercise", "agachamento", "back squat start thighs parallel end standing 4s loop"],
  ["exercise", "terra-romeno", "romanian deadlift start bar below knees end hip extended 4s loop"],
  ["exercise", "desenvolvimento", "military press start bar at clavicle end overhead 4s loop"],
  ["exercise", "elevacao-lateral", "lateral raise start dumbbells at thighs end at shoulder line 4s loop"],
  ["exercise", "rosca-direta", "barbell curl start bar at thighs end bar at shoulders 4s loop"],
  ["exercise", "prancha", "forearm plank isometric hold 4s loop"],
  ["brand", "welcome-hero", "athlete looping a clean squat in Soldiers studio 4s"],
  ["howto", "log-meal", "logging a meal on a dark phone 3s"],
  ["howto", "mix-whey", "mixing whey in a black shaker 3s"],
  ["howto", "complete-set", "racking a barbell after a set 3s"],
];

const lines = [];
for (const [kind, id, motion] of pilot) {
  const prompt = `${style} Kind=${kind} id=${id}. Motion: ${motion}. Input: Soldiers still of this exercise only. Never use openGym, Gym Visual, or Unsplash as a frame.`;
  lines.push(`# ${kind}/${id}\n${prompt}\n`);
}

writeFileSync(join(outDir, "pilot-v1.txt"), lines.join("\n"), "utf8");
console.log(`wrote ${pilot.length} prompts to content/soldiers-media-v1/prompts/pilot-v1.txt`);
