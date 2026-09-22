# Catalog Scale

A Fase 7 amplia o **conteúdo** do catálogo (exercícios lote 2–3, alimentos internos, receitas) e os **índices/quality gates**. Training Engine e Nutrition Engine não são reescritos. TACO, openGym e GymVisual continuam fora do git.

## O que entra

| Camada | Papel |
| ------ | ----- |
| Lote 1 | 100 exercícios intactos, `plannerEligible: true` |
| Lote 2 | 24 famílias em falta (taxonomy-gaps-v1), `plannerEligible: true` |
| Lote 2b | 35 exercícios planner (taxonomy-gaps-v2), `plannerEligible: true` |
| Lote 2c | 80 variações library-only (taxonomy-gaps-v2), **fora** do planner |
| Lote 3 | 11 avançados, **fora** do pool do planner |
| Lote 4 | deferred (Muscle up, Arranco, Arremesso, Puxada atrás da nuca) |
| Meta atual | **~250** exercícios na library (~159 planner) |
| Roadmap | **500** → **800** exercícios (fases futuras, sem inflar o planner) |
| Alimentos | seed interno ~280+ (incl. marcas/EAN), `source: "internal"` |
| Receitas | biblioteca ~40–50, macros **derived** dos `foodId` — aba Receitas no meal picker |
| Meal planner | continua em `MEAL_PRESETS` |

## Exercícios

Arquivos: `exercise-library.ts` (lote 1) + `exercise-library-lote2.ts` + `exercise-library-lote2b.ts` + `exercise-library-lote2c.ts` + `exercise-library-lote3.ts`. O helper `ex()` vive em `exercise-library-helpers.ts`.

GymGear aditivo: `cabos`, `kettlebell`, `cardio`. Cabos/cardio contam como academia; kettlebell como casa. Chips de onboarding/treino ganham as três opções — sem redesign.

`mediaId = id`, `mediaStatus = missing` nos rows novos. O manifesto itera `EXERCISE_LIBRARY` e cria packages **draft** sem assets. `media:validate` não exige published nesses IDs.

```
npm run catalog:coverage   # músculo / equipment / pattern / GymGear / dupes / mídia / taxonomy
npm run catalog:generate-seed   # só canonical-seed.json (não reescreve SQL da Fase 3)
npm run catalog:validate
```

## Alimentos

Sem TACO no repositório. Overlay TACO continua atrás de `catalog_settings.taco_license_verified`.

- `FoodItem.sourceVersion` (ex. `soldiers-internal-v1`) nos alimentos novos
- `food_items.ean` + `source_version` (migration `20261013120000_fase7_catalog_scale.sql`)
- unique parcial em `ean` WHERE NOT NULL
- EAN real **não** é inventado no seed — lote `foods-brands-ean.ts` usa GTINs curados (rótulo / OFF BR)
- **SoT de busca/barcode:** catálogo interno (+ TACO licenciado). **Open Food Facts = fallback de barcode apenas** (miss local → OFF BR, sem write em Postgres, sem indexar OFF na busca por nome)

`rebuild()` monta um inverted index (name, brand, synonyms, category, ean). `searchFoods` usa o índice para candidatos e depois o score estável (`FoodSearchHit`). Se o índice estiver vazio, cai no scan linear. `meal-builder` / `nutrients` / `scaleMacros` intocados.

```
npm run food:validate
```

## Receitas

Biblioteca em `src/data/recipes.ts`. Tags cobertas: `cafe`, `almoco`, `jantar`, `lanche`, `pre-treino`, `pos-treino`, `rapidas`, `alta-proteina`, `baixo-custo`, `sem-lactose`, `sem-carne`, `delivery`, `refeicao-fora`.

Zero alegações nutricionais. Sem mudança estrutural do meal planner.

## Fallback

- Food search linear se o índice estiver vazio
- Exercício sem mídia publicada → MuscleArt (Fase 6)
- TACO ausente no seed TS; só DB + flag
- Barcode: catálogo local → OFF BR (`br.openfoodfacts.org`) → world OFF

## TACO unlock (ops)

```
node scripts/taco-xlsx-to-json.mjs path/to/Taco-4a-Edicao.xlsx --out ~/Downloads/taco-foods.json
node scripts/import-taco.mjs ~/Downloads/taco-foods.json --out ~/Downloads/seed-taco-import.sql
# Apply SQL with service role, then reload public catalog
```

Não commitar xlsx/JSON/SQL gerados.

## Gates

```
npm test
npm run typecheck
npm run build
npm run lint
npm run catalog:validate
npm run food:validate
```
