# Security Audit — Identity / AuthZ (pré-AI)

**Data:** 2026-09-23  
**Escopo:** authentication, Supabase Auth linkage, user_id, device_id, sessions, RLS, storage, server functions, admin, service_role, social/training/nutrition/recovery/commerce/entitlements.  
**Fora de escopo:** runtime de Agents (apenas contratos preparados).

## Veredito

A identidade confiável está consolidada em `resolveTrustedIdentity()` com cookie `soldiers_access` como autoridade. `device_id` é canal/provenance. Cookie admin **não** autentica app user. Membership social passou a validar por `user_id`. Defense-in-depth RLS FASE2 adiciona `private.current_app_user_id()` e view pública de feed.

## Matriz de acesso

| Classe | Quem | Ownership |
|--------|------|-----------|
| PUBLIC | anon/auth | sem PII; preferir `activity_events_public` |
| USER_PRIVATE | dono (cookie) | `resource.userId === identity.userId` |
| SOCIAL | user + membership | club/challenge por **user_id** |
| COMMERCE | dono / system | entitlement server-side |
| ADMIN | admin\|editor\|support\|analyst | `requireAdminSession` |
| SYSTEM | service_role / cron / webhooks | nunca client |
| ANALYTICS | admin / analyst | write server |

Implementação: `src/lib/security-access-matrix.ts`.

## Achados (antes → depois)

| Severidade | Achado | Mitigação |
|------------|--------|-----------|
| HIGH | Admin cookie virava app session em `resolveTrustedIdentity` | Usa só `readAccessSession()` |
| HIGH | Club/challenge AuthZ por `device_id` | Helpers `*ByUser` + queries por `user_id` |
| HIGH | meal-ai / barcode / wearables só cookie, sem device bind | `resolveTrustedIdentity({ requireAccess: true })` + `deviceId` |
| MEDIUM | JWT ownership policies inertes (`users` sem SELECT) | `private.current_app_user_id()` SECURITY DEFINER |
| MEDIUM | Feed SELECT expõe `device_id` | View `activity_events_public` |
| MEDIUM | `DEPLOY_*.sql` reabre USING(true) | Warnings no cabeçalho |
| LOW | Contratos AI com `user_id: string` sem origem | `TrustedUserId` + `auditFromIdentity` |

## Policies / migration alteradas

- Nova: `supabase/migrations/20261017120000_fase2_identity_authz_defense.sql`
  - `private.current_app_user_id()`
  - policies `*_owner_*_v2` em tabelas USER_PRIVATE com `user_id`
  - view `activity_events_public`
  - revoke idempotente social/commerce/admin/analytics
  - storage checkins: read público, sem write anon
- Warnings: `supabase/DEPLOY_ALL.sql`, `supabase/DEPLOY_PENDING_HUBS.sql`

**Nota:** projeto Fit Companion não estava no MCP Supabase desta sessão — migration versionada no repo; aplicar via CLI/Lovable.

## Arquivos modificados (principais)

- `src/lib/session-identity.server.ts` — TrustedIdentity expandida
- `src/lib/access-session.server.ts` — `deriveAccessSessionId` / `readAccessSessionToken`
- `src/lib/security-access-matrix.ts` — novo
- `src/lib/security-authz.ts` — helpers por user_id
- `src/lib/social-write.server.ts` / `social-read.server.ts` — membership user_id
- `src/lib/meal-ai.functions.ts` / `meal-ai-contract.ts`
- `src/lib/nutrition/barcode.functions.ts`
- `src/lib/wearables/wearable.functions.ts`
- Callers: `meal-picker-sheet.tsx`, `wearable-providers.tsx`, `wearables.callback.tsx`
- `src/ai/contracts/trusted-user-id.ts`, agent-run/tool-call/skill-run, governance
- `SECURITY.md`, `docs/AI_ARCHITECTURE.md`
- Testes: `fase1-security-authz.test.ts`, `session-identity.authz.test.ts`, `v2-meal.smoke.test.ts`

## Testes adicionados

- User A → User B (USER_PRIVATE deny)
- Device ≠ ownership
- Club A → Club B
- Challenge A → Challenge B
- Admin vs normal user
- Anonymous → USER_PRIVATE / SOCIAL deny
- Admin token ≠ access session
- `TrustedUserId` / `auditFromIdentity`

## Regras para Agents/Tools futuros

1. Sempre `const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true })`.
2. `user_id` em contratos = `asTrustedUserId(toTrustedUserId(identity))`.
3. `assertResourceAccess(identity, accessClass, resource)` antes de ler/escrever.
4. Nunca confiar em `userId` / `deviceId` do body para ownership.
5. Admin ops: `requireAdminSession`, não o resolver de app.

## Verificação

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | Falha **pré-existente** no repo (centenas de erros em catalog/joints/store/etc.). **Zero** erros nos arquivos AuthZ desta entrega. |
| `npm run lint` | Arquivos AuthZ desta entrega limpos (`eslint --fix` aplicado). Lint global do repo tem ruído pré-existente. |
| `npm run test` | **571 passed**; 5 failed em `soldiers-media*` (pré-existente, fora do escopo). AuthZ: 65+ testes verdes incluindo matriz IDOR. |
| `npm run build` | **OK** (vite + nitro cloudflare-module). |

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```
