# Performance Hardening — FASE 0 Baseline

**Data:** 2026-09-30  
**HEAD workspace:** `27607d3a8a66e23323ca46e77c9b8586c926af16`  
**HEAD citado na auditoria:** `5cada28d…` — objeto **inexistente** neste clone (`fatal: bad object`).  
**Branch:** `main` (ahead of `origin/main` no momento do baseline)

Métricas públicas da auditoria (não re-medidas nesta fase; baseline de referência):

| Métrica | Valor auditado |
|---------|----------------|
| TTFB | ~1.142 ms |
| FCP | ~1.840 ms |
| Recursos | 225 |
| JS transfer / decoded | ~470 KB / ~1,49 MB |
| CSS decoded | ~808 KB |

---

## Comandos executados

| Comando | Resultado | Notas |
|---------|-----------|--------|
| `npm run typecheck` | **PASS** | exit 0 |
| `npm run lint` | **FAIL (pré-existente)** | ~68.808 problems (68.777 errors, 31 warnings) — quase todos `prettier/prettier` |
| `npm run test` | **FAIL (pré-existente)** | 10 failed / 1055 passed (138 files: 6 failed, 132 passed) |
| `npm run build` | **PASS** | exit 0 |
| `npm run test:e2e` | **PASS** | 5 passed, 3 skipped |

### Falhas de teste pré-existentes (não corrigidas na FASE 0)

1. `src/lib/soldiers-media-governance.test.ts` — 4 fails (resolve priority / CMS)
2. `src/lib/soldiers-media.test.ts` — 1 fail (coverage by kind)
3. `src/ai/certification/run-production-certification.cli.test.ts` — 1 fail
4. `src/ai/gateway/gateway.test.ts` — 2 fails (hybrid training / llm mode)
5. `src/ai/skills/skills.test.ts` — 1 fail (19 required skills)
6. `src/lib/training/deep-training.test.ts` — 1 fail (deload week)

---

## Arquitetura atual

| Camada | Escolha |
|--------|---------|
| Framework | TanStack Start + Vite SSR (`src/server.ts`) |
| Router | TanStack Router file-based (`src/router.tsx`, `src/routes/__root.tsx`) |
| Estado | Context monolítico ~2.2k LOC (`src/lib/store.tsx`), key `soldiers-os-v1` |
| TanStack Query | Provider montado; **0** `useQuery` / `useMutation` |
| Server | ~107 `createServerFn`; sync em `sync.server.ts` |
| Auth | Supabase `getAuthSession` + cookie Shopify `checkAccessSession` |
| UI global | MUI + Mantine (`ui-providers.tsx`); HeroUI CSS; AnimatePresence `key={pathname}` |

Provider tree:

```
QueryClientProvider → StoreProvider → UiProviders → AccessGate → AnimatePresence → Outlet
```

---

## Confirmação P0 (código no HEAD atual)

| ID | Problema | Status | Arquivo principal |
|----|----------|--------|-------------------|
| P0-1 | AccessGate revalida auth+access a cada `pathname` | **CONFIRMADO** | `src/components/access-gate.tsx` |
| P0-2 | Store bootstrap: `ensureIdentity` → `pullState` (depois decision/patterns) | **CONFIRMADO** | `src/lib/store.tsx` |
| P0-3 | `pullStateServer` + 11× `select("*")` em `pullForUserId` | **CONFIRMADO** | `src/lib/sync.server.ts` |
| P0-4 | Status via `resolveTrustedIdentity` — **41** call sites | **CONFIRMADO** | `src/lib/session-identity.server.ts` |

---

## Próximo passo

FASE 1 — AccessSessionProvider + AccessGate sem revalidação por rota.
