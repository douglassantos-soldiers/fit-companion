# Data export (LGPD)

## Entry

`/perfil` → export → `exportUserDataServer` (`src/lib/sync.server.ts`).

## Policy

Defined in [`src/lib/export-policy.ts`](../src/lib/export-policy.ts):

- **Included:** profile, sessions, weights, measurements, progress photo paths, meals, meal_items, daily metrics, supplements, events, devices, prefs, own activity summary, AI user memory (when available), wearable connection metadata (no tokens).
- **Excluded:** Shopify orders, entitlement emails, admin audit, AI security audit, other users, secrets/tokens.
- **Partial:** social graph depth, wearables tokens, AI memory availability.

The export JSON embeds `policy` so clients know what was intentionally omitted.
