# Recovery Intelligence

A Fase 4 consolida recuperação muscular, Recovery v2 e o semáforo de Today numa **única resposta do dia**.

Recovery **não é diagnóstico médico**. Score, readiness e Safety escalation são camadas distintas.

## Pipeline

```
Training load + muscle load + RPE + sleep + energy + soreness + stress + wearable
        ↓
computeRecoverySnapshot(state, date)
        ↓
readiness (high | moderate | low | unknown)
        ↓
Safety (consome, não substitui pain/escalate)
        ↓
Decision → Living Plan → Today / Treino / Coach
```

`assembleDecisionContext` calcula o snapshot **uma vez** e passa para context, safety, plano semanal e fingerprint.

## Autoridade

| Camada                            | Papel                                                               |
| --------------------------------- | ------------------------------------------------------------------- |
| `src/lib/training/muscle-load.ts` | Carga de treino (input)                                             |
| `src/lib/engine/recovery/`        | Domínio autoritativo                                                |
| `recovery.ts` / `recovery-v2.ts`  | Shims de compatibilidade                                            |
| Safety                            | Pain, notes, escalate; `under_recovery` só se `readiness === "low"` |
| Decision                          | Deload se readiness low — **não** se unknown                        |
| Living Plan `traffic.recovery`    | Projeção do snapshot (não `dimensions.recuperacao`)                 |
| AppState                          | Cache / UI / offline — nunca autoridade                             |

## Ausência de dados

| Estado                                                     | readiness           | Efeito                           |
| ---------------------------------------------------------- | ------------------- | -------------------------------- |
| Sem check-in, sem sessões, sem wearable                    | `unknown`           | não deload, não `under_recovery` |
| Sono &lt; 6 no check-in do dia, soreness ≥4, RPE streak ≥2 | `low`               | preferLight / deload             |
| Check-in saudável                                          | `high` / `moderate` | plano normal                     |

`typicalSleepHours` **não** é o sono do dia. Prior fraco (`source: profile`) não dispara `sleep_low`.

## Wearable

HRV/RHR podem contribuir para score e `wearableConfidence`. **Nunca** ultrapassam Safety: `escalateCare` / pain / notes continuam a mandar rest. Passos de atividade não são recovery.

## Confianças

- `sleepConfidence` — check-in do dia vs profile vs wearable
- `checkInConfidence` — energy / soreness / stress presentes
- `wearableConfidence` — 0 enquanto HRV/RHR forem null

## Compatibility

- `computeRecoveryV2` = adapter (`high` → `recovered`, `unknown` permanece `unknown`)
- Muscle heatmap / `freshnessForGroups` recebem o mesmo `RecoveryContext` do snapshot
- C360 `aggregateRecovery(state, streak, date)` usa o `date` do assemble

## Observabilidade

Fingerprint inclui `recoveryReadiness` + `recoveryConfidence`. `sourceSummary` e `explanation` seguem no `context.recovery` persistido no snapshot do dia.
