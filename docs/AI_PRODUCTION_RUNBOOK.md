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

Definidos em [`src/ai/runtime/feature-flags.ts`](../src/ai/runtime/feature-flags.ts). Doc: [AI_KILL_SWITCH.md](./AI_KILL_SWITCH.md).

- `AI_ENABLED=0` / `AI_GLOBAL_ENABLED=0` — short-circuit gateway / AI paths
- `AI_LLM_ENABLED=0` / `LLM_ENABLED=0` — força path determinístico (mesmo se mode=llm/hybrid)
- `AI_LLM_ENABLED` unset — LLM só se `AI_RUNTIME_MODE` for `hybrid` ou `llm`
- `AI_FORCE_DETERMINISTIC=1` — rollback imediato (ver [AI_ROLLBACK.md](./AI_ROLLBACK.md))
- `AI_RL_DISABLED=1` — desliga enforcement de rate/cost (ops; ver [AI_RATE_LIMITING.md](./AI_RATE_LIMITING.md))
- `AI_RAG_ENABLED=0` / `RAG_ENABLED=0` — retrieval skipped (sem citations inventadas)
- `AI_MEMORY_ENABLED=0` / `MEMORY_ENABLED=0` — memory retrieve/write skipped
- `AI_SPECIALISTS_ENABLED=0` / `SPECIALISTS_ENABLED=0` — specialist runs cancelados
- `AI_LEARNING_ENABLED=0` / `LEARNING_ENABLED=0` — `runLearningCycle` → noop

```bash
npm run ai:kill-switch
```

## Rate limits

- **FASE 22.10 — distribuído** via Supabase (`ai_rate_limit_buckets`). Doc: [AI_RATE_LIMITING.md](./AI_RATE_LIMITING.md)
- Env: `AI_RL_USER_RPM`, `AI_RL_IP_RPM`, `AI_RL_SESSION_RPM`, `AI_RL_AGENT_RPM`, `AI_RL_PROVIDER_RPM`, `AI_RL_MODEL_RPM`, `AI_RL_TOOL_RPM`, `AI_RL_LLM_RPM`, `AI_RL_RAG_RPM`, `AI_RL_API_RPM`, `AI_RL_ADMIN_RPM`, `AI_RL_RUN_PER_INVOKE`
- Kill switch: `AI_RL_DISABLED=1` (não enforce)
- Backend: `AI_RL_BACKEND=supabase|memory` (produção → supabase / fail-closed sem admin DB)
- Coach: `COACH_RPM` / `COACH_RPD` (mesmo store)
- Cost: `AI_COST_USER_DAY` / `AI_COST_RUN_MAX` / `AI_COST_DAY_MAX` (micro-USD no mesmo store)

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
npm run cert:migrations
# ou npm run ai:certification
```

Tabelas canônicas: `ai_audit_events`, `ai_*_memory`, `ai_knowledge_*`.

## Certificação (FASE 22.7)

```bash
npm run ai:certification
```

Doc: [AI_PRODUCTION_CERTIFICATION.md](./AI_PRODUCTION_CERTIFICATION.md)  
Relatório: [AI_PRODUCTION_READINESS_REPORT.md](./AI_PRODUCTION_READINESS_REPORT.md) + `docs/certification/latest.json`  
`production_ready` permanece **false** enquanto houver critical UNTESTED/FAIL/BLOCKED/DEGRADED, suite não executada, ou migrations remotas incompletas. UNTESTED ≠ PASS.

## Production E2E (FASE 22.12)

Smoke real (DB/pgvector/Memory/Audit/Decision Engine). Sem service_role → **BLOCKED**. Mock/InMemory nunca conta como PASS.

```bash
npm run ai:prod-e2e
```

Doc: [AI_PRODUCTION_E2E.md](./AI_PRODUCTION_E2E.md) · artifact `docs/certification/production-e2e.json`  
Harness `runAiE2EPipeline` = TEST_ONLY (≠ este path).

## Final Certification (FASE 22.13)

Agregador final (AUDIT/VERIFY/TEST/CERTIFY). Sem secrets → `production_ready: false` com BLOCKED remoto.

```bash
npm run ai:certification:final
```

Doc gerado: [AI_PRODUCTION_CERTIFICATION_FINAL.md](./AI_PRODUCTION_CERTIFICATION_FINAL.md) · `docs/certification/final.json`

## CI/CD Safety Gate (FASE 22.8)

```bash
# veredicto após cert
npm run ai:ci-verdict
```

Pipeline completo: [AI_CI_CD_GATES.md](./AI_CI_CD_GATES.md) · workflow `.github/workflows/ai-eval.yml`.

## Database readiness (FASE 22.9)

```bash
npm run ai:db-readiness
```

Verifica inventário local + probe remoto (tables/indexes/RLS/pgvector/service_role).  
Sem service_role → `BLOCKED` / `MIGRATION_VERIFICATION_BLOCKED`.  
Doc: [AI_DATABASE_READINESS.md](./AI_DATABASE_READINESS.md) · JSON: `docs/certification/database-readiness.json`.
