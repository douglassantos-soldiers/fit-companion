# FASE 23 — Identity & RLS (AI surfaces)

## Model

| Surface | Access | Identity authority |
|---------|--------|--------------------|
| `ai_*` tables (memory, audit, knowledge, rate_limit) | **service_role only** (RLS enabled, 0 client policies, REVOKE anon/authenticated) | Server resolves user via session / JWT; writes use trusted `user_id` |
| `profiles`, `app_state`, `sessions` | authenticated RLS policies | `auth.uid()` / session cookie |

This is intentional: AI critical stores are not exposed to the Data API for anon/authenticated clients.

## device_id

`device_id` is **provenance / bind** for access-session device checks.

It is **not** identity authority. Critical AI ops use `resolveTrustedIdentity` / access session `userId`/`email`.

## Who can call what

| Operation | Gate |
|-----------|------|
| `askAiCoach` | Access session + trusted identity |
| Memory read/write | Server + trusted user id; store enforces isolation |
| RAG retrieval | Server; corpus is global knowledge (not per-user PII) |
| Rate limit consume | `ai_rate_limit_consume` → service_role |
| Critical audit persist | service_role |
| Tools with admin danger | Authorization deny (cert probe) |

## Cross-user

User A must not read User B memory/decisions — enforced in Memory store + identity checks; certified by production E2E authz scenario when remote stores available.
