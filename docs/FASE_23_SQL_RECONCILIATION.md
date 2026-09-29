# FASE 23 — Loose SQL reconciliation

| File | Role | Action |
|------|------|--------|
| `supabase/DEPLOY_PENDING_FASE22.sql` | Concatenation of official FASE16–22.10 migrations for SQL Editor | **Do not re-apply** if migrations already applied. Source of truth = `supabase/migrations/*` |
| `supabase/DEPLOY_HARDEN_20260919.sql` | Pointer to harden RLS + session RPE migrations | Already versioned (`20260919120000_*`, `20260919120100_*`) |
| `supabase/DEPLOY_PENDING_HUBS.sql` | Legacy hubs seed with permissive RLS | **DO NOT EXECUTE** in production (header already warns). Schema covered by `20260918010000_creator_hubs.sql` + later harden |

No new duplicate migrations were required for FASE 23 activation.
