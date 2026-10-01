# Performance Hardening — FASE 1 (AccessGate)

**HEAD base:** ver [`PERFORMANCE_FASE0_BASELINE.md`](./PERFORMANCE_FASE0_BASELINE.md)  
**Data:** 2026-09-30

## Problema

`AccessGate` reexecutava `getAuthSession` + `checkAccessSession` em **cada mudança de pathname**, com splash enquanto `ready` era resetado.

## Alteração

| Arquivo | Mudança |
|---------|---------|
| `src/lib/access-session-cache.ts` | TTL helpers (`STALE_MS=90s`), switch de user |
| `src/components/access-session-provider.tsx` | Bootstrap 1×; cache; `onAuthStateChange`; visibility revalidate; `invalidate` / `revalidate` |
| `src/components/access-gate.tsx` | Só política/redirect/UI; **sem** fetch por rota |
| `src/routes/__root.tsx` | `AccessSessionProvider` envolvendo o gate |
| `src/lib/auth.ts` | `signOutAuth` invalida cache |
| `src/lib/store.tsx` | Após `establishAccessSession` ok → `revalidate({ force })` |
| `src/routes/acesso.tsx` / `perfil.tsx` | Revalidate após admin grant / logout+clear cookie |
| `src/lib/access-session-cache.test.ts` | Unit tests TTL / user switch |

## Evidência antes / depois (chamadas client)

| Cenário | Antes | Depois |
|---------|-------|--------|
| 4 navegações autenticadas (`/treino`→`/nutricao`→`/progresso`→`/social`) no TTL | 4× `getAuthSession` + 4× `checkAccessSession` | **0** revalidações por rota (só bootstrap da sessão) |
| Tab focus dentro do TTL | N/A (já revalidava por pathname) | skip (`shouldSkipRevalidate`) |
| Tab focus após 90s | — | 1 revalidate em background (sem splash) |
| Logout / troca de user | — | invalidate + force revalidate |
| Grant de acesso (Shopify/admin) | — | force revalidate antes do navigate |

Métricas de laboratório (TTFB/FCP) **não** foram re-medidas nesta fase (sem inventar números). A redução alvo é de **chamadas redundantes de access**, não de LCP ainda.

## Segurança preservada

- Autorização continua em `checkAccessSession` (server / cookie assinado).
- Cache é **session-scoped em memória**; não é fonte privilegiada.
- Conta bloqueada / cookie inválido ainda falham closed no server.
- User switch nunca reutiliza `heldAccess` do usuário anterior.

## Testes

- `npm run typecheck` — PASS (pós-mudança)
- `vitest run src/lib/access-session-cache.test.ts` — 5 PASS
- `npm run test:e2e` — ver execução pós-mudança
- Falhas unitárias pré-existentes da FASE 0 **não** foram “corrigidas” aqui

## Próximo

FASE 2 — cache request/session-scoped de `resolveTrustedIdentity` / account status.
