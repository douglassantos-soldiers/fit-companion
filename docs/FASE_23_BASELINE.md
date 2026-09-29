# FASE 23 — Baseline (Discovery)

**Commit:** `88d237fcb24233324c9d0d3b0d413efd05b4c66e`  
**Date:** 2026-09-28  
**Project:** Fit Companion / Performance OS (`zphtvrsxlhfgltwgbreu` / Lovable `47f1291e-…`)

## Status por infraestrutura (pré-correção)

| Gate | Status | Evidência |
|------|--------|-----------|
| Current Commit | OK | HEAD `88d237f` |
| Certification artifacts | STALE | `docs/certification/latest.json` → `07b4250`, `production_ready: false` |
| RAG | DEGRADED | corpus docs=0; seed script exists |
| Memory | CODE READY / bootstrap GAP | fire-and-forget `ensureMemoryStore` |
| LLM Gateway | CODE READY | default deterministic; keys may be absent |
| Parallel AI paths | GAP | meal-ai + callCoachProvider direct fetch |
| Audit | CODE READY | critical await + persist |
| Rate Limit | GAP | `process.env` mutation in coach.functions |
| Kill Switch | PASS (local) | flags + readiness |
| Decision Authority | PASS | proposal ≠ decision |
| Identity/RLS | UNVERIFIED remoto | ai_* service_role-only design |
| CI Release Gate | GAP | BLOCKED → exit 0 structural only |
| Production E2E | BLOCKED | sem remote stores na cert stale |
| Golden eval | PARTIAL | domains core OK; faltam exercise/progression/fatigue/goals |

## Problemas encontrados

1. Certificação aponta commit antigo (`07b4250`).
2. RAG remoto sem corpus operacional.
3. Bootstrap Memory/RAG assíncrono sem await.
4. Meal AI e `callCoachProvider` bypassam Gateway/kill switch.
5. `runAiE2EPipeline` exportado no barrel público `@/ai`.
6. Coach muta `process.env.AI_RL_*` por request.
7. CI structural aceita BLOCKED com exit 0; falta Production Release Gate.
8. MCP Supabase sem acesso ao projeto Fit Companion — probes via service role local.
9. OPENAI/ANTHROPIC keys ausentes no `.env` na inspeção inicial.

## Arquivos relevantes

- Runtime: `src/ai/runtime/production-runtime.ts`, `authoritative-bridge.ts`
- Gateway: `src/ai/gateway/`
- RAG: `src/ai/rag/`, `scripts/seed-rag-corpus.ts`
- Memory: `src/ai/memory/`
- Audit: `src/ai/governance/audit.ts`, persist.server
- Rate limit: `src/ai/runtime/rate-limit.ts`, `rate-limit-store.ts`
- Parallel: `src/lib/meal-ai.functions.ts`, `src/lib/coach/provider.ts`
- Coach: `src/lib/coach.functions.ts`
- Cert: `src/ai/certification/`, `scripts/ai-ci-gate-verdict.mjs`
- Decision: `src/lib/engine/decision.ts`, `decision-proposal.ts`

## Migrations / tabelas / RPCs

- `20261018120000_fase9_ai_memory.sql` — memory
- `20261025120000_fase11_ai_audit_events.sql` — audit
- `20261027120000_fase16_ai_knowledge.sql` — RAG/pgvector
- `20261029120000_fase22_3_memory_version.sql`
- `20261030120000_fase22_6_ai_audit_durability.sql`
- `20261031120000_fase22_9_ai_schema_verify.sql`
- `20261101120000_fase22_10_ai_rate_limits.sql` — `ai_rate_limit_consume`
- Tabelas: `ai_knowledge_*`, `ai_audit_events`, `ai_rate_limit_buckets`, memory tables
- Loose SQL: `DEPLOY_PENDING_FASE22.sql` (espelho), `DEPLOY_PENDING_HUBS.sql` (NÃO executar), `DEPLOY_HARDEN_20260919.sql` (pointer)

## Testes existentes

- `npm run ai:certification` / `ai:certification:final`
- `npm run ai:db-readiness` / `ai:rate-limit` / `ai:kill-switch` / `ai:prod-e2e`
- `npm run guard:ai-mock` / `ai:ci-verdict` / `rag:seed`
- Vitest: certification, distributed rate limit, golden eval, production runtime

## Itens a corrigir nesta fase

Ver plano FASE 23: activate → connect → verify → harden → test → certify.  
Não criar arquitetura duplicada. Não alterar UI. Coach permanece deterministic no product path.
