# Segurança operacional

## Rotacionar secrets se `.env` vazou

1. Shopify Admin → Apps → seu app → **API credentials** → **Admin API access token** → regenerar.
2. Atualizar `SHOPIFY_ADMIN_ACCESS_TOKEN` no host (Lovable / `.env` local) — **nunca** comitar.
3. Regenerar `SHOPIFY_WEBHOOK_SECRET` e `ACCESS_SESSION_SECRET` (secrets distintos — nunca compartilhar).
4. Confirmar que `.env` está no `.gitignore` (já configurado).

## Access session (fail closed)

- Produção **exige** `ACCESS_SESSION_SECRET`. Sem ele o servidor aborta (`assertSecurityConfiguration`).
- Nunca usar `SHOPIFY_WEBHOOK_SECRET`, `OPENAI_API_KEY` ou literais conhecidos como fallback de assinatura.
- Dev local: defina `ACCESS_SESSION_SECRET` ou `ALLOW_INSECURE_DEV_SECRETS=true` (somente fora de produção).

## Gate de acesso (FASE 1)

Após compra verificada, o **webhook Shopify** ou **admin grant** grava `app_entitlement_emails`.
`establishAccessSession` **não cria** entitlement a partir do e-mail digitado no client — só emite cookie + attach de device se a row já existir e a janela de 40 dias for válida.
Alternativa: redeem de magic token gerado no webhook.
O client ainda guarda UX state (`accessGranted`), mas o `AccessGate` exige sessão válida no server.
Entitlements: escrita apenas server-side (`service_role`). Client não lê/escreve `app_entitlements`.

## Dados de domínio / social (FASE 1 + FASE 2)

Ownership canônica = `user_id` (public.users). `device_id` é apenas canal/provenance — **nunca** autoridade de AuthZ.
Writes de profiles/sessions/meals/social passam por server fns com `service_role` e `resolveTrustedIdentity`.
Leituras sociais sensíveis (clubs, league, leaderboard, stories) passam por server fns — RLS revoga SELECT anon nessas tabelas.
Membership de club/challenge: validada por **user_id** (fallback legado `device_id` só se `user_id` null).
`activity_events`: SELECT anon apenas `visibility = public`; preferir view `activity_events_public` (sem `device_id`).
Challenge progress: `recorded_value` / `eligible_value` / `verification_status` — ranking usa elegível.
League: pontos calculados no server a partir de sessões; `points` do client é ignorado.
Storage `checkins`: writes só `service_role` (upload via server fn); read público para URLs existentes.
JWT ownership: `private.current_app_user_id()` (FASE2) — policies USER_PRIVATE usam o helper, não subquery em `users`.
Não reabrir policies `USING (true)` para `anon` nas tabelas de domínio/social.
**Nunca** reexecutar `DEPLOY_ALL.sql` / `DEPLOY_PENDING_HUBS.sql` após harden.

## Identidade confiável (`resolveTrustedIdentity`)

- Cookie `soldiers_access` é autoritativo para `userId` / email / tier / `sessionId`.
- Cookie **admin** (`soldiers_admin`) **não** autentica identidade de app; use `requireAdminSession`.
- Admin + access com o mesmo email pode enriquecer `role` na identidade (metadado); sozinho não basta.
- Anônimo (`ensureUserForDevice`) só para boot local — writes sensíveis exigem `requireAccess: true`.
- Matriz: PUBLIC | USER_PRIVATE | SOCIAL | COMMERCE | ADMIN | SYSTEM | ANALYTICS — ver `src/lib/security-access-matrix.ts`.
- Relatório: `docs/security-audit-identity-ai.md`.

## Admin Console (`/admin`)

- Auth: `ADMIN_PIN` / `ADMIN_PASSWORD` (server-only) **ou** Supabase Auth com `app_metadata.role` ∈ `admin|editor|support|analyst` → cookie HttpOnly `soldiers_admin` (HMAC, TTL 12h).
- PIN legado continua emitindo role `admin`.
- Mutações exigem `requireAdminSession([...roles])` no server (`assertAdmin` → admin/editor/support).
- Grant/revoke manual: grava `app_entitlement_emails` / limpa devices e registra `admin_audit_log` com e-mail do actor.
- `cms_overrides` e `admin_audit_log` são **service_role only**. Leitura pública do CMS passa por server fn `getPublicCms`.
- Não exponha `ADMIN_PIN` com prefixo `VITE_`. Rotacione o PIN se vazar.
- Logout: `logoutAdmin` limpa o cookie.
- Admin cookie **não** substitui access session para meal-ai / wearables / sync / social.

## Cron / push

- `sendDailyPushesFn` exige `CRON_SECRET` no body **ou** sessão admin — nunca público sem secret.
