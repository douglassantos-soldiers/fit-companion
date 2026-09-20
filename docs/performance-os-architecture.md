# Performance OS Architecture

Pipeline único de decisão do Soldiers Fit Companion (Phase 5 Integration).

## Fluxo

```
DOMAIN DATA (DB)
  → CUSTOMER 360 (aggregation)
  → CONTEXT (interpretation)
  → SAFETY
  → TRAINING / NUTRITION / BEHAVIOR signals
  → RECOMMENDATION (ranking)
  → DECISION (authoritative choice + log)
  → LIVING PLAN (execution plan)
  → TODAY / COACH (presentation / explanation)
  → ACTION
  → OUTCOME (decision_outcomes)
  → LEARNING (patterns + interventionResponse)
  → NEXT DECISION
```

**AppState** = cache / UI / offline. Não substitui domain truth quando existir linha no DB.

## Camadas

| Camada | Papel | Paths principais |
|--------|--------|------------------|
| Identity | Sessão confiável, device ≠ user | `session-identity.server`, access session |
| Domain | Tabelas de domínio (meals, sessions, check-ins) | sync / hydrate |
| Customer360 | Agregação | `src/lib/customer360/` |
| Context | Snapshot interpretado + reason seeds | `context-snapshot.ts` |
| Training | Progressive overload, muscle load, plateau | `src/lib/training/`, plan engine |
| Nutrition | Macros, meals, adherence | `src/lib/nutrition/` |
| Behavior | Patterns → triggers → interventions | `src/lib/engine/behavior/` |
| Recommendation | Ranking WHAT next | `recommendation.ts` |
| Decision | Escolha autoritativa | `decision.ts`, tipos canônicos em `performance-decision-types.ts` |
| Living Plan | Plano executável do dia + HOW/confidence | `living-plan.ts` |
| Coach | Explica log; não reinventa sem declarar alternativa | `src/lib/coach/` |
| Outcome | `decision_outcomes` (+ legado em decision row) | `decision-log.server.ts` |
| Learning | Decision + Action + Outcome → patterns | `outcome-learning.ts`, `learned-patterns.ts` |

## Decision log

Tabela `recommendation_decisions`:

- `decision_type` canônico (SCREAMING) em writes novos; snake legado ainda lido
- `decision_value` (= API `value`), `input_snapshot` (= `context_snapshot`)
- `evidence` JSONB estruturado (`metrics` + `notes`)
- Upsert por `(user_id, date, engine, decision_type)` — preserva ids/FKs

Tipos canônicos: `WORKOUT_MODE`, `TRAINING_VOLUME`, `TRAINING_LOAD`, `MEAL_PRIORITY`, `NUTRITION_TARGET`, `SLEEP_PRIORITY`, `BEHAVIOR_INTERVENTION`, `PLATEAU_RESPONSE`, `PROGRESSION`, `REST`, `DELOAD`, …

## Outcome log

Tabela `decision_outcomes` = SoT. Dual-write em mark + D+1 check-in.  
Campos legado `outcome` / `outcome_metrics` na decision row = deprecated.

## Reason codes

SoT em snake_case (`reason-codes.ts`). Aliases SCREAMING em `REASON_CODE_ALIASES` (docs/Coach).  
Novos Phase 5: `nutrition_adherence_low`, `weekend_adherence_pattern`, `express_high_adherence`.

## Today

WHAT (ação) · WHY (overlay) · HOW (`plan.how`) · CONFIDENCE (`plan.confidenceLabel`).

## Coach

Prefere decisões do **decision log** do dia; fallback `recomputed_live` marcado.  
Outcomes entram no contexto. Proposta ≠ log → declarar “proposta alternativa”.

## Learning loop

`session_completed` → short-session eval → `user_patterns` + behavior outcome bridge.  
`express_high_adherence` enviesa próxima decisão quando `availableMin` baixo.

## QA

`src/lib/qa/scenarios.ts` — `ENABLE_QA_MODE` / test only. Cenários: healthy, low_sleep, high_rpe, short_time, no_equipment, plateau, low/good adherence, weekend_pattern, …

## Observability

`logEngineDecision` / `logEngineError` / `logSyncOp` — JSON estruturado, sem secrets. Inclui `duration_ms`.

## Security (checklist)

- Ownership via `users.auth_user_id` + RLS; writes sensíveis `service_role`
- Coach tools: `trustedUserId` da sessão; rejeita `args.userId` forjado
- Sem override Client de Customer360 como autoridade
- Secrets de sessão fail-closed em produção (Phase 8.5)
- System prompt: sem diagnóstico médico/psicológico

## Integridade

Timezone do usuário (`America/Sao_Paulo` default); datas `YYYY-MM-DD`; upsert idempotente de decisions; dedupe leve de outcomes por dia.
