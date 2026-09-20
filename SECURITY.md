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

## Gate de acesso

Após compra verificada, o servidor grava cookie HttpOnly `soldiers_access` (HMAC), incluindo `userId` quando conhecido.
O client ainda guarda UX state (`accessGranted`), mas o `AccessGate` exige sessão válida no server.
Entitlements: escrita apenas server-side (`service_role`). Client não lê/escreve `app_entitlements`.

## Dados de domínio / social

Ownership canônica = `user_id` (public.users). `device_id` é apenas canal/provenance.
Writes de profiles/sessions/meals/social passam por server fns com `service_role` e sessão cookie.
Leituras sensíveis de usuários vinculados exigem access session (`requireAccessIfLinked`).
RLS: anon sem acesso ao domínio; `authenticated` só vê/escreve rows do próprio `user_id` (via `auth_user_id`).
Não reabrir policies `USING (true)` para `anon` nas tabelas de domínio.

## Admin Console (`/admin`)

- Auth: `ADMIN_PIN` (server-only) → cookie HttpOnly `soldiers_admin` (HMAC com `ACCESS_SESSION_SECRET`, TTL 12h).
- Todas as mutações (CMS, grant/revoke, resync) exigem `requireAdminSession()` no server.
- Grant/revoke manual é exceção de suporte: grava `app_entitlement_emails` / limpa devices e sempre registra `admin_audit_log`.
- `cms_overrides` e `admin_audit_log` são **service_role only** (sem SELECT anon). Leitura pública do CMS passa por server fn `getPublicCms`.
- Não exponha `ADMIN_PIN` com prefixo `VITE_`. Rotacione o PIN se vazar.
- Logout: `logoutAdmin` limpa o cookie.
