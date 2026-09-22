#!/usr/bin/env node
/**
 * Validate internal food + recipe catalog (no TACO import).
 * npm run food:validate
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function duplicates(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n > 1).map(([v]) => v);
}

const foodsSrc = `${read("src/data/foods.ts")}\n${read("src/data/foods-lote2.ts")}\n${read("src/data/foods-delivery-br.ts")}\n${read("src/data/foods-brands-ean.ts")}`;
const recipesSrc = read("src/data/recipes.ts");
const lote2Src = read("src/data/foods-lote2.ts");
const deliverySrc = read("src/data/foods-delivery-br.ts");
const brandsSrc = read("src/data/foods-brands-ean.ts");
const perfMicrosSrc = read("src/data/foods-performance-micros.ts");

const foodIds = [
  ...foodsSrc.matchAll(/\bid:\s*["']([^"']+)["']/g),
]
  .map((m) => m[1])
  .filter((id) => !id.startsWith("s-") && !id.startsWith("br-s-"));
const foodNames = [...foodsSrc.matchAll(/\bname:\s*["']([^"']+)["']/g)].map((m) =>
  m[1].toLowerCase().trim(),
);

const recipeIds = [...recipesSrc.matchAll(/id:\s*"(recipe-[^"]+)"/g)].map((m) => m[1]);
const recipeNames = [
  ...recipesSrc.matchAll(/id:\s*"recipe-[^"]+"\s*,\s*\n\s*name:\s*"([^"]+)"/g),
].map((m) => m[1].toLowerCase().trim());

const recipeFoodIds = [...recipesSrc.matchAll(/item\("([^"]+)"/g)].map((m) => m[1]);
const foodIdSet = new Set(foodIds);
const missingRecipeFoods = [...new Set(recipeFoodIds.filter((id) => !foodIdSet.has(id)))];

const negativeMacros = [];
for (const m of foodsSrc.matchAll(
  /\b(kcal|proteinG|carbG|fatG|fiberG|sugarG|sodiumMg):\s*(-?\d+(?:\.\d+)?)/g,
)) {
  if (Number(m[2]) < 0) negativeMacros.push(`${m[1]}=${m[2]}`);
}

const badGrams = [...foodsSrc.matchAll(/\bgrams:\s*(-?\d+(?:\.\d+)?)/g)]
  .map((m) => Number(m[1]))
  .filter((n) => n <= 0);

const lote2FoodCount = [...lote2Src.matchAll(/\bid:\s*"([^"]+)"/g)]
  .map((m) => m[1])
  .filter((id) => !id.startsWith("s-")).length;
const deliveryFoodCount = [...deliverySrc.matchAll(/\bid:\s*"([^"]+)"/g)]
  .map((m) => m[1])
  .filter((id) => !id.startsWith("s-")).length;
const performanceMicroFoods = [
  ...perfMicrosSrc.matchAll(/^\s*"([^"]+)":\s*\{/gm),
].map((m) => m[1]);
const lote2MissingVersion = !/sourceVersion:\s*INTERNAL_SOURCE_VERSION/.test(lote2Src);
const deliveryMissingVersion = !/sourceVersion:\s*INTERNAL_SOURCE_VERSION/.test(deliverySrc);
const tacoInSeed = /source:\s*"taco"/.test(foodsSrc);

const eans = [...foodsSrc.matchAll(/\bean:\s*["']([^"']+)["']/g)].map((m) => m[1].replace(/\D/g, ""));
const badEanFormat = eans.filter((e) => e.length !== 8 && e.length !== 12 && e.length !== 13);
const dupEans = duplicates(eans.filter(Boolean));

const errors = [];
const dupFoodIds = duplicates(foodIds);
const dupFoodNames = duplicates(foodNames);
const dupRecipeIds = duplicates(recipeIds);
const dupRecipeNames = duplicates(recipeNames);

if (dupFoodIds.length) errors.push("duplicateFoodIds");
if (dupFoodNames.length) errors.push("duplicateFoodNames");
if (dupRecipeIds.length) errors.push("duplicateRecipeIds");
if (dupRecipeNames.length) errors.push("duplicateRecipeNames");
if (missingRecipeFoods.length) errors.push("recipeFoodIdMissing");
if (negativeMacros.length) errors.push("negativeMacros");
if (badGrams.length) errors.push("gramsEquivalentInvalid");
if (lote2MissingVersion) errors.push("lote2MissingSourceVersion");
if (deliveryMissingVersion) errors.push("deliveryMissingSourceVersion");
if (deliveryFoodCount < 50) errors.push("deliveryFoodsTooFew");
if (performanceMicroFoods.length < 25) errors.push("performanceMicrosTooFew");
if (tacoInSeed) errors.push("tacoPresentInSeed");
if (badEanFormat.length) errors.push("eanFormatInvalid");
if (dupEans.length) errors.push("duplicateEans");

const report = {
  foods: foodIds.length,
  recipes: recipeIds.length,
  lote2Foods: lote2FoodCount,
  deliveryFoods: deliveryFoodCount,
  performanceMicroFoods: performanceMicroFoods.length,
  brandedEanFoods: [...brandsSrc.matchAll(/\bid:\s*['"]([^'"]+)['"]/g)]
    .map((m) => m[1])
    .filter((id) => id.startsWith("br-")).length,
  duplicateFoodIds: dupFoodIds,
  duplicateFoodNames: dupFoodNames,
  duplicateRecipeIds: dupRecipeIds,
  duplicateRecipeNames: dupRecipeNames,
  duplicateEans: dupEans,
  badEanFormat,
  missingRecipeFoods,
  negativeMacros: negativeMacros.length,
  gramsEquivalentInvalid: badGrams.length,
  lote2HasSourceVersion: !lote2MissingVersion,
  deliveryHasSourceVersion: !deliveryMissingVersion,
  tacoInSeed,
  errors,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
console.log("food catalog ok");
