# AI Architecture — Relatório Final (Performance OS)

Relatório consolidado da camada AI-native do Soldiers Fit Companion / Performance OS após as fases Context → Decision → MCP → Skills → RAG → Memory → Orchestrator → Specialists → Coach Agent → Learning → **Governance/Eval**.

## 1. Arquitetura

```
USER
  → Coach Agent (runCoachAgent)
    → Orchestrator (createExecutionPlan — plan-only)
      → Specialist Agents (runSpecialistAgent)
        → Skills + MCP Tools + RAG + Memory
        → DecisionProposal (nunca Decision final)
  → Context Engine → Safety → Decision Engine → Living Plan
  → Outcome / Attribution → Learning Engine (sinais)
  → Governance (audit / métricas / eval / diagnóstico)
```

**Regra inegociável:** Agents/Coach emitem `DecisionProposal`. Somente o Decision Engine emite `Decision`. Learning produz sinais. Governance observa — não decide.

## 2. Agentes

| Agent | Path / ID | Papel |
|-------|-----------|--------|
| Coach | `coach_agent` / `runCoachAgent` | Facade produto; resposta determinística (FactPack) |
| Specialists | `specialist_training`, `nutrition`, `recovery`, `behavior`, `performance` | Análise + proposal |
| Orchestrator | plan-only | Escolhe agents/skills/tools; não executa |

Registry: [`src/ai/orchestrator/agents/registry.ts`](../src/ai/orchestrator/agents/registry.ts) (`version: 1.0.0`).  
Docs: [AGENTS_ARCHITECTURE.md](./AGENTS_ARCHITECTURE.md), [COACH_AGENT.md](./COACH_AGENT.md), [ORCHESTRATOR.md](./ORCHESTRATOR.md).

## 3. Skills

Framework em [`src/ai/skills/`](../src/ai/skills/) — `defineSkill`, `runSkill`, SkillRun auditado.  
Domínios: training, nutrition, recovery, behavior, performance (`explain_decision`, `analyze_outcome`, …).  
Docs: [SKILLS_ARCHITECTURE.md](./SKILLS_ARCHITECTURE.md).

## 4. MCP / Tools

Tool Layer interno ([`src/ai/mcp/`](../src/ai/mcp/)) — `invokeTool`, allowlists por agent, ToolCall com `input_hash` redacted.  
Docs: [MCP_ARCHITECTURE.md](./MCP_ARCHITECTURE.md).

## 5. RAG

Knowledge store in-memory + retrieve hybrid ([`src/ai/rag/`](../src/ai/rag/)).  
`KnowledgeRetrieval` auditado via Governance. Eval de fixtures de produto (não ciência inventada).  
Docs: [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md).

## 6. Memory

Quatro famílias: User / Decision / Outcome / Learning (`ai_*` tables, service_role).  
Writers validam; LLM não escreve memória diretamente.  
Docs: [MEMORY_ARCHITECTURE.md](./MEMORY_ARCHITECTURE.md).

## 7. Context

PerformanceContext / Context Engine — SoT antes de Decision.  
Fingerprint / snapshot ligam Decision ao contexto.  
Docs: [CONTEXT_ENGINE.md](./CONTEXT_ENGINE.md).

## 8. Decision

Contrato canônico: WHY / WHAT / EXPECTED + evidence + safety_status.  
Proposal fail-closed.  
Docs: [DECISION_ENGINE.md](./DECISION_ENGINE.md).

## 9. Learning

`runLearningCycle`: Decision → Outcome → LearningEvent → LearningSignal.  
Sinais only; guardrails bloqueiam bias perigoso.  
Docs: [LEARNING_ENGINE.md](./LEARNING_ENGINE.md).

## 10. Segurança

- `TrustedUserId` / `resolveTrustedIdentity` — nunca user_id do body do cliente
- Safety Engine acima de Learning / proposals
- Tool allowlists por agent
- Learning guardrails (padrões clínicos não promovidos)
- Governance **redact**: API keys, tokens, service_role, secrets

## 11. Observabilidade

| Sinal | Onde |
|-------|------|
| AgentRun / SkillRun / ToolCall | ring buffers + `AiAuditEvent` |
| RAG retrieval | `recordRagRetrieval` |
| Decision / Outcome / Learning | helpers de audit |
| Diagnóstico 12Q | `diagnoseAgentRun` |
| Métricas | `computeAiMetrics` |
| Engine console | `logEngineDecision` / `logCoachUsage` |

Docs: [AI_GOVERNANCE.md](./AI_GOVERNANCE.md).

## 12. Custos

- Orchestrator: unidades abstratas (`maxCost`)
- Governance: `estimated_cost` proxy + `token_usage` (0 no path determinístico atual)
- Modelo label: `deterministic_runtime` / `runCoachAgent`
- **Sem** billing real de provedor LLM nesta fase

## 13. Riscos

| Risco | Mitigação atual | Residual |
|-------|-----------------|----------|
| Agent inventar Decision | Proposal ≠ Decision; engine SoT | OK |
| Hallucination / claim sem evidência | Eval + FactPack determinístico | LLM legado ainda existe mas não é path default |
| Leak de secrets em logs | `redactForAudit` | Revisar novos metadata fields |
| Audit só in-memory | Mitigado FASE 11 (`ai_audit_events` dual-write) | Apply remoto + retenção |
| Dualidade Outcome types | Bridges LearningOutcome / Attribution | Documentado |
| Cost real desconhecido | Proxies | Medir quando LLM voltar ao path |

## 14. Próximos passos

1. ~~Persistência Postgres de `AiAuditEvent` / runs (RLS + TrustedUserId)~~ — **FASE 11 feito** (`persist_v1`)
2. UI técnica de Agent Run Diagnostic (sem secrets)
3. Token/cost reais quando houver provider LLM no path Coach
4. Dual-write Memory ↔ Learning signals (opcional, cuidadoso)
5. AI Governance continuous eval no CI (já unitário; expandir smoke)
6. Deprecar workflows LLM legados do Coach quando estáveis
7. Apply migration `20261025120000_fase11_ai_audit_events.sql` no projeto remoto Fit Companion

## 15. Docs relacionados

- [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md) — foundation
- [AI_GOVERNANCE.md](./AI_GOVERNANCE.md) / [AI_EVALUATION.md](./AI_EVALUATION.md)
- [AGENTS_ARCHITECTURE.md](./AGENTS_ARCHITECTURE.md) · [COACH_AGENT.md](./COACH_AGENT.md)
- [SKILLS_ARCHITECTURE.md](./SKILLS_ARCHITECTURE.md) · [MCP_ARCHITECTURE.md](./MCP_ARCHITECTURE.md)
- [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md) · [MEMORY_ARCHITECTURE.md](./MEMORY_ARCHITECTURE.md)
- [CONTEXT_ENGINE.md](./CONTEXT_ENGINE.md) · [DECISION_ENGINE.md](./DECISION_ENGINE.md)
- [LEARNING_ENGINE.md](./LEARNING_ENGINE.md)

## Critério de maturidade (FASE 10)

- Audit correlaciona os 7 artefatos
- Métricas listadas existem
- Eval cobre 12 casos
- `diagnoseAgentRun` responde as 12 perguntas sem secrets
- Build / testes OK
