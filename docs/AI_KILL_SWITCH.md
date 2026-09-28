# AI Kill Switch & Rollback (FASE 22.11)

Garantir que qualquer componente de IA possa ser desligado **sem derrubar** Identity, Context, Safety, Decision Engine ou Living Plan.

Flags são **server-authoritative** (`process.env` apenas). Nunca confiar em flags enviadas pelo client. `runtimeMode` do client é clampado por [`resolveEffectiveRuntimeMode`](../src/ai/runtime/rollback.ts).

## Flags (canônico + alias)

| Código | Canônico | Alias | Default | Fallback |
|--------|----------|-------|---------|----------|
| Global | `AI_ENABLED` | `AI_GLOBAL_ENABLED` | on | deterministic; helpers RAG/Memory/Learning/Specialists false |
| LLM | `AI_LLM_ENABLED` | `LLM_ENABLED` | derivado do mode | specialists/gateway deterministic (sem provider) |
| RAG | `AI_RAG_ENABLED` | `RAG_ENABLED` | on | retrieval skipped; **sem** claims RAG |
| Specialists | `AI_SPECIALISTS_ENABLED` | `SPECIALISTS_ENABLED` | on | runs cancelados; runtime canônico degradado |
| Memory | `AI_MEMORY_ENABLED` | `MEMORY_ENABLED` | on | retrieve vazio; create/update/invalidate **skipped** |
| Learning | `AI_LEARNING_ENABLED` | `LEARNING_ENABLED` | on | learning noop; Decision/LP intactos |
| Force | `AI_FORCE_DETERMINISTIC` | — | off | mode efetivo = deterministic |

Fonte: [`src/ai/runtime/feature-flags.ts`](../src/ai/runtime/feature-flags.ts).

## Procedimento de rollback (ordem)

Ver também [`AI_ROLLBACK.md`](./AI_ROLLBACK.md) e `ROLLBACK_PROCEDURE` em [`rollback.ts`](../src/ai/runtime/rollback.ts).

1. **Imediato:** `AI_FORCE_DETERMINISTIC=1`
2. **LLM off:** `AI_LLM_ENABLED=0` + `AI_RUNTIME_MODE=deterministic`
3. **Componentes:** `AI_SPECIALISTS_ENABLED=0`, `AI_RAG_ENABLED=0`, `AI_MEMORY_ENABLED=0`, `AI_LEARNING_ENABLED=0`
4. **Global:** `AI_GLOBAL_ENABLED=0` (ou `AI_ENABLED=0`)

## O que NÃO desliga

- Identity / sessão
- Context (`assembleDecisionContext`)
- Safety (`evaluateSafetyForDate`)
- Decision Engine
- Living Plan (snapshot / engine)

## Verificação

```bash
npm run ai:kill-switch
```

Artifact: `docs/certification/kill-switch-readiness.json`  
**PASS** se aliases, force, isolamento do engine e docs OK (sem secrets). **FAIL** se fallback quebrado.

## Reabilitação

Só após: migrations AI OK, eval/cert verdes, safety/authz revalidados, orçamento/RL revisados.  
**Nunca** reabilitar `hybrid`/`llm` com `production_ready: false`.

## Ver também

- [AI_ROLLBACK.md](./AI_ROLLBACK.md)
- [AI_PRODUCTION_RUNBOOK.md](./AI_PRODUCTION_RUNBOOK.md)
- [AI_CI_CD_GATES.md](./AI_CI_CD_GATES.md)
- [AI_INCIDENT_RESPONSE.md](./AI_INCIDENT_RESPONSE.md)
