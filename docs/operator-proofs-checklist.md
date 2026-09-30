# Operator proofs checklist (Production Ready gate)

Run:

```bash
npm run gate:operator
```

Evidence file: `docs/certification/operator-gate-evidence.json`

| Proof | How to close | Status until closed |
|-------|--------------|---------------------|
| RLS remote | SQL in `docs/rls-validation.md` or deploy `soldiers_rls_audit` RPC + secrets | PENDING OPERATOR |
| RAG remote | `npm run rag:seed` then re-run gate with `SUPABASE_*` | PENDING OPERATOR |
| Wipe live | Controlled user + `clearUserDataFn` BEFORE/AFTER rows | PENDING OPERATOR |
| Backup restore | Follow `docs/backup-dr.md` drill | PENDING OPERATOR |
| E2E auth | Set `E2E_ACCESS_EMAIL` + entitlement; extend `e2e/smoke.spec.ts` | PENDING OPERATOR |
| Wearables | Provider credentials + OAuth smoke | PENDING / INTEGRATION |
| Shopify/Push live | Staging webhook + cron with secrets | PENDING OPERATOR |
| Leaked-password | Supabase Auth dashboard enable | PENDING OPERATOR |

Unit/code proofs already PASS in repo (wipe inventory, RLS migration scan, RAG allowlist, photo ownership, identity fail-closed).
