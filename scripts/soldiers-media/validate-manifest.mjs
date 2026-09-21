#!/usr/bin/env node
/**
 * Validate Soldiers media governance contract.
 * npm run media:validate
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadLibrarySource,
  parseManifestExerciseIds,
  parseSoldiersLibrary,
} from "../exercise-catalog/parse-library.mjs";
import { MOTION_KINDS } from "./governance-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const mediaRoot = join(root, "public/soldiers-media/v1");
const required = [
  "content/soldiers-media-v1/style-lock.json",
  "content/soldiers-media-v1/legal-policy.json",
  "content/soldiers-media-v1/bibles/character.json",
  "content/soldiers-media-v1/bibles/food.json",
  "content/soldiers-media-v1/bibles/product.json",
  "content/soldiers-media-v1/bibles/athlete-three-quarter.png",
];

const errors = [];
const warnings = [];

for (const rel of required) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    errors.push(`missing:${rel}`);
    continue;
  }
  if (rel.endsWith(".json")) JSON.parse(readFileSync(path, "utf8"));
}

const legal = JSON.parse(readFileSync(join(root, "content/soldiers-media-v1/legal-policy.json"), "utf8"));
if (legal.license !== "soldiers-owned") errors.push("license_not_soldiers_owned");
if (!Array.isArray(legal.forbidden) || legal.forbidden.length < 3) errors.push("legal_forbidden_short");

const library = parseSoldiersLibrary(root);
const manifestIds = parseManifestExerciseIds(readFileSync(join(root, "src/data/soldiers-media-manifest.ts"), "utf8"));
const catalogIds = new Set(library.map((row) => row.mediaId || row.id));

const missingPackage = [];
for (const row of library) {
  const mediaId = row.mediaId || row.id;
  if (!mediaId) missingPackage.push(row.id);
  if (!catalogIds.has(mediaId) && !manifestIds.has(mediaId) && !manifestIds.has(row.id)) {
    missingPackage.push(row.id);
  }
}

const publishedOnDisk = [];
const posterMissing = [];
const thumbMissing = [];
const motionMissing = [];
const checksumMismatch = [];
const externalUrls = [];

function pickFiles(dir) {
  const poster = existsSync(join(dir, "poster.webp"))
    ? join(dir, "poster.webp")
    : existsSync(join(dir, "poster.png"))
      ? join(dir, "poster.png")
      : null;
  const thumb = existsSync(join(dir, "thumb.webp"))
    ? join(dir, "thumb.webp")
    : existsSync(join(dir, "thumb.png"))
      ? join(dir, "thumb.png")
      : poster;
  const webm = existsSync(join(dir, "animation.webm")) ? join(dir, "animation.webm") : null;
  const mp4 = existsSync(join(dir, "animation.mp4")) ? join(dir, "animation.mp4") : null;
  return { poster, thumb, webm, mp4 };
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

if (existsSync(mediaRoot)) {
  for (const kind of readdirSync(mediaRoot)) {
    const kindDir = join(mediaRoot, kind);
    if (!statSync(kindDir).isDirectory()) continue;
    for (const entityId of readdirSync(kindDir)) {
      const dir = join(kindDir, entityId);
      if (!statSync(dir).isDirectory()) continue;
      const files = pickFiles(dir);
      const hasPackage = Boolean(files.poster || files.thumb || files.webm || files.mp4);
      if (!hasPackage) continue;
      publishedOnDisk.push(`${kind}/${entityId}`);
      if (!files.poster) posterMissing.push(`${kind}/${entityId}`);
      if (!files.thumb) thumbMissing.push(`${kind}/${entityId}`);
      if (MOTION_KINDS.has(kind) && !files.webm && !files.mp4) motionMissing.push(`${kind}/${entityId}`);

      const checksumPath = join(dir, "checksums.json");
      if (existsSync(checksumPath) && files.poster) {
        const stored = JSON.parse(readFileSync(checksumPath, "utf8"));
        const actual = sha256File(files.poster);
        if (stored.poster && stored.poster !== actual) checksumMismatch.push(`${kind}/${entityId}`);
      }
    }
  }
}

const librarySrc = loadLibrarySource(root);
const exercisesSrc = readFileSync(join(root, "src/data/exercises.ts"), "utf8");
for (const src of [librarySrc, exercisesSrc]) {
  const urls = src.match(/https?:\/\/[^\s"'`]+/g) ?? [];
  for (const url of urls) {
    if (/unsplash|gymvisual|opengym|open-gym|pexels|pixabay|giphy|ytimg/i.test(url)) {
      externalUrls.push(url);
    }
  }
}

if (missingPackage.length) errors.push("catalog_media_id_without_package");
if (posterMissing.length) errors.push("published_disk_poster_missing");
if (thumbMissing.length) errors.push("published_disk_thumb_missing");
if (motionMissing.length) errors.push("published_disk_motion_missing");
if (checksumMismatch.length) errors.push("checksum_mismatch");
if (externalUrls.length) errors.push("external_urls_in_seed");

const report = {
  ok: errors.length === 0,
  license: legal.license,
  totalExercises: library.length,
  packagesOnDisk: publishedOnDisk.length,
  catalogMediaIdWithoutPackage: missingPackage.length,
  posterMissing: posterMissing.length,
  thumbMissing: thumbMissing.length,
  motionMissing: motionMissing.length,
  checksumMismatch: checksumMismatch.length,
  externalUrls: externalUrls.length,
  errors,
  warnings,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
console.log("media governance contract ok");
