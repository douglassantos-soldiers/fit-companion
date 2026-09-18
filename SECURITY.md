# Segurança operacional

## Rotacionar secrets se `.env` vazou

1. Shopify Admin → Apps → seu app → **API credentials** → **Admin API access token** → regenerar.
2. Atualizar `SHOPIFY_ADMIN_ACCESS_TOKEN` no host (Lovable / `.env` local) — **nunca** comitar.
3. Regenerar `SHOPIFY_WEBHOOK_SECRET` e `ACCESS_SESSION_SECRET` (ou `OPENAI_API_KEY` se usado como fallback de assinatura).
4. Confirmar que `.env` está no `.gitignore` (já configurado).

## Gate de acesso

Após compra verificada, o servidor grava cookie HttpOnly `soldiers_access` (HMAC), incluindo `userId` quando conhecido.
O client ainda guarda UX state (`accessGranted`), mas o `AccessGate` exige sessão válida no server.

## Dados de domínio / social

Writes de profiles/sessions/meals/social passam por server fns (`sync.functions`, `social-write.functions`) com `service_role`.
Não reabrir policies `USING (true)` para `anon` nas tabelas de domínio.
