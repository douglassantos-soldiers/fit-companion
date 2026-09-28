# AI Mock Policy — FASE 22.5

Mock LLM providers must never be interpretable as real AI in production.

## Classification

| Context | Mock LLM allowed? |
|---------|-------------------|
| **PRODUCTION** | **No** — `ProductionMockProviderError` |
| **TEST** (`VITEST` / `AI_LLM_ENV=test`) | Yes |
| **DEVELOPMENT** | Yes (local only) |
| **EVAL** (golden fixtures) | Yes (fixtures only) |

Related (not Mock LLM, already hardened):

| Store | Production |
|-------|------------|
| InMemory RAG | Forbidden (FASE 22.2) |
| InMemory Memory | Forbidden (FASE 22.3) |

## Rules

1. Agents never call providers directly — only `@/ai/gateway`.
2. `provider === "mock"` in production → throw `ProductionMockProviderError` (`PRODUCTION_MOCK_FORBIDDEN`).
3. Fallback on real provider failure:
   - Provider B (e.g. Anthropic), **or**
   - Deterministic runtime, **or**
   - Explicit degraded/error  
   Never Mock.
4. Any non-LLM / deterministic response must expose:
   - `execution_mode`
   - `provider` (`"none"` / `"coach_deterministic"` when no LLM)
   - `model` (`"deterministic_runtime"` when skip)
   - `status` (`ok` \| `error` \| `degraded` \| `aborted` \| `fallback`)

## Guards

| Layer | Mechanism |
|-------|-----------|
| Runtime | `assertProviderAllowedInEnv` / `getProvider("mock")` throw |
| Unit | `src/ai/gateway/production_mock_guard.test.ts` |
| CI static | `npm run guard:ai-mock` → `scripts/ai-production-mock-guard.mjs` |
| Workflow | `.github/workflows/ai-eval.yml` runs guard before eval |

## Ops

Always set on production hosts:

```bash
AI_LLM_ENV=production
NODE_ENV=production
# AI_FALLBACK_PROVIDER=anthropic   # real only; never mock
```

Kill switch: `AI_LLM_ENABLED=0` or `LLM_ENABLED=0` → deterministic (not mock).

## Tests import Mock

```ts
import { getMockAIProvider } from "@/ai/providers/mock"; // tests only
```

Do **not** re-export Mock helpers from `@/ai/providers` product barrel.

## Verificação (FASE 22.5)

| Item | Resultado |
|------|-----------|
| `npm run guard:ai-mock` | **PASS** (191 files) |
| `production_mock_guard.test.ts` + gateway + certification | **PASS** |
| Workflow `ai-eval.yml` step | Wired locally (runs on push/PR to `src/ai/**`) |

**Veredicto: PASS** — mock isolado; production throw; CI static guard verde; labels presentes.

See also [`AI_LLM_PRODUCTION.md`](./AI_LLM_PRODUCTION.md).
