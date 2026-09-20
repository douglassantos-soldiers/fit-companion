# PHASE 2 — Nutrition Intelligence

## Objetivo

Transformar a nutrição do Soldiers de presets agregados em um **Nutrition Intelligence Domain** nativo em `src/lib/nutrition/`, com catálogo alimentar, porções, macros expandidos, MealItem com snapshot, busca, voice/AI com confirmação e Customer360 enriquecido — sem redesign e sem coach/behavior.

Referências conceituais apenas: TACO, nutribr, API-Receitas. Nenhum código/dataset licenciado foi copiado. Catálogo inicial é autorado (Soldiers internal).

## Arquitetura

```
src/data/foods.ts + recipes.ts
        │
        ▼
src/lib/nutrition/*
  food-catalog · food-search · food-serving · nutrients
  meal-builder · meal-planner · recipes · nutrition-context · voice-parse
        │
        ├── engine/nutrition.ts (facades)
        ├── MealEntry + items[] (compat)
        ├── UI (nutricao / picker / edit)
        └── sync → meal_entries + meal_items + food_* (catalog)
```

**Meal = `meal_entries`** (não há tabela `meals` duplicada).  
**MealItem = `meal_items`** + `MealEntry.items` no payload (offline-first).

## Domínio

| Conceito | Campos-chave |
|----------|----------------|
| FoodItem | id, name, brand, category, source, servingReference, active, confidence |
| NutrientValue | key, value, unit, source, kind (`observed`\|`derived`\|`estimated`), confidence |
| FoodServing | label, gramsEquivalent → grams |
| MealItem | foodId, quantity, unit, grams, nutrientSnapshot |
| Recipe / RecipeItem | ingredientes, porções, macros, tempo, dificuldade |

Lineage `source`: `taco` \| `user` \| `imported` \| `ai_estimate` \| `internal`.  
AI estimate **nunca** é `observed`.

## Macros

Engine/UI: proteína, carboidrato, gordura, fibra (+ kcal).  
Micros (ferro, cálcio, …) extensíveis via `food_nutrients` / `extras` — sem tela dedicada nesta fase.

## Meal AI / Voice

Photo / Text / Voice → candidates → portion/nutrient estimate → **confirmação** → MealItem.  
Threshold: confidence &lt; 0.7 ou ambiguidade ⇒ `needsConfirmation`.  
Voice: parser determinístico PT-BR em `voice-parse.ts` + LLM; não inventa marca/quantidade omitida.

## Planner

`buildDailyMealPlan` considera goal, kcal/protein targets, preferences, restrictions, schedule (slots/windows), presets disponíveis e refeições logadas. Multi-day: arquitetura preparada, não implementado.

## Customer360

`aggregateNutrition` inclui: protein/kcal adherence, macro distribution, meal frequency, logging completeness, nutrition confidence.  
Dia sem log **não** zera aderência — reduz confidence (`partial_logging`).

## Migration

`supabase/migrations/20260925120000_fase2_nutrition_intelligence.sql`

- Catalog: `food_items`, `food_nutrients`, `food_servings`, `recipes`, `recipe_items` (SELECT authenticated; writes só service_role)
- User: `meal_items` (owner policies)
- `meal_entries.fiber_g`

Import preparado: `node scripts/import-taco.mjs foods.json --out seed.sql` (exige `licenseVerified: true`).

## Testes

`src/lib/nutrition/nutrition-intelligence.test.ts` — gramas, unidade, soma, receita, confidence, voice, AI, logging incompleto, macros.

## Fora de escopo desta fase

Coach multimodal, Behavior OS, multi-day planner, tela de micronutrientes, ingestão TACO sem licença, redesign visual.
