# PHASE 1 — Deep Training Engine

## Objetivo

Evoluir o motor de treino do Soldiers para um **Training Intelligence Domain** nativo em `src/lib/training/`, com histórico, progressão estruturada, 1RM, PRs, carga muscular, preferências e sets mais ricos — sem redesign visual e sem nutrition/coach/behavior.

Referências conceituais apenas: openGym, wger, GymMane. Nenhum código/asset/dados licenciados foram copiados.

## Arquitetura

```
sessions.exercises (JSONB SoT)
        │
        ▼
src/lib/training/*
  catalog · sets · session · one-rm · prs · plateau
  muscle-load · progression · plan · preferences · performance
        │
        ├── engine/* (facades: plan, progression, recovery)
        ├── UI (treino / sessão / progresso)
        └── recompute.server → tabelas derivadas
```

**Prescription ≠ Execution**

| Prescrição | Execução |
|------------|----------|
| `PlannedExercise` + `SetPrescription` | `ExerciseExecution` + `SetExecution` / `SetLog` enriquecido |

## 1RM (Epley)

```
estimated1RM(weight, reps) = weight * (1 + reps/30)
```

- Determinístico; sem LLM
- Evidência: `{ formula: "epley", weight, reps, at, value }`
- Arquivo: `src/lib/training/one-rm.ts`

## Sets ricos (compatível)

`SetLog` mantém `reps`, `weightKg`, `done` e aceita campos opcionais (`type`, `rpe`, `target*`, `actual*`, …). Sessões antigas continuam válidas.

## Preferências

Valores: `preferred | neutral | disliked | avoided`  
Legacy `likedExerciseIds` / `dislikedExerciseIds` migrados e sincronizados via `app_state.retention`.

## Tabelas derivadas (migration)

`20260924120000_fase1_deep_training_engine.sql`

- `exercise_performance`
- `personal_records`
- `exercise_preferences`
- `muscle_load_snapshots`

Populadas por `recomputeTrainingDerived(userId)` após push de sessions. Client não é fonte de verdade de performance.

RLS: service_role + owner policies (`users.auth_user_id = auth.uid()`).

## Facades

- `src/lib/engine/plan.ts` → `training/plan`
- `src/lib/engine/progression.ts` → `training/progression`
- `src/lib/engine/recovery.ts` → snapshots + `muscleRecoveryMap` compat

## Reason codes novos

`progression_ready`, `low_muscle_fatigue`, `excessive_muscle_load`, `undertrained_muscle`, `pr_opportunity` (+ `plateau_detected`)

## Testes

`src/lib/training/deep-training.test.ts` — 10 cenários (1ª sessão → exercício evitado) + 1RM/load/prefs.

## Fora de escopo desta fase

Nutrition, Coach multimodal, Behavior OS, GPS/wearables, CMS editorial.
