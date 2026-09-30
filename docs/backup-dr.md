# Backup & Disaster Recovery

## Scope

| Asset | Included in DB backup? | Notes |
|-------|------------------------|-------|
| Postgres (Supabase) | Yes (platform PITR / daily) | Configure in Supabase dashboard |
| Storage `progress-photos` | **No** — separate object storage | Enable bucket versioning / lifecycle backup |
| Storage `checkins` | **No** | Public bucket; still needs object backup policy |
| Storage `soldiers-media` | **No** | Brand media; rebuildable from repo/scripts |

**Do not assume** database backup restores Storage objects.

## Targets (operator to confirm)

| Metric | Target | Status |
|--------|--------|--------|
| RPO | ≤ 24h (PITR preferred ≤ 15m) | **PENDING OPERATOR** |
| RTO | ≤ 4h for app + DB | **PENDING OPERATOR** |
| Backup frequency | Daily + PITR if Pro plan | **PENDING OPERATOR** |

## Restore procedure (outline)

1. Identify incident time / RPO point.
2. Restore Supabase project from backup / PITR to a staging project first.
3. Verify RLS policies still match FASE1/FASE2 (`docs/rls-validation.md`).
4. Restore Storage buckets if object loss occurred (separate job).
5. Re-seed RAG if knowledge tables empty (`npm run rag:seed`).
6. Smoke: access session, sync push, coach deterministic, webhook HMAC.
7. Promote only after checklist PASS.

## Evidence

A real restore was **not** executed in this audit environment → mark **PENDING OPERATOR**.
