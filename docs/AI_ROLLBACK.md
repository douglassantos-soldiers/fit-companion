# AI Rollback — deterministic_runtime

Como voltar ao path determinístico sem Decision Engine inventado / sem LLM.

**Kill switch completo (flags, aliases, produto core):** [AI_KILL_SWITCH.md](./AI_KILL_SWITCH.md) (FASE 22.11).

## Quando rollback

- Provider LLM falhou ou timeout em cascata
- Modelo com comportamento inesperado / safety risk
- Custo acima do limite
- Evaluation regression (`npm run test:eval` vermelho)
- Qualquer SEV-1/2 em [AI_INCIDENT_RESPONSE.md](./AI_INCIDENT_RESPONSE.md)

## Como (ordem preferida)

### 1. Kill-switch imediato

```bash
AI_FORCE_DETERMINISTIC=1
```

Efetivo via [`resolveEffectiveRuntimeMode`](../src/ai/runtime/rollback.ts) — `invokeAI` aborta provider.

### 2. Desligar LLM explicitamente

```bash
AI_LLM_ENABLED=0
# alias: LLM_ENABLED=0
AI_RUNTIME_MODE=deterministic
```

### 3. Desligar componentes

| Flag | Alias | Efeito |
|------|-------|--------|
| `AI_SPECIALISTS_ENABLED=0` | `SPECIALISTS_ENABLED` | specialists cancelados |
| `AI_RAG_ENABLED=0` | `RAG_ENABLED` | retrieval skipped |
| `AI_MEMORY_ENABLED=0` | `MEMORY_ENABLED` | memory vazio + writes skipped |
| `AI_LEARNING_ENABLED=0` | `LEARNING_ENABLED` | learning noop |
| `AI_ENABLED=0` | `AI_GLOBAL_ENABLED` | AI paths off |

## Verificação pós-rollback

1. Coach / specialists respondem sem provider
2. Audits mostram `runtime_mode=deterministic` / `deterministic_runtime=true`
3. Nenhuma Decision inventada por Agent/LLM
4. Identity / Context / Safety / Decision / Living Plan intactos
5. `npm run ai:kill-switch` e `npm run test:eval` / `npm run cert:ai` verdes no que for local

## Reabilitação (só após)

- Migrations `ai_*` aplicadas e verificadas
- Eval + golden verdes
- Safety / authz revalidados
- Orçamento e rate limits revisados

**Nunca** reabilitar `hybrid`/`llm` com `production_ready: false` no [AI_PRODUCTION_READINESS_REPORT.md](./AI_PRODUCTION_READINESS_REPORT.md) por causa de migrations pendentes ou falhas críticas.
