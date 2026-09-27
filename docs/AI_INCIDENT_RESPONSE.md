# AI Incident Response

Playbook rápido para incidentes da camada AI (FASE 21).

## Severidade

| Nível | Exemplos | Ação imediata |
|-------|----------|----------------|
| SEV-1 | Leak de dados cross-user, authz bypass, secrets em audit | Kill AI + investigar |
| SEV-2 | LLM alucinação em massa, cost runaway, eval regression | Force deterministic |
| SEV-3 | RAG/DB audit unavailable, latency alta | Degrade + monitor |

## Passo 0 — estabilizar

1. `AI_FORCE_DETERMINISTIC=1` (ou `AI_RUNTIME_MODE=deterministic` + `AI_LLM_ENABLED=0`)
2. Redeploy / restart workers se env for runtime-only
3. Confirmar `/governance/overview` e Coach ainda funcionam no path determinístico

Ver [AI_ROLLBACK.md](./AI_ROLLBACK.md).

## LLM provider falhou / comportamento inesperado

1. Force deterministic
2. Checar logs gateway (`ai_gateway` audits, `error_code`)
3. Desabilitar `AI_LLM_ENABLED` até eval verde (`npm run test:eval`)
4. Não reabilitar hybrid/llm sem revisão de Safety + golden dataset

## Cost excedido

1. Force deterministic (para gasto LLM)
2. Revisar `AI_RL_*` e gateway `max_cost`
3. Inspecionar `/governance/cost`
4. Não aumentar budgets sem aprovação

## Security / unauthorized tool / wrong user

1. `AI_ENABLED=0` se necessário
2. Preservar audits CRITICAL (não limpar ring/DB)
3. Verificar RLS `ai_*` (service_role only)
4. Rodar `npm run cert:ai` (security-attack suite)

## RAG / Memory / DB audit unavailable

1. Sistema deve degradar (sem inventar evidence/Decision)
2. Confirmar `source: memory|unavailable` na console
3. Verificar service role + migrations (`ai_audit_events`, knowledge)

## Evaluation regression

1. Não promover LLM
2. `npm run test:eval` + golden negatives
3. Rollback de Agent/Skill/Prompt/RAG/Provider/Model suspeito

## Contatos / artefatos

- Governance Console: `/governance`
- Docs: [AI_PRODUCTION_RUNBOOK.md](./AI_PRODUCTION_RUNBOOK.md), [AI_GOVERNANCE.md](./AI_GOVERNANCE.md)
- Relatório: [AI_PRODUCTION_READINESS_REPORT.md](./AI_PRODUCTION_READINESS_REPORT.md)
