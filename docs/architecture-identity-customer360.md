# Identity + Customer 360 — Soldiers Training

## Visão geral

O Soldiers Training evoluiu de identidade baseada em `device_id` (localStorage) para:

```
SHOPIFY → Identity Engine → User → Customer 360 → Engines → Context → Learning → Coach → Hoje → Events → …
```

Shopify é **uma fonte** de dados (commerce), não o centro da aplicação.

## Identidade

| Entidade | Tabela | Papel |
|----------|--------|--------|
| User | `public.users` | Identidade canônica do app (≠ `auth.users`) |
| Device | `public.devices` | Aparelho vinculado a um user |
| Customer Identity | `public.customer_identities` | Providers externos (`shopify`, futuro: Apple, Strava…) |

- `device_id` continua existindo nas tabelas legadas para compatibilidade.
- Colunas `user_id` foram adicionadas e backfilladas.
- Ao verificar e-mail Shopify, o device é re-linkado ao user do e-mail (`linkDeviceToShopifyUser`).

## Segurança de acesso

`establishAccessSession` **não confia** em `accessTier` / `orderCount` / `productIds` do client.

Fluxo:

1. Client envia `email` + `deviceId`
2. Servidor chama `resolveAccessProfileForEmail` (entitlement row + Admin API paginada)
3. Cookie e `app_entitlements` usam o tier recalculado no servidor

## Commerce

- `orders` + `order_items` — entidades transacionais (`UNIQUE shopify_order_id`)
- Webhooks: `customers/*`, `orders/*`, `refunds/create` com HMAC + idempotência (`shopify_webhook_events`)
- Paginação Admin API via `Link: rel="next"` — **até 20 páginas / 1000 pedidos por run**; sync completo = loops até `hasMore=false` (cursor em `shopify_sync_cursors`)
- `orders.raw_snapshot` = único raw Shopify; restock derivado vive em `customer_profiles.restock_estimates` (não re-gravar no entitlement snapshot)

## Customer 360

Camada de agregação em `src/lib/customer360/` + tabela derivada `customer_profiles`.

**Recompute é DB-first:** `hydrateAppStateFromDb(userId)` monta `AppState` a partir de `profiles`, `sessions`, `meal_entries`, `weights`, `daily_metrics`, `supplement_logs`, `app_state` — **sem** fallback `emptyState` que zerava performance/nutrition.

Callers (webhook, access, refund, store) podem chamar `recomputeCustomerProfile(userId)` sem enviar AppState.

| Campo | Origem |
|-------|--------|
| commerce | `orders` / `order_items` (`loadCommerce360`) |
| performance / nutrition / recovery / behavior | aggregators sobre state hidratado |
| `shopifyCustomerId` | `customer_identities` (provider `shopify`) |
| `lineage` + `estimates` | gravados em `metrics` JSON; LTV/next purchase/restock têm `kind: "estimate"` |

**Objetivos NÃO vêm de produtos Shopify.** Produtos são sinal commerce; goal vem de onboarding/perfil.

## Events

`user_events` é a tabela canônica. `trackUserEvent` / `trackAppEvent` gravam ali (+ espelho legado em `engagement_events`).

## Context / Learning / Score

- **Context Engine** (`src/lib/engine/context.ts`): sinais do dia + `why[]` (também mesclado no Living Plan)
- **Learning**: regras + `extractUserPatterns` → persistido em `user_patterns` no boot (best-effort)
- **Performance score** = média(força, resistência, consistência, recuperação, sono) — **sem** suplementação
- **Adherence score** = média(nutrição, suplementação, hábitos)
- Suplementação sem piso artificial `|| 40`
- Restock `confidence` sobe com dias de log de consumo (`enrichRestockConfidence`)

## Sync

- Domain sync is **server-authoritative** (`sync.functions.ts` → service_role).
- Ownership key = **`user_id`**. `device_id` is canal (last writer provenance).
- Push requires access cookie (`requireAccess`).
- Pull prefers `.eq("user_id")` with legacy device merge fallback.
- Multi-device: all devices of a user share the same domain rows.

## Session

- Cookie `soldiers_access` always includes `userId` after `establishAccessSession`.
- `resolveTrustedIdentity` is session-first; never trusts client `userId`.

## Safety / Recommendation

- **Safety Engine** (`engine/safety.ts`): sleep/energy/RPE guards → Living Plan + stim filter.
- **Recommendation Engine** (`engine/recommendation.ts`): ranks next actions for Hoje.
- **Outcome helpers** (`outcome.ts`): learning-loop event names.

## Migration

`supabase/migrations/20260919000000_identity_customer360.sql` — não destrutiva.
`supabase/migrations/20260919120000_harden_domain_rls.sql` — domain/social writes service_role only.
`supabase/migrations/20260919120100_session_rpe_express.sql` — rpe/express on sessions.
`supabase/migrations/20260919130000_user_owned_domain.sql` — UNIQUE por user_id + RLS authenticated ownership.
`supabase/migrations/20260919140000_customer360_lineage.sql` — `shopify_customer_id` + `supplement_adherence` em `customer_profiles` (métricas/lineage também em `metrics` JSON).

Aplicar com `supabase db push` (conta com privilégio no projeto `zphtvrsxlhfgltwgbreu`) ou SQL Editor no dashboard.


## Arquivos-chave

- `src/lib/identity/` — Identity Engine
- `src/lib/customer360/` — aggregators + hydrate + recompute
- `src/lib/customer360/hydrate.server.ts` — AppState from DB
- `src/lib/events/track.ts` — eventos
- `src/lib/shopify-orders.server.ts` — paginação
- `src/lib/orders.server.ts` — persistência de pedidos
- `src/lib/engine/context.ts` — Context Engine
- `src/routes/api/shopify.webhook.ts` — webhooks multi-topic
