# AI Governance Console — FASE 19

Console interna de **observabilidade** em `/governance/*`.  
Não altera Decision Engine, Safety thresholds, Living Plan nem Learning.

## Acesso

- Cookie admin (`soldiers_admin`) — mesmos credentials de `/admin`
- Roles: `admin` | `editor` | `support` | `analyst`
- `PUBLIC_PATHS` inclui `/governance` (AccessGate)
- Server fns: [`src/lib/governance-console.functions.ts`](../src/lib/governance-console.functions.ts) com `requireAdminSession`

## Rotas

| Path | Conteúdo |
|------|----------|
| `/governance` | redirect → overview |
| `/governance/overview` | KPIs (runs, success/error/safety, tools, RAG, latency, cost, tokens, decisions) |
| `/governance/agents` | Stats por agent (runs, latency, errors, cost, success) |
| `/governance/runs` | Lista + timeline Agent→…→Outcome |
| `/governance/decisions` | Decision trace + outcomes + learning (read-only) |
| `/governance/safety` | Blocks / authz / invalid proposals / blocked tools |
| `/governance/rag` | Retrievals, scores, failures |
| `/governance/cost` | Provider/model/tokens/estimated; cost/user|/agent|/decision |
| `/governance/evaluation` | Eval suite v1 + report v2 (`runAiEvaluationV2`) |

## Privacy

- `redactForAudit` / `redactAuditForConsole` na borda da API
- `user_id` truncado (`user_****xxxx`)
- Sem API keys / secrets / service_role
- Sem mutação de Decision / Learning pela UI

## Performance

- `loadAuditsAdmin` paginado (limit ≤ 200, cursor por `created_at`)
- Filtros: since/until/kind/agent/status/user/model
- Fallback memory ring se DB indisponível (`source: memory|db|unavailable`)

## Migration

`supabase/migrations/20261028120000_fase19_ai_audit_kinds.sql` — CHECK kinds inclui `ai_gateway` e `proposal_merge`.

## O que a UI **não** pode fazer

- Alterar lógica do Decision Engine
- Escrever Living Plan
- Editar Learning signals / thresholds
- Expor secrets
