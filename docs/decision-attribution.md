# Decision Outcome Attribution

A Fase 2 liga **Decision → Action → Outcome → Learning** sem fan-out e sem ML.

## Vocabulário

| Conceito        | Onde vive                                 | Papel                                                                |
| --------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| Decision        | `recommendation_decisions`                | Escolha autoritativa do dia (`decision_id`)                          |
| Expected action | `decision_actions.expected_action`        | O que o sistema esperava (ex. `start_express_workout`)               |
| Action          | `decision_actions` UNIQUE `(decision_id)` | `pending \| started \| completed \| skipped \| rejected \| modified` |
| Outcome         | `decision_outcomes`                       | Observação em janela `d0 \| d1 \| d3 \| d7`                          |
| Learning signal | `decision_outcomes.learning_signal`       | String auditável; o agregado continua em `user_patterns`             |

`AppState` permanece cache/UI/offline. Writes usam `resolveTrustedIdentity` + RLS `service_role`.

## Regras (não causalidade automática)

O evento só pinta decisions cujo tipo está na regra. O mesmo `session_completed` **não** grava em `NUTRITION_TARGET` nem `SLEEP_PRIORITY`.

- `WORKOUT_MODE` / `DELOAD` ← sessão → **direct** `d0`
- `TRAINING_VOLUME` / `TRAINING_LOAD` ← performance da sessão → **direct** `d0`; energia D+1 se volume reduzido → **indirect** `d1`
- `MEAL_PRIORITY` ← `meal_logged` → **direct** `d0`
- `NUTRITION_TARGET` ← totais do dia observáveis → **indirect** `d0` (senão **weak**)
- `SLEEP_PRIORITY` ← check-in D+1 → **direct** `d1`
- `BEHAVIOR_INTERVENTION` ← sessão curta / resposta → **direct** `d0` (+ `behavior_outcomes` existente)
- `REST` ← rest no dia **direct** `d0`; D+1 **indirect**; D+3/D+7 **weak** (auditoria, sem pattern)

`unknown`: evento sem regra — **não insere** row. `weak`: insere para auditoria, **não** chama `applyOutcomeToPattern`.

Learning só se `attribution_type ∈ {direct, indirect}` **e** `confidence >= 0.6` **e** quality ≠ `unknown`. `express_training_high_adherence` mapeia para `prefers_short_sessions`.

## Idempotência

- Action: UNIQUE `decision_id`. Expected só muda se `status=pending`.
- Outcome: UNIQUE `(decision_id, outcome_type, outcome_window)`. Fan-out histórico foi backfill `unknown` + dedupe.

## Janelas D+n

Sweep oportunista em `getOrBuildDecisionContext` (timezone do perfil). Sem `pg_cron`.

## Compatibility

`markDecisionOutcomeFn` continua `{ ok }`. Internamente deixou de fan-out. CTA `living_plan_followed` vira **action_started**; completed só em sessão/refeição/check-in reais.

Auditoria: `explainDecisionAttribution(decisionId)` responde por que, expected, actual, outcome, quando, se é direto, e qual signal alimentou learning.
