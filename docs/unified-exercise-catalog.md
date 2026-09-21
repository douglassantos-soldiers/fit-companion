# Unified Exercise Catalog

A Fase 3 unifica o catálogo de exercícios num **domínio canônico**. Seed Soldiers (lote 1) + overlay `catalog_exercises` passam pelo mesmo resolver. Planner, PRs, mídia, coach e admin leem adapters — não reinventam o exercício.

Não se importa catálogo de terceiros (wger / openGym / GymMane). O schema aguenta ~800 rows; esta fase **não** popula 800.

## Autoridade

```
Seed TS (offline / first paint)
  + overlay DB (CMS, service_role)
  → resolveExerciseCatalog
  → CanonicalExercise[]
  → adapters: EXERCISES / libraryById / catalogById / media / admin
```

| Camada                                         | Papel                                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/data/exercise-library.ts`                 | Seed autoral lote 1. Facade de `CanonicalExercise`. IDs slug PT **não mudam**.      |
| `content/exercise-catalog/canonical-seed.json` | Cópia gerada do lote 1. `catalog:validate` falha se divergir do TS.                 |
| `catalog_exercises`                            | Overlay + seed SQL `ON CONFLICT DO NOTHING`. Overlay existente no remoto **vence**. |
| `resolveExerciseCatalog` / `mergeExercises`    | Única merge. Overlay vence nome/flags; seed preenche o resto.                       |
| `src/data/exercises.ts`                        | Projeção planner (`active && plannerEligible`).                                     |
| `exercise-catalog.ts`                          | View sobre o resolved (não heurística solta de músculo/pattern).                    |
| `AppState`                                     | Não é catálogo.                                                                     |

Sessões, prefs e PRs já guardam `exerciseId` string. Sem FK, sem rename de IDs.

## CanonicalExercise

Contrato em `src/lib/training/canonical-exercise.ts`:

- Identidade: `id`, `canonicalName`, `displayNamePt` (`name` = alias), `displayNameEn?`, `version`
- Taxonomia: `group`, músculos, `movementPattern`, `equipment`, `equipmentInventory?`
- Execução: `joints`, `difficulty`, `unit`, `swapGroup`, `baseLoad`, `priority`, `plannerEligible`, `active`
- Coaching: `instructions[]`, `cues[]`
- Grafo: `alternativeIds`, `aliases`, `searchTerms`, families
- Segurança/mídia: `contraindicationTags` (metadata, **não** diagnóstico), `mediaId` (default = `id`), `mediaStatus`, `animationSpec`

`LibraryExercise` é o mesmo tipo. `Exercise` do planner continua uma projeção.

## Aliases de `movementPattern`

Canônico: `press | pull | squat | hinge | lunge | carry | rotation | anti_rotation | raise | curl | extension | cardio | isometric | mobility`

Leitura (lote 1, sem reescrever 100 rows):

| Seed legado | Canônico    |
| ----------- | ----------- |
| `fly`       | `raise`     |
| `carry_iso` | `isometric` |
| `other`     | `mobility`  |

O resolver **grava** o canônico. Validação aceita o alias na transição. `supino-*` permanece `press`.

## O que não se importa

- Sem dump wger / openGym / GymMane
- Sem GIFs, stills ou instruções de terceiros
- `catalog:coverage` continua a ser diff de nomes, não um import
- Families / contraindication tags no lote 1 ficam vazias (preparação de schema)

## Persistência

Migration `20261010120000_fase3_unified_exercise_catalog.sql`:

- `ALTER` colunas novas (nullable / defaults)
- GIN em `aliases` e `search_terms`
- `INSERT` dos 100 IDs do JSON com `ON CONFLICT (id) DO NOTHING`

RLS inalterado: `service_role` only. `updated_by` admin. Sem `userId` de client.

## Fallback

DB vazia ou offline → seed TS. Depois do SQL seed, o overlay replica o lote 1 até o CMS editar.

## Gates

```
npm run catalog:validate
npm test
```

`catalog:validate` falha em IDs duplicados, alternative órfão, pattern/group/equipment inválidos, ou drift JSON ↔ TS.
