# Context Engine — Performance OS

Camada que transforma dados brutos em **contexto operacional** confiável e auditável.

SoT de assembly: `assembleDecisionContext` → `DecisionContextSnapshot`.  
SoT de contrato operacional: `PerformanceContext` via `toPerformanceContext` (sem recompute).

## Pipeline

```
RAW DATA (AppState / domain DB)
  → NORMALIZATION (Recovery, Customer360, check-ins)
  → DERIVED SIGNALS (scores, trends, reasonSeeds)
  → assembleDecisionContext (Context → Safety → Decision)
  → DecisionContextSnapshot
  → PerformanceContext (adapter + freeze)
  → getters parciais / Agents futuros (read-only)
```

O LLM **nunca** monta nem altera `PerformanceContext`. Só lê slices; Decision Engine decide.

## Categorias (não misturar)

| Categoria | Conteúdo | Exemplo |
|-----------|----------|---------|
| **OBSERVED** | Fatos de sensores/logs/check-in | `sleepHours`, `energy`, `mealsLoggedToday` |
| **DERIVED** | Scores e trends dos engines | `recoveryScore`, `adherenceScore`, `reasonSeeds` |
| **RECOMMENDATIONS** | Ranking / candidatos | `recommendations[]` |
| **DECISIONS** | Escolhas autoritativas | `decisions.trainingMode`, volume, nutrition opts |

Áreas de domínio (`training`, `nutrition`, `recovery`, `sleep`, `behavior`, `body`, `wearable`, `commerce`, `environment`, `social`) são **views** de observed+derived — não incluem decisões.

`constraints` vem de Safety (flags / stims / escalate) — não são decisões.

## Provenance

Sinais-chave em `signals.*` usam `ContextSignal<T>`:

```ts
{
  value: 5.8,
  source: "wearable" | "checkin" | "profile" | ...,
  observedAt: "2026-03-11T12:00:00.000Z" | null,
  confidence: 0.72
}
```

Sono: prioridade check-in → wearable → profile (via Recovery + `ContextSnapshot.sleep.source`).

## Metadados

| Campo | Papel |
|-------|--------|
| `contextVersion` | Espelha `snapshotVersion` |
| `generatedAt` | ISO de auditoria (fora do fingerprint) |
| `timezone` | Identidade + environment |
| `dataFreshness` | fresh/stale/unknown, wearableAvailable, C360 |
| `confidence` | Agregado 0..1 |
| `inputFingerprint` | Reprodutibilidade de decisão (não inclui `generatedAt`) |

## API

### Puro (`src/lib/engine/context-engine.ts`)

```ts
getPerformanceContextFromSnapshot(snapshot, state?)
getTrainingContext(pc)
getNutritionContext(pc)
getRecoveryContext(pc)
getBehaviorContext(pc)
toPerformanceContext(snapshot, state?) // frozen
```

### Server (`src/lib/engine/context-engine.server.ts`)

```ts
getPerformanceContext(userId, date?) // trusted userId only
getTrainingContextForUser(userId, date?)
getNutritionContextForUser(userId, date?)
getRecoveryContextForUser(userId, date?)
getBehaviorContextForUser(userId, date?)
```

`userId` deve vir de `resolveTrustedIdentity` / sessão — nunca do body do client.

Sem `profile` em AppState, `assembleDecisionContext` retorna `null` — o Context Engine **não inventa** um PerformanceContext paralelo.

## Imutabilidade

`toPerformanceContext` retorna objeto com `Object.freeze` nos níveis principais. Mutação lança em strict mode — Agents/Tools não podem “corrigir” o contexto.

Wearable vitals (`restingHr` / `hrv`) vêm do RecoverySnapshot via `context.recovery.wearable` quando disponíveis; `wearable.available` espelha `sourceSummary.wearable`.

## Relação com Decision Engine

Ver [decision-consolidation.md](./decision-consolidation.md), [DECISION_ENGINE.md](./DECISION_ENGINE.md) e [intelligence-convergence.md](./intelligence-convergence.md).

Ordem: **Context → Safety → Decision**. Nunca Decision → Safety. Living Plan materializa decisões; Coach explica.

## Arquivos

| Path | Papel |
|------|--------|
| `src/lib/engine/performance-context.ts` | Contrato + adapter |
| `src/lib/engine/context-engine.ts` | Getters parciais |
| `src/lib/engine/context-engine.server.ts` | `getPerformanceContext(userId)` |
| `src/lib/engine/assemble-decision-context.ts` | Assembly único |
| `src/lib/engine/context-snapshot.ts` | Snapshot interpretado do dia |
| `src/ai/contracts/performance-context.ts` | Reexports AI |

## Testes

`src/lib/engine/context-engine.test.ts` — novo usuário, sem profile (null), histórico, timezone, incompleto, conflito check-in/profile, wearable off, multi-device, freeze, parciais, fingerprint, áreas obrigatórias + recent_outcomes.
