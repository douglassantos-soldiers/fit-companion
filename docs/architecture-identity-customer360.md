# Identity + Customer 360 — Fit Companion

## Visão geral

O Fit Companion evoluiu de identidade baseada em `device_id` (localStorage) para:

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
- Paginação Admin API via `Link: rel="next"` (cap 5 páginas / 250 pedidos por run)

## Customer 360

Camada de agregação em `src/lib/customer360/` + tabela derivada `customer_profiles`.

**Objetivos NÃO vêm de produtos Shopify.** Produtos são sinal commerce; goal vem de onboarding/perfil.

## Events

`user_events` é a tabela canônica. `trackUserEvent` / `trackAppEvent` gravam ali (+ espelho legado em `engagement_events`).

## Context / Learning / Score

- **Context Engine** (`src/lib/engine/context.ts`): sinais do dia + `why[]`
- **Learning**: regras + `extractUserPatterns` (sem ML)
- **Performance score**: média das dimensões de treino/recuperação/sono — **sem** suplementação
- **Adherence score**: nutrição + suplementação + hábitos
- Suplementação sem piso artificial `|| 40`

## Sync

- `meal_entries` persiste refeições detalhadas (antes `pullState` zerava `meals`)
- Local = cache/offline; Supabase = source of truth quando sincronizado
- Identity: `ensureIdentityForDevice` no boot

## Weekday

`planDayForToday` usa `Date.getDay()` (Dom=0) e retorna **apenas** match exato — dias de descanso retornam `null` (não o próximo treino).

## Migration

`supabase/migrations/20260919000000_identity_customer360.sql` — não destrutiva.

Aplicar com `supabase db push` ou SQL Editor no projeto.

## Arquivos-chave

- `src/lib/identity/` — Identity Engine
- `src/lib/customer360/` — aggregators + recompute
- `src/lib/events/track.ts` — eventos
- `src/lib/shopify-orders.server.ts` — paginação
- `src/lib/orders.server.ts` — persistência de pedidos
- `src/lib/engine/context.ts` — Context Engine
- `src/routes/api/shopify.webhook.ts` — webhooks multi-topic
