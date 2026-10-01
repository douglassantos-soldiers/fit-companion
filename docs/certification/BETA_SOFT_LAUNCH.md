# Beta soft launch checklist

Controlled beta after `npm run gate:operator` exit **0**.

## Freeze

1. Note git SHA: `git rev-parse HEAD` (must match `docs/certification/operator-gate-evidence.json` → `head`).
2. Publish the site on that SHA (Lovable / host).
3. Re-run `npm run gate:operator` with `SUPABASE_*` + `E2E_ACCESS_*` if evidence head drifted.

## Soft launch

- Limit cohort (allowlist / invite).
- Monitor Supabase: `users.status` call volume (cookie stamp TTL 5m should cut hot-path reads).
- Watch AccessGate, sync push errors, wipe path on `/perfil`.
- Meal AI / Coach LLM keys optional — core works without them.

## Still deferred before full `production_ready: true`

- Enable **leaked password protection** in Supabase Auth dashboard → set `leaked_password_protection.status=pass` in `operator-live-proofs.json`.
- Wearables OAuth smoke.
- Optional: PITR restore to a separate staging project (Docker/PITR).
- Align published URL HMAC secrets (`SHOPIFY_WEBHOOK_SECRET`, `CRON_SECRET`) for live webhook/cron (local staging smoke already PASS).

## Certification (same SHA)

```bash
npm run cert:assert-ready
npm run ai:certification:final
```

Expect `docs/certification/latest.json`: `production_ready: true`, `environment: production`, `commit_sha` = published SHA.
