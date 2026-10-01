# Operator proofs checklist (Production Ready gate)

## Commands

```bash
# Local + remote probes (writes docs/certification/operator-gate-evidence.json)
# head in that file MUST equal the git SHA of the published site before cert.
npm run gate:operator

# RLS remote only
# Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
node scripts/validate-rls-remote.mjs
# or: node --experimental-strip-types scripts/validate-rls-remote.mjs

# Authenticated E2E
# Requires: E2E_ACCESS_EMAIL + E2E_ACCESS_PASSWORD (Shopify entitlement in window)
npx playwright test e2e/authenticated.spec.ts
```

Evidence file (auto): `docs/certification/operator-gate-evidence.json`  
Operator-filled proofs: copy `docs/certification/operator-live-proofs.template.json` → `operator-live-proofs.json` and set `"status": "pass"` with ISO `at` + `detail` only after real work.

**SHA rule:** Do not certify against a stale evidence head (e.g. old `3558524…`). Re-run `gate:operator` on the published commit so `head` matches production.

## Release-blocking proofs

| Proof | How to close | Status until closed |
|-------|--------------|---------------------|
| RLS remote | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → `node scripts/validate-rls-remote.mjs` (or SQL in `docs/rls-validation.md` / RPC `soldiers_rls_audit`) | PENDING OPERATOR |
| RAG remote | `npm run rag:seed` then re-run gate with `SUPABASE_*` | PENDING OPERATOR |
| E2E auth | GitHub/local secrets `E2E_ACCESS_EMAIL` + `E2E_ACCESS_PASSWORD`; suite `e2e/authenticated.spec.ts` | PENDING OPERATOR |
| Wipe live | Controlled user + service_role wipe; BEFORE/AFTER in `operator-live-proofs.json` | PENDING OPERATOR |
| Backup restore | Follow `docs/backup-dr.md`; dated entry in `operator-live-proofs.json` | PENDING OPERATOR |
| Shopify/cron staging | Webhook HMAC + cron secret smoke; record in `operator-live-proofs.json` | PENDING OPERATOR |
| Leaked-password | Supabase Auth dashboard enable; record in `operator-live-proofs.json` | PENDING OPERATOR |

## Deferred (beta-acceptable — does not block `gate:operator` exit 0)

| Proof | Notes |
|-------|--------|
| Wearables | OAuth smoke — deferred_beta in gate |
| Leaked-password | Dashboard HIBP toggle — deferred_beta OK for controlled beta; enable before `production_ready: true` |

## CI secrets (Product CI)

| Secret | Required? | Effect |
|--------|-----------|--------|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Optional for smoke | Used by unit/RLS jobs when present |
| `E2E_ACCESS_EMAIL` | Optional | Without it, authenticated Playwright tests **skip** (smoke still runs) |
| `E2E_ACCESS_PASSWORD` | Optional (with email) | Password login for `e2e/authenticated.spec.ts` |

## After all blocking proofs PASS

1. `npm run gate:operator` → exit **0**
2. Republish the site; note published SHA
3. Confirm `operator-gate-evidence.json.head` === published SHA
4. Run certification with `environment=production` on that SHA (`npm run ai:certification:final` / project cert scripts)
5. `docs/certification/latest.json` must show `production_ready: true` and `environment: production`

Unit/code proofs already PASS in repo (wipe inventory, RLS migration scan, RAG allowlist, photo ownership, identity fail-closed, **users.status 60s cache**).
