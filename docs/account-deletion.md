# Account deletion (LGPD)

## Entry point

UI: `/perfil` → "Apagar dados da conta no servidor" → `clearUserDataFn` → `clearUserDataServer` → `executeAccountWipe`.

Requires trusted access cookie (`resolveTrustedIdentity({ requireAccess: true })`) and service_role DB.

## Classification

| Class | Meaning | Examples |
|-------|---------|----------|
| **DELETE** | Personal / domain data must disappear | sessions, meals, meal_items, progress, social graph, AI memory, devices, users |
| **ANONYMIZE** | Keep commercial integrity; drop identity | `orders.user_id` → NULL via `ON DELETE SET NULL` when `users` row is deleted |
| **RETAIN** | Security / commerce / shared corpus | `app_entitlement_emails`, `shopify_webhook_events`, `admin_audit_log`, RAG knowledge, catalogs |

Source of truth: [`src/lib/account-deletion.ts`](../src/lib/account-deletion.ts).

## Storage

| Bucket | Action |
|--------|--------|
| `progress-photos` | Wipe paths for user (`removeProgressPhotosForUser`) |
| `checkins` | Wipe folders for all device ids of the user (`removeCheckinsForDevices`) |
| `soldiers-media` | Untouched (brand library) |

## Auth

App wipe removes `public.users` and related domain data. Supabase `auth.users` is **not** deleted by this flow unless a separate Auth admin step is added later (document as PENDING OPERATOR if product requires full Auth purge).

## Tests

`src/lib/account-deletion.test.ts` — inventory coverage + BEFORE/AFTER mock wipe.
