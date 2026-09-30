# RLS validation

## Intended remote state

Applied in order (repo migrations):

1. `20261016120000_fase1_security_authorization_hardening.sql` — revoke social/commerce broad access; lock checkins writes
2. `20261017120000_fase2_identity_authz_defense.sql` — `private.current_app_user_id()` + owner policies v2

**Never re-execute** `supabase/DEPLOY_*.sql` after harden — they reopen `USING (true)`.

## Repo scan (CI)

```bash
npx vitest run src/lib/security/rls-validation.test.ts
```

## Remote probe (operator)

```bash
# with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
node --experimental-strip-types scripts/validate-rls-remote.mjs
```

Without credentials or without RPC `soldiers_rls_audit`, status is **PENDING OPERATOR** — never invent PASS.

### Manual SQL (operator)

```sql
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual ILIKE '%true%'
    OR with_check ILIKE '%true%'
  )
ORDER BY tablename, policyname;
```

Any open anon/authenticated `USING (true)` on domain/social/AI user tables = **FAIL**.

## Certification

| Check | Status |
|-------|--------|
| Harden migrations in repo | PASS (unit scan) |
| DEPLOY_*.sql marked dangerous | PASS (warn recorded) |
| Live remote policies == harden | **PENDING OPERATOR** until probe/SQL audit |
