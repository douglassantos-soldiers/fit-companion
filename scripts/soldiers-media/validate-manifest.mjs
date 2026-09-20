#!/usr/bin/env node
/** Validate style-lock + legal firewall exist and match Soldiers v1 contract. */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const required = [
  "content/soldiers-media-v1/style-lock.json",
  "content/soldiers-media-v1/legal-policy.json",
  "content/soldiers-media-v1/bibles/character.json",
  "content/soldiers-media-v1/bibles/food.json",
  "content/soldiers-media-v1/bibles/product.json",
  "content/soldiers-media-v1/bibles/athlete-three-quarter.png",
];

let failed = 0;
for (const rel of required) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    console.error("missing", rel);
    failed += 1;
    continue;
  }
  if (rel.endsWith(".json")) JSON.parse(readFileSync(path, "utf8"));
}

const legal = JSON.parse(readFileSync(join(root, "content/soldiers-media-v1/legal-policy.json"), "utf8"));
if (legal.license !== "soldiers-owned") {
  console.error("license must be soldiers-owned");
  failed += 1;
}
if (!Array.isArray(legal.forbidden) || legal.forbidden.length < 3) {
  console.error("legal.forbidden too short");
  failed += 1;
}

if (failed) {
  process.exit(1);
}
console.log("manifest contract ok");
