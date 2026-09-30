# FASE 23 — Loose SQL reconciliation

| File | Role | Action |
|------|------|--------|
| `supabase/DEPLOY_PENDING_FASE22.sql` | Concatenation of official FASE16–22.10 migrations for SQL Editor | **Do not re-apply** if migrations already applied. Source of truth = `supabase/migrations/*` |
| `supabase/DEPLOY_HARDEN_20260919.sql` | Pointer to harden RLS + session RPE migrations | Already versioned (`20260919120000_*`, `20260919120100_*`) |
| `supabase/DEPLOY_PENDING_HUBS.sql` | Legacy hubs seed with permissive RLS | **DO NOT EXECUTE** in production (header already warns). Schema covered by `20260918010000_creator_hubs.sql` + later harden |

No new duplicate migrations were required for FASE 23 activation.

## Deploy remoto — 2026-09-30 (revalidado ~00:20Z)

| Item | Resultado |
|------|-----------|
| Project | `zphtvrsxlhfgltwgbreu` (APP), linked CLI |
| `migration list --linked` | **54/54 synced** (local == remote) |
| `db push --linked --dry-run` | **upToDate** |
| `db push --linked` | **upToDate** — nada a aplicar |
| Bundles `DEPLOY_ALL` / `HUBS` / `DEPLOY_PENDING_FASE22` | **Não executados** |
| `rag:seed` (`AI_RAG_ENV=production`) | **OK** — 85 docs / 430 chunks (`supabase_pgvector_v1`) |
| `ai:db-readiness` | **PASS** |
| Rate-limit readiness (`ai_rate_limit_consume`) | **PASS** |
| Advisors | WARNs não-bloqueantes: `vector` em `public`; leaked-password protection off |

Evidência JSON: [`docs/certification/supabase-deploy-evidence.json`](./certification/supabase-deploy-evidence.json).

## Deploy remoto — 2026-09-29 (revalidado 02:28Z)

| Item | Resultado |
|------|-----------|
| Project | `zphtvrsxlhfgltwgbreu` (APP), linked CLI |
| `migration list --linked` | **54/54 synced** (local == remote) |
| `db push --linked --dry-run` | **upToDate** — nenhuma migration pendente |
| `db push --linked` | **upToDate** — nada a aplicar |
| Bundles `DEPLOY_ALL` / `HUBS` / `DEPLOY_PENDING_FASE22` | **Não executados** |
| `rag:seed` (`AI_RAG_ENV=production`) | **OK** — 25 docs / 25 chunks (`supabase_pgvector_v1`) |
| `ai:db-readiness` | **PASS** |
| Rate-limit readiness (`ai_rate_limit_consume`) | **PASS** |
| Advisors | WARNs não-bloqueantes: `vector` em `public`; leaked-password protection off |

Evidência JSON: [`docs/certification/supabase-deploy-evidence.json`](./certification/supabase-deploy-evidence.json).
