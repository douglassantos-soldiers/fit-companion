/**
 * Inspect TACO xlsx structure (sheets + first rows).
 * Usage: node scripts/inspect-taco-xlsx.mjs [path]
 */
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { resolve } from "node:path";

const path = resolve(process.argv[2] ?? "C:/Users/Douglas - Performanc/Downloads/Taco-4a-Edicao.xlsx");
const buf = readFileSync(path);
console.log("size", buf.length);

// Minimal ZIP local-file parse for xl/workbook.xml + sharedStrings + first sheet
function zipEntries(buffer) {
  const entries = new Map();
  let i = 0;
  while (i + 30 < buffer.length) {
    if (buffer.readUInt32LE(i) !== 0x04034b50) break;
    const method = buffer.readUInt16LE(i + 8);
    const compSize = buffer.readUInt32LE(i + 18);
    const uncompSize = buffer.readUInt32LE(i + 22);
    const nameLen = buffer.readUInt16LE(i + 26);
    const extraLen = buffer.readUInt16LE(i + 28);
    const name = buffer.subarray(i + 30, i + 30 + nameLen).toString("utf8");
    const dataStart = i + 30 + nameLen + extraLen;
    const data = buffer.subarray(dataStart, dataStart + compSize);
    let content;
    if (method === 0) content = data;
    else if (method === 8) content = inflateRawSync(data);
    else content = null;
    if (content) entries.set(name, content);
    i = dataStart + compSize;
  }
  return entries;
}

const entries = zipEntries(buf);
console.log(
  "entries",
  [...entries.keys()].filter((k) => k.startsWith("xl/")).slice(0, 40),
);

const wb = entries.get("xl/workbook.xml")?.toString("utf8") ?? "";
const sheetNames = [...wb.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
console.log("sheets", sheetNames);

const ssXml = entries.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
const shared = [];
const siRe = /<si>([\s\S]*?)<\/si>/g;
let m;
while ((m = siRe.exec(ssXml))) {
  const texts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) =>
    t[1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"'),
  );
  shared.push(texts.join(""));
}
console.log("sharedStrings", shared.length);
console.log("sample strings", shared.slice(0, 30));

for (const name of sheetNames.slice(0, 4)) {
  const sheetPath = [...entries.keys()].find((k) => k.includes("worksheets/sheet") && k.endsWith(".xml"));
}
// Map rId to sheet via workbook relationships
const rels = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
const ridMap = new Map();
for (const rm of rels.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
  ridMap.set(rm[1], rm[2].replace(/^\//, "").replace(/^xl\//, "xl/"));
}
const sheetsMeta = [...wb.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g)];
for (const [, name, rid] of sheetsMeta) {
  let target = ridMap.get(rid);
  if (!target) continue;
  if (!target.startsWith("xl/")) target = `xl/${target}`;
  const xml = entries.get(target)?.toString("utf8");
  if (!xml) {
    console.log("missing sheet", name, target);
    continue;
  }
  const rows = [];
  for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const c of row[1].matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>(?:<v>([\s\S]*?)<\/v>)?/g)) {
      const col = c[1];
      const attrs = c[3];
      const v = c[4];
      let val = v ?? "";
      if (attrs.includes('t="s"') && v != null) val = shared[Number(v)] ?? v;
      cells.push({ col, val });
    }
    if (cells.length) rows.push(cells.map((c) => c.val));
    if (rows.length >= 6) break;
  }
  console.log("\n===", name, "===");
  for (const r of rows) console.log(JSON.stringify(r));
}
