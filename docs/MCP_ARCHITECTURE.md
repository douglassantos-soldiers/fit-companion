# MCP / Tool Layer — Performance OS

Camada interna de Tools (MCP-compatible). O protocolo MCP (JSON-RPC / transport) pode ser colocado **por cima** desta camada depois — o domínio não deve depender do wire protocol.

## Princípio

```
Agent / Caller
  → invokeTool
  → Authentication (TrustedUserId)
  → Authorization (tool + IDOR check)
  → Input Validation (fail-closed)
  → Safety gate (quando required; WRITE futuro)
  → Handler (Domain / Application APIs)
  → Database (somente via hydrate / engines existentes)
```

**Nunca:** `Agent → Database`.

Coach allowlist atual: [`src/lib/coach/tools.ts`](../src/lib/coach/tools.ts) — permanece até migração gradual para esta camada.

## Estrutura

```
src/ai/mcp/
  core/          registry, auth, validate, invoke, ToolCall log
  user/          get_user_profile, get_user_goal
  training/      get_current_plan, get_training_history, get_training_session
  nutrition/     get_nutrition
  recovery/      get_sleep, get_recovery
  wearable/      get_wearable_data
  commerce/      get_orders, get_products
  decision/      get_recent_decisions, get_recent_outcomes
  social/        placeholder
  write/         stubs validate + write_not_enabled
```

## READ vs WRITE

| Class | Comportamento nesta fase |
|-------|---------------------------|
| **READ** | Invocável com sessão autenticada; handlers leem Context / state / catálogo |
| **WRITE** | Schema + validação; `invokeTool` **sempre** nega com `write_not_enabled` |

## ToolCall (auditoria)

Cada invoke gera `ToolCall` com:

- `user_id` (trusted)
- `tool` / `tool_id`
- `input_hash` (input redacted)
- `status`, `latency_ms`, `error_code`
- `created_at` / `finished_at`

Args sensíveis (`token`, `password`, …) são redacted. Log em memória (ring buffer) via `listToolCalls` — sem secrets.

## API

```ts
import { invokeTool, registerAllMcpTools, listReadTools } from "@/ai/mcp";

const result = await invokeTool({
  toolId: "get_recovery",
  trustedUserId, // from resolveTrustedIdentity — never client body
  input: { date: "2026-03-11" },
});
```

## Relação com Context / Decision

Handlers preferem `getPerformanceContext` / snapshot já montado (via domain loader). Decisions vêm do Decision Engine — Tools **não** emitem Decision.

Ver [CONTEXT_ENGINE.md](./CONTEXT_ENGINE.md), [DECISION_ENGINE.md](./DECISION_ENGINE.md), [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md).

## Roadmap

1. Tool Layer interno (**esta fase**)
2. Protocolo MCP transport (stdio/HTTP) wrapping `invokeTool`
3. Skills / Agents consumindo o registry
4. WRITE tools reais → DecisionProposal → Decision Engine (nunca DB direto)

## Testes

`src/ai/mcp/mcp-tools.test.ts` — anonymous, authenticated, cross-user, invalid input, unauthorized tool, malformed output, timeout, write deny, catálogo explícito das 13 READ, redaction de secrets.
