/**
 * Soldiers internal recipes — structure only (macros computed in lib/nutrition/recipes).
 * Conceptual reference (API-Receitas); no licensed recipe data copied.
 */
import type { RecipeDifficulty, RecipeItem } from "@/lib/nutrition/types";

export type RecipeSeed = {
  id: string;
  name: string;
  servings: number;
  prepMinutes?: number;
  cookMinutes?: number;
  difficulty?: RecipeDifficulty;
  items: RecipeItem[];
  tags?: string[];
};

function item(foodId: string, grams: number, quantity = grams, unit = "g"): RecipeItem {
  return { foodId, quantity, unit, grams };
}

export const RECIPE_SEEDS: RecipeSeed[] = [
  {
    id: "recipe-frango-arroz-feijao",
    name: "Frango, arroz e feijão",
    servings: 1,
    prepMinutes: 10,
    cookMinutes: 25,
    difficulty: "facil",
    tags: ["almoco", "jantar", "proteina"],
    items: [
      item("frango-peito-grelhado", 150),
      item("arroz-branco-cozido", 150),
      item("feijao-carioca-cozido", 100),
      item("salada-mista", 80),
    ],
  },
  {
    id: "recipe-ovos-pao",
    name: "Ovos com pão",
    servings: 1,
    prepMinutes: 5,
    cookMinutes: 10,
    difficulty: "facil",
    tags: ["cafe"],
    items: [item("ovo-cozido", 100, 2, "unidade"), item("pao-frances", 50, 1, "unidade")],
  },
  {
    id: "recipe-whey-banana",
    name: "Whey com banana",
    servings: 1,
    prepMinutes: 3,
    cookMinutes: 0,
    difficulty: "facil",
    tags: ["lanche", "pos-treino"],
    items: [
      item("whey-protein", 30, 1, "scoop"),
      item("banana-prata", 100, 1, "unidade"),
      item("leite-desnatado", 200, 1, "copo"),
    ],
  },
  {
    id: "recipe-tapioca-ovo-queijo",
    name: "Tapioca com ovo e queijo",
    servings: 1,
    prepMinutes: 5,
    cookMinutes: 8,
    difficulty: "facil",
    tags: ["cafe", "lanche"],
    items: [
      item("tapioca", 80, 1, "unidade"),
      item("ovo-frito", 50, 1, "unidade"),
      item("queijo-minas", 30, 1, "fatia"),
    ],
  },
  {
    id: "recipe-salmao-batata-doce",
    name: "Salmão com batata-doce",
    servings: 1,
    prepMinutes: 10,
    cookMinutes: 20,
    difficulty: "medio",
    tags: ["jantar", "performance"],
    items: [
      item("salmao-grelhado", 150),
      item("batata-doce-cozida", 150),
      item("brocolis-cozido", 100),
      item("azeite-oliva", 5, 1, "colher"),
    ],
  },
  {
    id: "recipe-iogurte-granola",
    name: "Iogurte com granola e morango",
    servings: 1,
    prepMinutes: 3,
    cookMinutes: 0,
    difficulty: "facil",
    tags: ["lanche", "cafe"],
    items: [
      item("iogurte-natural", 170, 1, "pote"),
      item("granola", 30, 2, "colher"),
      item("morango", 80),
    ],
  },
];
