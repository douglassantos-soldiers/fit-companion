# Learning Intelligence

A Fase 5 consolida Learning Engine e Behavior Engine numa **camada superior de aprendizado** em `src/lib/engine/learning/`.

Learning **não é diagnóstico psicológico**. Não inventa personalidade nem traços clínicos.

## Pipeline

```
EVENTOS PERSISTIDOS (sessões, refeições, check-ins, outcomes)
        ↓
Evidence
        ↓
Pattern (learned + behavior)
        ↓
Trigger → Intervention → Action → Outcome → InterventionResponse
        ↓
computeLearningSnapshot(state, date, prior)
        ↓
Decision input + Behavior domain
```

`assembleDecisionContext` calcula o snapshot **uma vez**. Behavior Engine continua o domínio de micro-intervenções, agora como **aplicação** do Learning.

## Autoridade

| Camada                     | Papel                                                       |
| -------------------------- | ----------------------------------------------------------- |
| `user_patterns` blob v2/v3 | Padrões de decisão + cache de InterventionResponse          |
| `behavior_*`               | Persistência de patterns/intervenções/outcomes/experimentos |
| `decision_outcomes`        | Attribution gate (confidence ≥ 0.6)                         |
| `src/lib/engine/learning/` | Contrato canônico                                           |
| `src/lib/engine/behavior/` | Triggers, catálogo, relapse, experiments                    |
| Safety                     | Continua acima de qualquer bias de volume                   |
| AppState                   | Cache / UI / offline                                        |

## Regras

- Trigger **nunca** com 1 ocorrência (`support >= 2` e `confidence >= 0.55`).
- Pattern learned só vira `active` com `evidenceCount >= minObservations` e `confidence >= 0.55`.
- Persist de blob **faz merge** com outcomes anteriores (não clobber).
- `typicalSleepHours` não é sono do dia.
- Allowlist clínica (`learning-guardrails.ts`) inalterada.

## InterventionResponse

```
successCount / failureCount / neutralCount
confidence = (success + 0.5) / (n + 1)
```

Intervenções são ranqueadas por esse histórico. Sem dados → 0.5.

## Experiments

- Proteína no café por 7 dias
- Express 3× na semana

Não se cria experimento novo se já existe um `active` persistido. Ao fim do intervalo, `result` é medido nos meals/sessions e o experimento completa.

## Compatibility

- `computeLearningInsights` / `runBehaviorLoop` / `extractLearnedPatterns` / blob v2 continuam.
- `learning.ts` é shim de `src/lib/engine/learning/`.
