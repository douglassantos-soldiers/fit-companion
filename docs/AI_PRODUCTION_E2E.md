# AI Production E2E (FASE 22.12)

Smoke do fluxo completo com componentes **reais** de produção.

**Não** confundir com [`runAiE2EPipeline`](../src/ai/e2e/run-pipeline.ts) (TEST_ONLY: QA + mocks + `AI_AUDIT_PERSIST=0`).

## Como rodar

```bash
npm run ai:prod-e2e
```

Com secrets Fit Companion / Lovable `47f1291e-…`:

```bash
# SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
# Migrations 22.9 (schema probe) + 22.10 (rate limit) aplicadas
npm run ai:prod-e2e
```

Artifact: `docs/certification/production-e2e.json`

## Pré-gates (PASS)

1. `verifyAiDatabaseReadiness` = **PASS**
2. `adminDb` service_role
3. RAG store `supabase_pgvector_v1` (InMemory → **FAIL** `mock_store_forbidden`)
4. Memory store `supabase_memory_v1`
5. `AI_AUDIT_PERSIST=1` durante o smoke

Sem secret / DB não PASS → **BLOCKED** (`PRODUCTION_E2E_BLOCKED`) — nunca inventar PASS.

## Fluxo happy

USER → Identity → Context → Orchestrator → Specialists → Skills/Tools/RAG/Memory → Proposal → Safety → Decision Engine → Decision → Living Plan → Outcome/Learning (smoke) → Audit read-back → correlation.

API: [`runProductionE2E`](../src/ai/e2e/production-e2e.ts).

## Failure paths

RAG / Memory / Tool / LLM-rollback / Safety / Invalid proposal / Unauthorized tool / DB unavailable / Kill switch — todos com `expected_fail` observável.

## Correlation

`run_id` → proposal → `decision_id` → `outcome_id` → `learning_event_id` (quando emit ligado).

## Idempotency + isolation

Mesmo `idempotencyKey` → mesmo `run_id`. Memory user A não vaza para user B.

## Ver também

- [AI_CANONICAL_RUNTIME.md](./AI_CANONICAL_RUNTIME.md)
- [AI_PRODUCTION_CERTIFICATION.md](./AI_PRODUCTION_CERTIFICATION.md)
- [AI_DATABASE_READINESS.md](./AI_DATABASE_READINESS.md)
- [AI_CI_CD_GATES.md](./AI_CI_CD_GATES.md)
