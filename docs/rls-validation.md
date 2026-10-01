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
# Required env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
node scripts/validate-rls-remote.mjs
# equivalent:
node --experimental-strip-types scripts/validate-rls-remote.mjs
```

Exit codes: `0` PASS · `1` FAIL · `2` migration blocker in repo · `3` PENDING OPERATOR.

Without credentials or without RPC `soldiers_rls_audit`, status is **PENDING OPERATOR** — never invent PASS.

Also invoked by `npm run gate:operator`. After PASS, confirm `docs/certification/operator-gate-evidence.json` `head` matches the published site SHA before certification.

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
