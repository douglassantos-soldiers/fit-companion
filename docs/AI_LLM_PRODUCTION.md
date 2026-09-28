# AI LLM Production — FASE 22.4

Production LLM runtime hardening for Performance OS. LLM produces **analysis / evidence / confidence / DecisionProposal** only — never Decision, Living Plan, or Safety mutation.

## Absolute rules

1. Agents never call providers directly — only `@/ai/gateway` (`invokeAI`).
2. All LLM calls pass through the AI Gateway.
3. **Mock is forbidden in production** (primary or fallback). See [`AI_MOCK_POLICY.md`](./AI_MOCK_POLICY.md) (FASE 22.5: `ProductionMockProviderError` + CI `guard:ai-mock`).
4. LLM never writes Decision / Living Plan / Safety / Memory.
5. Decision Engine remains authority.

## Environments

| Env | Detection | Mock |
|-----|-----------|------|
| **TEST** | `VITEST` / `AI_LLM_ENV=test` | Allowed |
| **DEVELOPMENT** | default / `AI_LLM_ENV=development` | Allowed |
| **PRODUCTION** | `NODE_ENV=production` or `AI_LLM_ENV=production` | **Forbidden** |

## Providers

| Id | Role | Status |
|----|------|--------|
| `openai` | **Primary** (default) | Chat Completions via `fetch` |
| `anthropic` | Fallback B (optional) | Messages API via `fetch` when `ANTHROPIC_API_KEY` |
| `google` | Stub | Not production path |
| `mock` | Tests / dev only | Blocked in production |

Env:

- `AI_PRIMARY_PROVIDER` — default `openai` (production rejects `mock`)
- `AI_FALLBACK_PROVIDER` — real provider only in production; `mock` is **omitted**
- `AI_OPENAI_MODEL` / `AI_ANTHROPIC_MODEL`
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — server-side only (never `VITE_*`)

## Fallback policy

```
Provider A (openai) → Provider B (anthropic)   ✅ allowed
LLM failure → hybrid degrade / deterministic   ✅ allowed
LLM failure → Mock                             ❌ never in production
```

## Runtime modes

| Mode | Behavior |
|------|----------|
| `deterministic` | No provider call; specialists use skills/RAG/tools |
| `hybrid` | Skills + RAG; LLM enriches; on LLM fail → deterministic aggregation |
| `llm` | Structured LLM required; fail observable (no invented proposal) |

Env: `AI_RUNTIME_MODE=deterministic|hybrid|llm`

## Kill switch

- `AI_LLM_ENABLED=0|false` (canonical)
- Alias: `LLM_ENABLED=0|false`
- Also: `AI_FORCE_DETERMINISTIC=1`, `AI_ENABLED=0`

When LLM disabled: specialists continue via **deterministic** runtime.

## Cost limits (in-process)

| Scope | Env | Default |
|-------|-----|---------|
| Per request | agent `max_cost` | `$0.05` |
| Per user / day | `AI_COST_USER_DAY` | `$2` |
| Per run | `AI_COST_RUN_MAX` | `$0.5` |
| Process / day | `AI_COST_DAY_MAX` | `$50` |

Exceed → `cost_limit` (no proposal). Multi-instance: document in runbook (not distributed).

## Reliability

- **Timeout**: per-agent `timeout_ms` (default 20s) via AbortController
- **Retry**: max 2; only `rate_limit` / `timeout` / `upstream`
- **Circuit breaker**: per provider; `AI_CB_FAILURE_THRESHOLD` (default 5), `AI_CB_COOLDOWN_MS` (60s). Open ≠ mock fallback.

## Observability (audit)

Every gateway call records (no secrets):

`request_id`, `provider`, `model`, `input_tokens`, `output_tokens`, `cached_tokens`, `latency_ms`, `estimated_cost`, `actual_cost` (when available), `status`

## Health

```ts
import { checkLlmHealth, checkLlmLiveProbe, getLlmReadiness } from "@/ai/gateway";

const health = await checkLlmHealth();
const { LLM_READY, reasons } = await getLlmReadiness();
// Optional live generate: AI_LLM_LIVE_PROBE=1
```

Certification item **LLM Gateway** is **critical**, default `pending` until probed.

## Schema → DecisionProposal

Validated JSON → `{ analysis, evidence, confidence, proposal }` → optional `DecisionProposal` candidate.  
**Never** a final `Decision`.

## Critério PASS / BLOCKED

| Item | PASS | BLOCKED |
|------|------|---------|
| Código + testes | Hardening completo, mock-forbidden, fallback A→B | — |
| Live provider | `OPENAI_API_KEY` + health/live probe verde | Key ausente ou probe falhou |

**Nunca** declarar produção pronta sem teste real do provider.

### Evidência live (FASE 22.4)

| Probe | Resultado |
|-------|-----------|
| `OPENAI_API_KEY` em `.env` | **Ausente** |
| `checkLlmLiveProbe` / live generate | Não executado (sem key) |
| Testes unitários `llm-hardening` + `gateway` | **32/32 PASS** |

**Veredicto live: BLOCKED** — código e testes locais PASS; provider real não verificado nesta sessão.

Ver também [`AI_GATEWAY.md`](./AI_GATEWAY.md).
