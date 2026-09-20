# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Env / Coach LLM

Copie `.env.example` → `.env`. Para o coach com LLM, defina `OPENAI_API_KEY` (server-only, sem `VITE_`). Sem a chave, o app usa regras locais.

## Social (Supabase)

Aplique no SQL Editor do projeto (nesta ordem):

1. `supabase/migrations/20260913020000_phase5_social.sql`
2. `supabase/migrations/20260917160000_phase6_engagement.sql` (XP sync, ligas, friend quests, stories, kudos server, retention JSON, storage `checkins`)
3. `supabase/migrations/20260917180000_shopify_entitlements.sql` (gate de compra)

Smoke: entrar desafio → ranking; criar clube → código entre 2 device_ids; completar treino → XP na home + feed do clube.

## Engajamento (Duolingo + clube)

- Meta diária 20 XP, streak freeze, missões, path da semana, treino Express
- Feed do clube na home, liga semanal, friend quest, stories 24h
- Auth opcional (magic link / Google) em Perfil + service worker `/sw.js`

## Acesso Shopify (gate de compra)

Liberação permanente se o e-mail tiver **qualquer pedido pago** na loja.

1. Shopify Admin → Settings → Apps → Develop apps → Create app  
2. Scopes: `read_orders` + `read_customers` (+ `write_orders` para gravar `companion_access_url` no pedido)  
3. Install → copiar Admin API access token  
4. No `.env` (e no host Lovable/Nitro), sem prefixo `VITE_`:

```
SHOPIFY_STORE_DOMAIN=sua-loja.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
SHOPIFY_API_VERSION=2025-01
SHOPIFY_WEBHOOK_SECRET=whsec_...
APP_ORIGIN=https://seu-app.lovable.app
SHOPIFY_STOREFRONT_TOKEN=  # opcional — aba Loja
```

5. Migrations:
   - `supabase/migrations/20260917180000_shopify_entitlements.sql`
   - `supabase/migrations/20260917190000_shopify_companion_f1.sql`  
   (`supabase db push --linked`)

6. Webhook Shopify: evento **Order payment** / `orders/paid` →  
   `POST {APP_ORIGIN}/api/shopify/webhook`  
   Use o mesmo secret em `SHOPIFY_WEBHOOK_SECRET`.

7. E-mail pós-compra (Liquid / Flow): inclua o link mágico. Se o webhook gravou o note attribute:

```liquid
<a href="{{ order.note_attributes.companion_access_url }}">Abrir Soldiers Training</a>
```

Ou use a URL logada no servidor: `{APP_ORIGIN}/acesso?token=...`

Smoke:
- e-mail com pedido pago → `/acesso` libera → onboarding/home  
- `/acesso?token=...` (webhook) libera sem digitar e-mail + preenche rotina de suplementos  
- HMAC inválido no webhook → 401  
- Home mostra card de reposição quando o snapshot estima ≤14 dias  

Opcional: `VITE_SHOPIFY_STOREFRONT_URL`, `VITE_SHOPIFY_REORDER_DISCOUNT`.

## Admin Console

Backoffice em `/admin` (PIN server-only `ADMIN_PIN`, cookie `soldiers_admin`).

1. Migration: `supabase/migrations/20260923120000_admin_console_v1.sql`  
   (`cms_overrides` + `admin_audit_log`, service_role only)
2. No `.env`: `ADMIN_PIN=` (nunca `VITE_`)
3. Abas:
   - **Conteúdo** — mídia/notas de exercícios e imagens de refeições (persistido em `cms_overrides`)
   - **Usuários** — lookup por e-mail, resync Shopify, grant/revoke manual (com audit)
   - **Sistema** — últimos webhooks + sync cursors

Smoke:
- PIN ok / errado / logout
- Salvar CMS → outro aparelho vê media/cue na sessão de treino
- Lookup e-mail → Resync / Liberar / Revogar grava `admin_audit_log`
- Admin entra **sem** precisar de `accessGranted` no app atleta

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
