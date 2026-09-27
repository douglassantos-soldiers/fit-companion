# AI Gateway — FASE 17

Abstração server-only entre Agents e providers de LLM.  
**O LLM nunca emite Decision final**, não escreve Living Plan, não altera Safety/thresholds e não acessa DB/secrets/SQL.

## Fluxo

```
Agent → AI Gateway (invokeAI)
  → Provider (mock | openai | anthropic* | google*)
  → validate (schema + evidence + safety hook)
  → DecisionProposal candidata
  → (caller) Safety → Decision Engine
```

\* Anthropic/Google = stubs `not_configured` nesta fase.

## Princípios

| Regra | Detalhe |
|-------|---------|
| Sem SDK nos Agents | Agents importam só `@/ai/gateway` |
| Default produção | `AI_RUNTIME_MODE=deterministic` |
| Fail-closed | JSON inválido → `invalid_structured_output` |
| Authority | Proposal candidata; Decision Engine decide |
| Secrets | Só `process.env` server-side (`OPENAI_API_KEY`); nunca `VITE_*` |

## Runtime mode

| Mode | Comportamento (`specialist_training`) |
|------|----------------------------------------|
| `deterministic` | Path atual (skills/RAG/tools); gateway não chama provider |
| `hybrid` | Skills + RAG + tools; LLM enriquece analysis/evidence; proposal só se validada; degradar se LLM falhar |
| `llm` | LLM structured + validation; contexto de skills/RAG no prompt; falha observável se provider/schema falhar |

Env: `AI_RUNTIME_MODE=deterministic|llm|hybrid`

## Providers

| Id | Path | Status |
|----|------|--------|
| `mock` | `src/ai/providers/mock.ts` | Determinístico / testes |
| `openai` | `src/ai/providers/openai.ts` | Chat Completions via `fetch` |
| `anthropic` | stub | `not_configured` |
| `google` | stub | `not_configured` |

Env: `AI_PRIMARY_PROVIDER`, `AI_FALLBACK_PROVIDER` (default fallback `mock`).

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
