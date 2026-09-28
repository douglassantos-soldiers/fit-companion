# AI Audit Durability (FASE 22.6)

Objetivo: reconstruir qualquer decisão crítica a partir do audit trail — **CRITICAL** é durable e awaited; **OBSERVATIONAL** permanece best-effort.

## CRITICAL vs OBSERVATIONAL

| Tier | Inclui | Persistência |
|------|--------|--------------|
| **CRITICAL** | `decision`, `outcome`, `learning_event`; safety rejection; unauthorized tool / security; agent/skill/tool críticos; `rag_retrieval` com `decision_id` ou `used_for_decision`; proposal_merge inválido/safety | `await recordCriticalAudit` / `persistCriticalAiAudit` |
| **OBSERVATIONAL** | debug, telemetry, latency, `ai_gateway` ok, RAG informativo | fire-and-forget (`recordAudit` + `schedulePersistAiAudit`) |

Classificação: [`src/ai/governance/durability.ts`](../src/ai/governance/durability.ts).

## API awaited

```ts
const result = await recordCriticalAudit({ kind: "decision", audit_id, ... });
// result: { ok, persisted, audit_id } | { ok:false, persisted:false, error_code:"AUDIT_PERSISTENCE_FAILED", error }
```

Helpers: `recordDecisionAuditCritical`, `recordOutcomeAuditCritical`, `recordLearningEventAuditCritical`.

IDs estáveis (idempotency): `audit_decision_${decisionId}`, `audit_safety_${runId}`, `audit_outcome_${outcomeId}`, `audit_learning_event_${eventId}`.

Upsert Postgres: `onConflict: audit_id`.

## Decision gate

[`runAuthoritativeBridge`](../src/ai/runtime/authoritative-bridge.ts) **aguarda** o audit da Decision.

- Se persistência obrigatória falhar → `ok: false`, `error_code: AUDIT_PERSISTENCE_FAILED`, `audit_persisted: false`.
- A Decision no ledger pode existir; o fluxo **não** é considerado completamente concluído.
- Safety rejection emite audit crítico awaited (`status: blocked_by_safety`); o `error_code` primário permanece `safety_rejection`.
- Skip explícito (`skipped: true`): `AI_AUDIT_PERSIST=0`, client, ou `non_uuid_user` (harness). Harness local pode completar sem DB.
- Persist on + UUID + DB down/error → `AUDIT_PERSISTENCE_FAILED`.

## Retry

`persistCriticalAiAudit`: até 3 tentativas, backoff 50ms / 100ms, só em erros transitórios (timeout, 503, network, unavailable).

`admin_db_unavailable` **não** é sucesso para CRITICAL (diferente do path observational).

## RLS / service_role

| Item | Estado |
|------|--------|
| Tabela | `public.ai_audit_events` |
| RLS | ENABLED; **sem** policies `authenticated`/`anon` |
| Grants | `REVOKE ALL` de anon/authenticated; `GRANT ALL` a `service_role` |
| Writes | somente via `persist.server.ts` + admin DB (service_role) |

Migration base: `20261025120000_fase11_ai_audit_events.sql`.  
Indexes FASE 22.6: `20261030120000_fase22_6_ai_audit_durability.sql` (`decision_id`, `parent_run_id`).

## Correlation

Eventos críticos carregam quando disponíveis: `run_id`, `parent_run_id`, `decision_id`, `outcome_id`, `learning_event_id`, `context_fingerprint`.

## Redaction

Antes do write: metadata (`api_key`, `access_token`, `service_role`, `authorization`, `password`, `bearer`, secrets) + summary (Bearer / `sk-` / JWT-like / `api_key=`).

## Testes

[`src/ai/governance/audit-durability.test.ts`](../src/ai/governance/audit-durability.test.ts):

- Decision → persist → read-back
- Restart (clear ring, DB retains)
- DB unavailable → `AUDIT_PERSISTENCE_FAILED`
- Idempotency (mesmo `audit_id`)
- Secrets redacted
- Bridge gate

## Critério PASS / BLOCKED

| Check | Local | Remoto |
|-------|-------|--------|
| Critical awaited + confirmação | testes | read-back em `ai_audit_events` |
| Retry + idempotency | testes | — |
| Secrets redacted | testes | — |
| RLS / indexes | migration no repo | apply no projeto Fit Companion |
| Correlation | testes / bridge | — |

**Local código:** PASS (suite `audit-durability.test.ts` + e2e gate).  
**Remoto Fit Companion (`zphtvrsxlhfgltwgbreu` / project `47f1291e-…`):** **BLOCKED** — MCP/service_role sem permissão para probe `ai_audit_events` / apply migration `20261030120000_fase22_6_ai_audit_durability.sql`. Apply remoto necessário para PASS remoto.

Ver também: [AI_GOVERNANCE.md](./AI_GOVERNANCE.md).
