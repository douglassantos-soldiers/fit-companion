# AI Gateway — FASE 17 + FASE 22.4

Abstração server-only entre Agents e providers de LLM.  
**O LLM nunca emite Decision final**, não escreve Living Plan, não altera Safety/thresholds e não acessa DB/secrets/SQL.

Produção: ver [`AI_LLM_PRODUCTION.md`](./AI_LLM_PRODUCTION.md).

## Fluxo

```
Agent → AI Gateway (invokeAI)
  → Provider (openai | anthropic | mock[test/dev only])
  → validate (schema + evidence + safety hook)
  → DecisionProposal candidata
  → (caller) Safety → Decision Engine
```

## Princípios

| Regra | Detalhe |
|-------|---------|
| Sem SDK nos Agents | Agents importam só `@/ai/gateway` |
| Default produção | `AI_RUNTIME_MODE=deterministic` |
| Fail-closed | JSON inválido → `invalid_structured_output` |
| Authority | Proposal candidata; Decision Engine decide |
| Secrets | Só `process.env` server-side; nunca `VITE_*` |
| Anti-mock prod | `AI_LLM_ENV=production` → mock proibido (FASE 22.4) |

## Runtime mode

| Mode | Comportamento (`specialist_training`) |
|------|----------------------------------------|
| `deterministic` | Path atual (skills/RAG/tools); gateway não chama provider |
| `hybrid` | Skills + RAG + tools; LLM enriquece analysis/evidence; proposal só se validada; degradar se LLM falhar |
| `llm` | LLM structured + validation; contexto de skills/RAG no prompt; falha observável se provider/schema falhar |

Env: `AI_RUNTIME_MODE=deterministic|llm|hybrid`  
Kill switch: `AI_LLM_ENABLED` / alias `LLM_ENABLED`.

## Providers

| Id | Path | Status |
|----|------|--------|
| `mock` | `src/ai/providers/mock.ts` | Test / dev only — **forbidden in production** |
| `openai` | `src/ai/providers/openai.ts` | Primary — Chat Completions via `fetch` |
| `anthropic` | `src/ai/providers/anthropic.ts` | Fallback B — Messages API via `fetch` |
| `google` | stub | Fora do path de produção |

Env: `AI_PRIMARY_PROVIDER` (default `openai`), `AI_FALLBACK_PROVIDER` (real only in prod; **no default mock**).

## Structured output (LLM → Agent)

```ts
{
  analysis: unknown;
  evidence: SkillEvidenceItem[];
  confidence: number; // 0..1
  proposal: null | {
    proposed_type: string;
    proposed_value: string | number | boolean;
    reason_codes: string[];
    confidence: number;
  };
}
```

Bridge: `makeSkillProposal` → `toDecisionProposalFromSkill` → Decision Engine (fora do gateway).

## Limites

- `max_tokens`, `timeout_ms`, `max_cost` por agent (`src/ai/gateway/config.ts`)
- Exceder → `cost_limit` / `timeout` observável; **não** inventa proposal
- Retry: só erros recuperáveis (`rate_limit`, `timeout`, `upstream`); max 2
- Sem retry: `unauthorized`, `invalid_request`, `safety_rejection`, `cost_limit`, `invalid_structured_output`

## O que o LLM **não** pode fazer

- Emitir `Decision` final
- Escrever Living Plan / Memory
- Alterar Safety / thresholds / gates
- Acessar DB, secrets ou SQL
- Pular Safety ou Decision Engine

## API

```ts
import { invokeAI, getAiRuntimeMode } from "@/ai/gateway";

const res = await invokeAI({
  agentId: "specialist_training",
  userId,
  runId,
  userContent: JSON.stringify(context),
});
```

## Audit

`kind: "ai_gateway"` + mirror em `AgentRun.metadata`: `provider`, `model`, `prompt_version`, `token_usage` / `input_tokens` / `output_tokens`, `estimated_cost`, `runtime_mode`.

## Testes

`src/ai/gateway/gateway.test.ts` — mock generate, schema, retry, cost, fallback, deterministic skip, hybrid training.
