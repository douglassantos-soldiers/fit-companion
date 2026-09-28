# AI Rate Limiting (FASE 22.10)

Rate limiting **distribuído** para a stack AI — sem depender de Map in-process por instância.

**Storage:** Supabase Postgres (`ai_rate_limit_buckets` + RPC `ai_rate_limit_consume`). Sem Redis.

## Como rodar

```bash
npm run ai:rate-limit
```

Artifact: `docs/certification/rate-limit-readiness.json`

Sem `SUPABASE_SERVICE_ROLE_KEY`: `verdict: BLOCKED`, `error_code: RATE_LIMIT_VERIFICATION_BLOCKED` (esperado).

## Scopes

| Scope | Key | Env default |
|-------|-----|-------------|
| user | `ai:user:{id}` | `AI_RL_USER_RPM=30` |
| ip | `ai:ip:{hash}` | `AI_RL_IP_RPM=60` |
| session | `ai:session:{id}` | `AI_RL_SESSION_RPM=40` |
| agent | `ai:agent:{id}` | `AI_RL_AGENT_RPM=60` |
| tool | `ai:tool:{id}` + `ai:user:{id}:tools` | `AI_RL_TOOL_RPM=90` |
| llm | `ai:llm:req:{user}` / `ai:llm:cost:{user}` | `AI_RL_LLM_RPM=20`, `AI_RL_LLM_COST_PER_MIN=50` |
| rag | `ai:rag:{user}` | `AI_RL_RAG_RPM=40` |
| api | `ai:api:{key}` | `AI_RL_API_RPM=60` (+ coach `COACH_RPM`/`COACH_RPD`) |
| admin | `ai:admin:{email}` | 8 / 15 min |
| cost | `ai:cost:user/run/day` | `AI_COST_USER_DAY` / `RUN_MAX` / `DAY_MAX` (micro-USD) |

## Atomicidade + TTL

RPC `ai_rate_limit_consume(p_key, p_limit, p_window_ms, p_amount, p_peek)`:

- Incremento atômico só se `count + amount <= limit`
- Janela fixa com `expires_at` (TTL); reset automático ao expirar
- `p_peek=true` para budgets de custo (check sem consumir)

## Headers

Em deny: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`  
(gateway metadata / coach `rate_limit_headers` + status 429).

## Kill switch

- `AI_RL_DISABLED=1` — **não enforce** (escape hatch; risco documentado)
- Store down em produção (`AI_RL_BACKEND=supabase` / `NODE_ENV=production`) → **fail-closed** (deny)
- `AI_FORCE_DETERMINISTIC=1` continua cortando LLM; RL ainda protege tools/RAG/API

## Wire (anti-bypass)

Mesmo store em: gateway LLM, `invokeTool`, `runSpecialistAgent`, `retrieveKnowledge`, coach API, admin login.

**Git ≠ applied:** migration `20261101120000_fase22_10_ai_rate_limits.sql` no Git não prova RPC remoto.

## PASS / BLOCKED

| Verdict | Quando |
|---------|--------|
| **PASS** | Migration local + lógica local + RPC remoto OK |
| **BLOCKED** | Sem service_role / RPC ausente |
| **FAIL** | Migration local ausente ou lógica local quebrada |

## Ver também

- [AI_PRODUCTION_RUNBOOK.md](./AI_PRODUCTION_RUNBOOK.md)
- [AI_CI_CD_GATES.md](./AI_CI_CD_GATES.md)
- [AI_ARCHITECTURE_FINAL.md](./AI_ARCHITECTURE_FINAL.md)
- [AI_DATABASE_READINESS.md](./AI_DATABASE_READINESS.md)
