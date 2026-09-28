# AI Database Readiness (FASE 22.9)

Verificação profunda de schema AI: **migrations locais ≠ aplicadas no remoto**.  
PASS só com probe remoto completo (tables, indexes, RLS, pgvector, service_role). Sem `adminDb` / service_role → **BLOCKED** (`MIGRATION_VERIFICATION_BLOCKED`) — nunca inventar `applied`.

## Como rodar

```bash
npm run ai:db-readiness
```

Gera:

- `docs/certification/database-readiness.json`
- Cobertura Vitest em `src/ai/certification/database-readiness.test.ts`

Com secrets:

```bash
# SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no ambiente
npm run ai:db-readiness
```

Sem secrets (esperado em CI Fit Companion sem secret): `verdict: BLOCKED`, `error_code: MIGRATION_VERIFICATION_BLOCKED`.

## Inventário canônico

Fonte: [`src/ai/certification/ai-schema-inventory.ts`](../src/ai/certification/ai-schema-inventory.ts)

| Migration | Objetos |
|-----------|---------|
| `20261018120000_fase9_ai_memory.sql` | `ai_user/decision/outcome_memory`, `ai_learning_events` |
| `20261025120000_fase11_ai_audit_events.sql` | `ai_audit_events` + indexes base |
| `20261027120000_fase16_ai_knowledge.sql` | extension `vector` + `ai_knowledge_*` |
| `20261028120000_fase19_ai_audit_kinds.sql` | kind CHECK |
| `20261029120000_fase22_3_memory_version.sql` | colunas `version` |
| `20261030120000_fase22_6_ai_audit_durability.sql` | indexes `decision_id` / `parent_run` |
| `20261031120000_fase22_9_ai_schema_verify.sql` | RPC `ai_schema_inventory_probe` |

**Tables (critical):** 8 em `AI_REQUIRED_TABLES`.

**Indexes (sample critical):** audit `user_created`, `run`, `kind_created`, `decision_id`, `parent_run`; memory `*_active_key_uidx` / `*_user_idx`; knowledge domain/source/document.

**RLS:** `ENABLE` em todas as tabelas AI; **0** policies para `anon` / `authenticated`; GRANT só `service_role`.

**Extension:** `vector` (pgvector).

**Adjacentes (observed, não bloqueiam PASS AI):** `recommendation_decisions`, `decision_context_snapshots`, `decision_actions`.

**Functions/triggers AI canônicas (pré-22.9):** nenhuma. A 22.9 adiciona apenas `ai_schema_inventory_probe` (SECURITY DEFINER, EXECUTE só `service_role`) para ler `pg_indexes` / `pg_extension` / RLS via PostgREST.

## Veredictos

| Verdict | Quando |
|---------|--------|
| **PASS** | Arquivos locais OK + service_role + catalog RPC + tables/indexes/RLS/pgvector/columns sem drift |
| **BLOCKED** | Sem service_role, ou RPC de catalog ausente (migration 22.9 não aplicada), ou SELECT bloqueado — `MIGRATION_VERIFICATION_BLOCKED` |
| **FAIL** | Arquivo de migration local ausente, ou drift crítico remoto (table/index/extension/column/RLS) |

## Git ≠ applied

Arquivos em `supabase/migrations/` no Git **não** provam aplicação no projeto Supabase Fit Companion. Só o probe com `SUPABASE_SERVICE_ROLE_KEY` + RPC (ou evidência equivalente) conta para PASS.

## Integração cert / CI

- Probes `database` / `migrations` em certificação (FASE 22.7) chamam `verifyAiDatabaseReadiness`.
- CI (FASE 22.8): step `npm run ai:db-readiness` antes do certification; BLOCKED remoto **não** falha o job sozinho (testes aceitam BLOCKED sem secret); FAIL se drift crítico detectável com service_role / inventário local quebrado.
- Compat: `verifyAiMigrations()` (SELECT limit 1) permanece para callers legados.

## API

```ts
import { verifyAiDatabaseReadiness } from "@/ai/certification/verify-database-readiness.server";

const report = await verifyAiDatabaseReadiness();
// report.verdict: PASS | BLOCKED | FAIL
// report.error_code?: MIGRATION_VERIFICATION_BLOCKED
```

## Ver também

- [AI_PRODUCTION_CERTIFICATION.md](./AI_PRODUCTION_CERTIFICATION.md)
- [AI_CI_CD_GATES.md](./AI_CI_CD_GATES.md)
- [AI_PRODUCTION_RUNBOOK.md](./AI_PRODUCTION_RUNBOOK.md)
- [AI_ARCHITECTURE_FINAL.md](./AI_ARCHITECTURE_FINAL.md)
