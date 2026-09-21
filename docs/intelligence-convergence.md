# Intelligence Convergence

A Fase 1 consolida o Server Decision Context como **único ponto de assembly** da inteligência do dia.

## Pipeline

```
Trusted Identity
→ Domain Data
→ Customer360 (recompute se stale)
→ assembleDecisionContext (puro)
→ Safety → Decision → Living Plan → Recommendations
→ persist decision_context_snapshots + dual-write recommendation_decisions
→ AppState cache
→ Today / Training / Nutrition / Coach
```

Engines determinísticos **calculam**. O Decision Engine **escolhe**. Coach/LLM **explica**. A UI **não recalcula** uma decisão já produzida no servidor.

## Autoridade vs cache

| Camada                                                    | Papel                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| Domain tables (`profiles`, `sessions`, `day_checkins`, …) | Fonte de dados                                              |
| `customer_profiles`                                       | Customer360 derivado (`data_version`, `last_recomputed_at`) |
| `assembleDecisionContext`                                 | Único caller de `computeDecisions` nos caminhos de produto  |
| `decision_context_snapshots`                              | Envelope do dia para hidratação (UNIQUE `user_id, date`)    |
| `recommendation_decisions`                                | Ledger por `decision_type` + outcomes/learning              |
| `AppState.decisionContextByDate` / `livingPlans`          | Cache, UI, offline, drafts                                  |

`AppState` **não** é autoridade de negócio quando o snapshot server existe.

## DecisionContextSnapshot

Contrato client-safe em `src/lib/engine/decision-context-snapshot.ts`:

- `userId`, `date`, `timezone`
- `customer360Version`, `stale360`
- `engineVersion` (`decision_v1`), `snapshotVersion`, `inputFingerprint`
- `source`: `"server"` | `"offline_legacy"`
- `safety`, `context`, `decisions`, `recommendations`, `livingPlan`

Versão: `snapshot_version` incrementa só quando `input_fingerprint` muda. Fingerprint cobre sono, energia, tempo, equipamento, recovery, nutrição, triggers de behavior, timezone, C360 version e planned minutes.

## Invalidação

1. Check-in / inputs do dia mudam → o cache server daquele `date` é removido no client, o assembler puro atualiza o plano localmente (`offline_legacy` explícito) e `getDecisionContextFn` grava a versão autoritativa.
2. Customer360 stale (>6h) → recompute, novo `data_version`, fingerprint muda, nova versão do snapshot.
3. Sessão **já iniciada** não troca Express/Full no meio do treino (lock no primeiro paint).
4. Today pede refresh no máximo uma vez por `date` até existir snapshot `server` — `livingPlans` reescrito não reentra em loop.

## Compatibility

- `buildLivingPlan` / `buildLivingPlanWithDecisions` delegam para `assembleDecisionContext`.
- `buildServerDecisionContext` orquestra `getOrBuildDecisionContext`.
- `logDecisionsFn` **ignora** decisões enviadas pelo client e reassembra no servidor (`resolveTrustedIdentity`).
- Sem snapshot: UI usa `source: "offline_legacy"` de forma explícita — nunca por cima de um snapshot `server`.

## Segurança

- `userId` vem só de `resolveTrustedIdentity` (cookie + device). Nunca do body.
- Tabela com RLS ON, REVOKE `anon`/`authenticated`, GRANT `service_role`.
- Payload sem AppState completo, tokens OAuth ou secrets.

## Observabilidade

`logEngineDecision` / `logEngineError` em persistência e load do snapshot (`engine=decision_v1`, `decisionType=snapshot`).
