# Decision Consolidation (FASE 2)

Mapa arquitetural: o Decision Engine é o único ponto confiável de decisão do Performance OS.

## Pipeline alvo

```
DOMAIN DATA
→ CUSTOMER 360
→ CONTEXT (observed + derived)
→ SAFETY
→ DECISION (authoritative)
→ LIVING PLAN
→ ACTION
→ OUTCOME
→ LEARNING (signals only → next Context)
```

Ordem obrigatória: **Context → Safety → Decision**. Nunca Decision → Safety.

## Engines

| Engine | Produz | Consome Decision? | Mutar Living Plan? |
|--------|--------|-------------------|--------------------|
| Training (`plan.ts`, resolve-plan-days) | Candidates / planned day | Não — só candidatos | Não |
| Nutrition | Targets, meal candidates, adherence | Não | Não |
| Recovery | Readiness, sleep, fatigue signals | Não | Não |
| Behavior | Triggers / interventions | Via Decision | Não |
| Safety | Verdict + flags | Antes do Decision | Pode forçar rest/deload via Decision |
| Customer360 | Aggregates + `data_version` | Fingerprint | Não |
| Learning | Patterns / priors | Signals no Context | **Nunca** |
| Decision | `DecisionBundle` / contrato `Decision` | — | Via materialize |
| Living Plan | Plano do dia | Consequência | — |
| Coach | Explicação | Lê snapshot | Não |

Entrypoint único de produto: `assembleDecisionContext` → persistido por `getOrBuildDecisionContext`.

## Contratos

- `PerformanceContext` — `src/lib/engine/performance-context.ts` (`observed` / `derived` / `recommendations` / `decisions`; provenance via `signals`; ver [CONTEXT_ENGINE.md](./CONTEXT_ENGINE.md))
- API: `getPerformanceContext(userId)` / getters parciais em `context-engine.ts` (+ `.server.ts`)
- `Decision` — `src/lib/engine/decision-contract.ts` (id, context_id, versions, why/what/expected_outcome, reason_codes, evidence, safety, expires); ver [DECISION_ENGINE.md](./DECISION_ENGINE.md)
- `DecisionProposal` — `src/lib/engine/decision-proposal.ts` (Agents/Coach propõem; engine decide)
- Envelope UI/cache: `DecisionContextSnapshot` (`source: "server" | "offline_legacy"`)

## Duplicações removidas / a evitar

| Local | Antes | Depois |
|-------|-------|--------|
| Today `index.tsx` | `resolveTrainingPlanDays` + mode paralelo | Preferir `livingPlan` + `selectTrainingMode` / `selectPrimaryAction` |
| Today nutrição | Recalcular goals sem opts | `selectNutritionOpts` |
| `store.withSnapshot` | Reassemble sobre server | Nunca sobrescrever `source: "server"` |
| `getOrBuild` | Sempre persist/log | Early-return por fingerprint → só stamp/sweep |
| Treino | `buildWeeklyPlanDetailed` decide mode do dia | Mode do dia = snapshot; semana = display/candidates |
| Coach | Remonta weekly/meals sem Decision | Snapshot + `selectNutritionOpts` |

## Explainability

Reason codes SoT = snake_case (`sleep_low`). Aliases SCREAMING (`LOW_SLEEP`) em `REASON_CODE_ALIASES`.
UI “Why?” via `selectWhyPanel(snapshot)` — não inventar regras na tela.

## Learning

`decision → action → outcome → learning`. Learning só gera sinais para Context futuro.
Ver `docs/decision-attribution.md`.

## Riscos residuais

- Offline `offline_legacy` ainda reassembra no client quando não há server snapshot.
- Meal planner local até o hydrate do snapshot.
- Progressão de carga na sessão consome hint do Decision; não redecide mode.
