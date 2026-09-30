# `@ts-nocheck` inventory (critical areas)

Measured after P1-10 pass (2026-09-30). Do not add new `@ts-nocheck` in auth, sync, security, or coach runtime without a dated justification.

## Removed in this gap pass

- `src/lib/orders.server.ts`
- `src/routes/hubs.$slug.tsx`

## Remaining (documented debt — P2)

| File | Why still nocheck |
|------|-------------------|
| `src/routeTree.gen.ts` | Generated — do not edit |
| `src/routes/coach.tsx` | Dense UI + AI types; needs incremental typing |
| `src/routes/onboarding.tsx` | Large form state |
| `src/ai/runtime/production-runtime.ts` | Gradual AI typing |
| `src/ai/runtime/authoritative-bridge.ts` | Gradual AI typing |
| `src/ai/agents/runtime/run-specialist.ts` | Gradual AI typing |
| `src/ai/gateway/audit.ts` | Gradual AI typing |
| `src/lib/governance-console.functions.ts` | Large admin surface |
| `src/features/governance/*-page.tsx` | Admin UI |
| `src/lib/customer360/hydrate.server.ts` | Wide row maps |
| `src/lib/coach/workflows/*` | Legacy coach |
| Various `*.test.ts` | Test fixtures |

CI still runs `tsc --noEmit` project-wide; nocheck only skips those files.
