# PHASE 4 — Behavior Engine

## Objetivo

Evoluir o Learning Engine rule-based em um **Behavior Engine** nativo em `src/lib/engine/behavior/`, com patterns persistentes, triggers (≥2 evidências), micro-intervenções, experimentos, outcomes e personalização por evidência — sem diagnósticos psicológicos e sem Behavior OS clínico.

## Regra fundamental

```
EVENT → PATTERN → TRIGGER → INTERVENTION → OUTCOME → LEARNING
```

- Trigger **nunca** com 1 ocorrência (`supportCount >= 2` e `confidence >= 0.55`)
- Intervenções são micro (reminder, express, meal_swap…) — não clínica
- LLM/Coach só explica; engines calculam

## Arquitetura

```
src/lib/engine/behavior/
  types · profile · patterns · triggers · interventions
  experiments · relapse · adherence · persist.server · index
        │
learning.ts          # facade: runBehaviorLoop + applyBehaviorOutcome
user-patterns.ts     # legacy UserPatterns (sem ciclo com behavior/)
habit-lessons.ts     # lessonForToday(date?, behaviorCtx?)
daily-quests.ts      # pickDailyQuests adaptativo
recommendation.ts    # kind "behavior"
coach/tools.ts       # get_active_triggers / interventions / experiment_status
customer360          # Behavior360 enriquecido
```

## Domínio

| Peça | Função |
|------|--------|
| BehaviorProfile | scores 0–1 (consistency, meal/training/sleep, weekend, timeConstraint) + interventionResponse |
| BehaviorPattern | key, evidence, confidence, supportCount, status |
| BehaviorTrigger | só `active` com ≥2 evidências |
| BehaviorIntervention | catálogo trigger→ação; ranking por histórico |
| BehaviorExperiment | micro (ex. proteína no café 7d) |
| RecoveryFromLapse | evita “perdeu tudo” |

## Persistência

Migration `20260927120000_fase4_behavior_engine.sql`:

- `behavior_patterns` / `behavior_interventions` / `behavior_outcomes` / `behavior_experiments`
- RLS: SELECT owner via `users.auth_user_id`; writes via `service_role` (`persist.server.ts`)

## UI / Coach

- Today: recommendation `kind: "behavior"` (ex. Express na sexta)
- Lessons/quests: bias por trigger ativo; fallback determinístico por data
- Coach tools: patterns + triggers + interventions + experiments; prompt reforça “não diagnosticar psicologia”

## Outcomes

`outcome-learning.ts` → `applyBehaviorOutcomeFromEvaluations` + `recordBehaviorOutcomeBestEffort`  
`outcome.ts` → `trackBehaviorInterventionOutcome`

## Fora de escopo

Diagnóstico clínico, push notifications reais, A/B multi-arm, redesign UI, Behavior OS multimodal.
