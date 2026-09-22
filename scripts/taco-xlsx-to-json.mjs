/**
 * Convert TACO 4ª edição Excel → JSON for scripts/import-taco.mjs.
 *
 * Usage:
 *   node scripts/taco-xlsx-to-json.mjs path/to/Taco-4a-Edicao.xlsx [--out path/to/taco-foods.json]
 *
 * Does NOT commit licensed data. Output stays outside the repo by default.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const inputPath = args.find((a) => !a.startsWith("--"));
const outIdx = args.indexOf("--out");
const outPath =
  outIdx >= 0
    ? args[outIdx + 1]
    : resolve("C:/Users/Douglas - Performanc/Downloads/taco-foods.json");

if (!inputPath) {
  console.error("Usage: node scripts/taco-xlsx-to-json.mjs <Taco.xlsx> [--out file.json]");
  process.exit(1);
}

function zipEntries(buffer) {
  const entries = new Map();
  let i = 0;
  while (i + 30 < buffer.length) {
    if (buffer.readUInt32LE(i) !== 0x04034b50) break;
    const method = buffer.readUInt16LE(i + 8);
    const compSize = buffer.readUInt32LE(i + 18);
    const nameLen = buffer.readUInt16LE(i + 26);
    const extraLen = buffer.readUInt16LE(i + 28);
    const name = buffer.subarray(i + 30, i + 30 + nameLen).toString("utf8");
    const dataStart = i + 30 + nameLen + extraLen;
    const data = buffer.subarray(dataStart, dataStart + compSize);
    let content = null;
    if (method === 0) content = Buffer.from(data);
    else if (method === 8) content = inflateRawSync(data);
    if (content) entries.set(name, content);
    i = dataStart + compSize;
  }
  return entries;
}

function parseSharedStrings(xml) {
  const shared = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml))) {
    const texts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) =>
      t[1]
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"'),
    );
    shared.push(texts.join(""));
  }
  return shared;
}

function colToIndex(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function sheetToMatrix(xml, shared) {
  const matrix = [];
  for (const row of xml.matchAll(/<row[^>]* r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rIdx = Number(row[1]) - 1;
    const cells = [];
    for (const c of row[2].matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>(?:<v>([\s\S]*?)<\/v>)?/g)) {
      const col = colToIndex(c[1]);
      const attrs = c[3];
      const v = c[4];
      let val = v ?? "";
      if (attrs.includes('t="s"') && v != null) val = shared[Number(v)] ?? v;
      cells[col] = val;
    }
    matrix[rIdx] = cells;
  }
  return matrix;
}

function num(v) {
  if (v == null || v === "" || v === "NA" || v === "Tr" || v === "tr") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function slug(s) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56);
}

function mapCategory(raw) {
  const t = (raw ?? "").toLowerCase();
  if (t.includes("cereal")) return "cereais";
  if (t.includes("fruta")) return "frutas";
  if (t.includes("verdura") || t.includes("hortali")) return "hortalicas";
  if (t.includes("gordura") || t.includes("óleo") || t.includes("oleo")) return "oleos";
  if (t.includes("pescado") || t.includes("peixe") || t.includes("seafood")) return "peixes";
  if (t.includes("carne") || t.includes("bovina") || t.includes("suína") || t.includes("suina"))
    return "carnes";
  if (t.includes("ave") || t.includes("frango") || t.includes("peru")) return "aves";
  if (t.includes("leite") || t.includes("derivado") || t.includes("queijo")) return "laticinios";
  if (t.includes("ovo")) return "ovos";
  if (t.includes("legumin") || t.includes("feijão") || t.includes("feijao")) return "leguminosas";
  if (t.includes("bebida") || t.includes("suco")) return "bebidas";
  if (t.includes("açúcar") || t.includes("acucar") || t.includes("doce") || t.includes("produto"))
    return "industrializados";
  if (t.includes("tuber") || t.includes("raiz") || t.includes("batata")) return "tuberculos";
  if (t.includes("nozes") || t.includes("oleaginos") || t.includes("castanha")) return "oleaginosas";
  if (t.includes("fruta")) return "frutas";
  if (t.includes("verdura") || t.includes("hortali")) return "hortalicas";
  if (t.includes("suplement")) return "suplementos";
  return "outros";
}

const buf = readFileSync(resolve(inputPath));
const entries = zipEntries(buf);
const shared = parseSharedStrings(entries.get("xl/sharedStrings.xml")?.toString("utf8") ?? "");
const sheetXml = entries.get("xl/worksheets/sheet1.xml")?.toString("utf8");
if (!sheetXml) {
  console.error("sheet1.xml not found");
  process.exit(1);
}

const matrix = sheetToMatrix(sheetXml, shared);
let currentCategory = "outros";
const foods = [];
const seen = new Set();

for (const row of matrix) {
  if (!row || !row.length) continue;
  const a = row[0] != null ? String(row[0]).trim() : "";
  const b = row[1] != null ? String(row[1]).trim() : "";

  // Category header: text in col A, empty description / no macros
  if (a && !b && num(row[3]) == null && !/^\d+$/.test(a)) {
    currentCategory = mapCategory(a);
    continue;
  }
  if (a && !b && num(row[2]) == null && a.length > 3 && !/^\d+$/.test(a)) {
    currentCategory = mapCategory(a);
    continue;
  }

  const name = b || (a && !/^\d+$/.test(a) ? a : "");
  if (!name || name.length < 2) continue;
  if (/^descri/i.test(name) || /^número/i.test(name) || /^alimento/i.test(a)) continue;

  const energy = num(row[3]);
  const protein = num(row[5]);
  const fat = num(row[6]);
  const carb = num(row[8]);
  if (energy == null && protein == null && carb == null && fat == null) continue;

  const fiber = num(row[9]);
  const sodium = num(row[17]); // Sódio (mg) — col index from header sample

  let idBase = `taco-${slug(name)}`;
  let id = idBase;
  let n = 2;
  while (seen.has(id)) {
    id = `${idBase}-${n++}`;
  }
  seen.add(id);

  const food = {
    id,
    name,
    category: currentCategory,
    source: "taco",
    licenseVerified: true,
    confidence: 0.95,
    synonyms: [],
    per100g: {
      energyKcal: Math.round(energy ?? 0),
      proteinG: Math.round((protein ?? 0) * 10) / 10,
      carbG: Math.round((carb ?? 0) * 10) / 10,
      fatG: Math.round((fat ?? 0) * 10) / 10,
    },
    servings: [{ id: "s-100g", label: "100 g", grams: 100, isDefault: true }],
  };
  if (fiber != null) food.per100g.fiberG = Math.round(fiber * 10) / 10;
  if (sodium != null) food.per100g.sodiumMg = Math.round(sodium);

  foods.push(food);
}

writeFileSync(outPath, JSON.stringify(foods, null, 2), "utf8");
console.log(`OK: ${foods.length} TACO foods → ${outPath}`);
