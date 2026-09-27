# AI Production Runbook

Operação da stack AI do Fit Companion / Performance OS (FASE 21).

## Defaults de produção

| Setting | Valor seguro |
|---------|----------------|
| `AI_RUNTIME_MODE` | `deterministic` |
| `AI_LLM_ENABLED` | unset = segue `AI_RUNTIME_MODE`; `0` força off; `1` permite llm/hybrid |
| `AI_FORCE_DETERMINISTIC` | unset (use `1` em incidente) |
| `AI_ENABLED` | `1` |
| `AI_RAG_ENABLED` | `1` |
| `AI_SPECIALISTS_ENABLED` | `1` |
| `AI_MEMORY_ENABLED` | `1` |
| `AI_LEARNING_ENABLED` | `1` |

## Feature flags (kill-switches)

Definidos em [`src/ai/runtime/feature-flags.ts`](../src/ai/runtime/feature-flags.ts):

- `AI_ENABLED=0` — short-circuit gateway / AI paths
- `AI_LLM_ENABLED=0` — força path determinístico (mesmo se mode=llm/hybrid)
- `AI_LLM_ENABLED` unset — LLM só se `AI_RUNTIME_MODE` for `hybrid` ou `llm`
- `AI_FORCE_DETERMINISTIC=1` — rollback imediato (ver [AI_ROLLBACK.md](./AI_ROLLBACK.md))
- `AI_RAG_ENABLED=0` — retrieval skipped (sem citations inventadas)
- `AI_MEMORY_ENABLED=0` — memory retrieve vazio
- `AI_SPECIALISTS_ENABLED=0` — specialist runs cancelados
- `AI_LEARNING_ENABLED=0` — `runLearningCycle` → noop

## Rate limits

- Coach: `COACH_RPM` / `COACH_RPD` ([`coach.functions.ts`](../src/lib/coach.functions.ts))
- Gateway AI: `AI_RL_USER_RPM`, `AI_RL_AGENT_RPM`, `AI_RL_PROVIDER_RPM`, `AI_RL_MODEL_RPM`, `AI_RL_TOOL_RPM`, `AI_RL_RUN_PER_INVOKE`  
  **In-process only** — não é distribuído entre instâncias.

## Cost controls

- Orchestrator: `DEFAULT_MAX_COST` / `DEFAULT_MAX_STEPS` / timeout
- Gateway: `max_tokens`, `max_cost`, `timeout_ms` por agent config
- Custo LLM = **proxy estimado** (não billing real)

## Observabilidade

- Console: `/governance/*` (admin/analyst)
- Audit dual-write: ring memory + `ai_audit_events`
- CRITICAL audits: await + 1 retry ([`persistCriticalAiAudit`](../src/ai/governance/persist.server.ts))
- Eval: `npm run test:eval`

## Migrations

**Não assumir** que arquivo em `supabase/migrations/` = aplicado no remoto.

```bash
npm run cert:ai
# ou probe dedicado via verifyAiMigrations()
```

Tabelas canônicas: `ai_audit_events`, `ai_*_memory`, `ai_knowledge_*`.

## Certificação

```bash
npm run cert:ai
```

Relatório: [AI_PRODUCTION_READINESS_REPORT.md](./AI_PRODUCTION_READINESS_REPORT.md)  
`production_ready` permanece **false** enquanto migrations remotas estiverem `pending`/`missing` ou houver falha crítica.
