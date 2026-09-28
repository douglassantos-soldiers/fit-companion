# AI Architecture — Relatório Final (Performance OS)

Relatório consolidado da camada AI-native do Soldiers Fit Companion / Performance OS após as fases Context → Decision → MCP → Skills → RAG → Memory → Orchestrator → Specialists → Coach Agent → Learning → Governance/Eval → FASE 15 (E2E) → FASE 16 (Production RAG) → FASE 17 (AI Gateway) → FASE 18 (Specialists → Decision) → FASE 19 (AI Governance Console) → FASE 20 (Evaluation 2.0) → FASE 21 (Production Certification) → FASE 22.1 (Canonical AI Runtime) → FASE 22.2 (Production RAG Hardening) → FASE 22.3 (Production Memory Persistence) → FASE 22.4 (Production LLM Runtime) → FASE 22.5 (Remove Mock from Production) → FASE 22.6 (Durable Critical AI Audit) → FASE 22.7 (Real Production Certification) → FASE 22.8 (AI CI/CD Safety Gate) → FASE 22.9 (Database Migration Verification) → FASE 22.10 (Production Distributed Rate Limiting) → FASE 22.11 (AI Kill Switch & Rollback) → FASE 22.12 (Real Production E2E) → **FASE 22.13 (Final Production Certification)**.

## 1. Arquitetura

```
USER
  → Trusted Identity
  → Context (PerformanceContext)
  → Orchestrator (createExecutionPlan — plan-only)
  → Specialist Agents (runSpecialistAgent)
    → Skills + MCP Tools + RAG + Memory
    → [opcional] AI Gateway → Provider → validate → DecisionProposal candidata
    → DecisionProposal (nunca Decision final)
  → Safety → Decision Engine → Living Plan
  → Outcome → Learning → Governance (Audit / Eval)
```

**Regra inegociável:** Agents/Coach emitem `DecisionProposal`. Somente o Decision Engine emite `Decision`. Learning produz sinais. Governance observa — não decide. Agents/Skills/Tools/RAG/Memory **não** escrevem Living Plan. LLM **nunca** tem autoridade de Decision (ver [`AI_GATEWAY.md`](./AI_GATEWAY.md)).

### End-to-End Runtime Flow (FASE 22.1)

**Único runtime canônico de produção:** [`runProductionAiRuntime`](../src/ai/runtime/production-runtime.ts) — ver [`AI_CANONICAL_RUNTIME.md`](./AI_CANONICAL_RUNTIME.md).

| Path | Entrada | Label | Uso |
|------|---------|-------|-----|
| **CANONICAL** | `runProductionAiRuntime` | CANONICAL | Produção (núcleo) |
| **Coach produto** | `askAiCoach` → `runCoachAgent` → `runProductionAiRuntime` (com snapshot) | CANONICAL_FACADE | UI / chat |
| **Specialists API** | `runSpecialistsDecisionPipeline` | CANONICAL_WRAPPER | Compat / testes FASE 18 |
| **Harness E2E** | `runAiE2EPipeline` | TEST_ONLY | Testes / hardening |
| Soft sem snapshot | Coach sem `DecisionContextSnapshot` | LEGACY | Offline / informacional |

Produto: `emitOutcomeAndLearning: false`. Outcome/Learning só após follow-through real. Bridge autoritativo em [`src/ai/runtime/authoritative-bridge.ts`](../src/ai/runtime/authoritative-bridge.ts).

Correlação: `run_id` / `parent_run_id` / `agent_id` / `agent_version` / `skill_id` + `skill_run_id` / `tool_id` + `tool_call_id` / `retrieval_id` / `decision_id` / `outcome_id` / `learning_event_id` / `context_fingerprint`.

Fail-safe: falhas de identity, context, tool, RAG, memory, proposal, safety ou decision retornam `{ ok: false, degraded: true, error_code }` **sem inventar** Decision/Living Plan.

SoT harness: [`src/ai/e2e/run-pipeline.ts`](../src/ai/e2e/run-pipeline.ts), bridge [`authoritative-bridge.ts`](../src/ai/e2e/authoritative-bridge.ts), erros [`errors.ts`](../src/ai/e2e/errors.ts), trace [`trace.ts`](../src/ai/e2e/trace.ts).

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

**FASE 16 + 22.2 — Production Knowledge Base:** corpus curado, VectorStore (`memory` em test/dev | `supabase`+pgvector **obrigatório em production**), hybrid retrieve, evidence quality, `rag_status` + `rag_availability`, health/`RAG_READY`. Skills resolvem `kb:*`. Sem fallback silencioso para memória em prod. Docs: [`AI_RAG_PRODUCTION.md`](./AI_RAG_PRODUCTION.md) · [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md).

**FASE 17 + 22.4 + 22.5 — AI Gateway:** `invokeAI` com OpenAI (primary) + Anthropic (fallback real); mock **proibido em production** (`ProductionMockProviderError` + CI `guard:ai-mock`); cost limits; circuit breaker; `LLM_READY`. Docs: [`AI_GATEWAY.md`](./AI_GATEWAY.md) · [`AI_LLM_PRODUCTION.md`](./AI_LLM_PRODUCTION.md) · [`AI_MOCK_POLICY.md`](./AI_MOCK_POLICY.md).

**FASE 18 — Specialists → Decision:** `runSpecialistsDecisionPipeline` + merge (collect/conflict/priority) → Safety → Decision Engine existente; Living Plan só via assemble. Docs: [`DECISION_PIPELINE.md`](./DECISION_PIPELINE.md).  
Docs: [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md).

## 6. Memory

Quatro famílias: User / Decision / Outcome / Learning (`ai_*` tables, service_role).  
Writers validam; LLM não escreve memória diretamente.  
**FASE 22.3:** `ensureMemoryStore` — production = `SupabaseMemoryStore` obrigatório (sem fallback InMemory); health/`MEMORY_READY`; `version` nas tabelas; legacy `coach_memories` marcado LEGACY (não SoT); wire product `coach_notes` via `createMemory` em `askAiCoach`.  
Docs: [MEMORY_ARCHITECTURE.md](./MEMORY_ARCHITECTURE.md) · [`AI_MEMORY_PRODUCTION.md`](./AI_MEMORY_PRODUCTION.md).

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
| Decision / Outcome / Learning | helpers de audit **CRITICAL awaited** (FASE 22.6) |
| Diagnóstico 12Q | `diagnoseAgentRun` |
| Métricas | `computeAiMetrics` (+ `safety_rejection_rate`, `rag_failure_rate`, cost breakdown) |
| Engine console | `logEngineDecision` / `logCoachUsage` |
| **Governance Console (FASE 19)** | `/governance/*` — admin/analyst read-only |

Docs: [AI_GOVERNANCE.md](./AI_GOVERNANCE.md) · [AI_AUDIT_DURABILITY.md](./AI_AUDIT_DURABILITY.md) · [GOVERNANCE_CONSOLE.md](./GOVERNANCE_CONSOLE.md).

### FASE 19 — AI Governance Console

- Rotas `/governance/overview|agents|runs|decisions|safety|rag|cost|evaluation`
- Server fns em `governance-console.functions.ts` com `requireAdminSession([admin,editor,support,analyst])`
- Queries admin paginadas (`loadAuditsAdmin`); UI nunca muta Decision Engine / Learning / Living Plan
- Privacy: `redactForAudit` + `user_****` truncation

### FASE 20 — Evaluation 2.0 + Golden Dataset

- `runAiEvaluationV2` + `GOLDEN_DATASET` (`golden_v1`) por domínio
- Evidence / Decision / Agent quality (citation ≠ qualidade); thresholds bloqueiam CI
- `compareEvalArtifacts` offline; `npm run test:eval` + `.github/workflows/ai-eval.yml`
- Evaluator **não** altera Decision / produção; sem LLM-as-judge

### FASE 21 / 22.7 — Production Certification

- **FASE 22.7:** `runProductionCertification()` — probes reais, Vitest executado, UNTESTED≠PASS
- Suites em `src/ai/certification/` + meta-teste `certification-integrity.test.ts`
- Feature flags / kill-switches + `AI_FORCE_DETERMINISTIC` rollback
- Audit CRITICAL vs OBSERVATIONAL; rate limits AI **distributed** (FASE 22.10); cost bounds asserts
- Migration probe (`verifyAiMigrations` + FASE 22.9 deep readiness) — permission/RLS = BLOCKED, não applied
- Docs: [AI_PRODUCTION_CERTIFICATION.md](./AI_PRODUCTION_CERTIFICATION.md) · [AI_PRODUCTION_RUNBOOK.md](./AI_PRODUCTION_RUNBOOK.md) · [AI_PRODUCTION_READINESS_REPORT.md](./AI_PRODUCTION_READINESS_REPORT.md)
- `production_ready` só com critical EXECUTED+PASS, suite real ok, gates 100%

### FASE 22.8 — AI CI/CD Safety Gate

- Workflow expandido: lint → typecheck → unit → integration → eval → security → regression → db-readiness → cert → verdict → build
- Paths: `src/ai`, engine, coach, migrations, scripts AI
- Veredicto explícito PASS/FAIL/BLOCKED ([`AI_CI_CD_GATES.md`](./AI_CI_CD_GATES.md))
- Artifact: `docs/certification/latest.json`

### FASE 22.9 — Database Migration Verification

- Inventário canônico + `verifyAiDatabaseReadiness` (tables / indexes / RLS / pgvector / service_role)
- Sem `adminDb` → `MIGRATION_VERIFICATION_BLOCKED` (nunca inventar applied)
- RPC `ai_schema_inventory_probe` (migration `20261031120000_fase22_9_ai_schema_verify.sql`)
- Doc: [AI_DATABASE_READINESS.md](./AI_DATABASE_READINESS.md) · artifact `docs/certification/database-readiness.json`

### FASE 22.10 — Production Distributed Rate Limiting

- Store Supabase (`ai_rate_limit_buckets` + RPC atômica + TTL) — sem Redis
- Scopes: user / ip / session / agent / tool / llm / rag / api / admin + cost budgets
- Wire: gateway, MCP tools, agent runs, RAG, coach, admin
- Kill switch `AI_RL_DISABLED`; fail-closed sem admin DB em produção
- Doc: [AI_RATE_LIMITING.md](./AI_RATE_LIMITING.md) · `docs/certification/rate-limit-readiness.json`

### FASE 22.11 — AI Kill Switch & Rollback

- Aliases: `AI_GLOBAL_ENABLED`, `RAG_ENABLED`, `MEMORY_ENABLED`, `SPECIALISTS_ENABLED`, `LEARNING_ENABLED` (+ canônicos `AI_*`)
- Fallbacks seguros; Memory writes skipped; production-runtime soft-guard
- Server-authoritative; Identity/Context/Safety/Decision/LP não gated
- Doc: [AI_KILL_SWITCH.md](./AI_KILL_SWITCH.md) · [AI_ROLLBACK.md](./AI_ROLLBACK.md) · `kill-switch-readiness.json`

### FASE 22.12 — Real Production E2E

- `runProductionE2E` — PASS só com DB/pgvector/Memory/Audit reais; mock/InMemory → FAIL
- Sem `SUPABASE_SERVICE_ROLE_KEY` / DB readiness → **BLOCKED** (`PRODUCTION_E2E_BLOCKED`)
- Failure paths + correlation + idempotency + cross-user + kill/rollback
- Harness `runAiE2EPipeline` permanece **TEST_ONLY**
- Doc: [AI_PRODUCTION_E2E.md](./AI_PRODUCTION_E2E.md) · `production-e2e.json`

### FASE 22.13 — Final Production Certification

- Agregador AUDIT/VERIFY/TEST/CERTIFY — sem features novas
- Reusa probes 22.7 + readiness 22.9–22.12 + probes `canonical_runtime` / `agents` / `evaluation` / `ci_cd`
- `production_ready` só com critical EXECUTED+PASS; UNTESTED/BLOCKED/DEGRADED ≠ PASS
- Artefato: [AI_PRODUCTION_CERTIFICATION_FINAL.md](./AI_PRODUCTION_CERTIFICATION_FINAL.md) · `docs/certification/final.json`

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
| Coach produto não fecha bridge | Harness E2E FASE 15 valida pipeline | ~~Integrar bridge no path produto~~ — feito (`emitOutcomeAndLearning: false`) |
| skill_id vs skill_run_id | Corrigido em `tool-call-log` (FASE 15) | OK |

## 14. Próximos passos

1. ~~Persistência Postgres de `AiAuditEvent` / runs (RLS + TrustedUserId)~~ — **FASE 11 feito** (`persist_v1`)
2. ~~Harness E2E + taxonomia de erros + trace + audit ID fix~~ — **FASE 15 feito**
3. ~~Opcional: integrar `runAuthoritativeBridge` no path produto pós-Coach quando houver snapshot~~ — **feito** (`askAiCoach` + `emitOutcomeAndLearning: false`)
4. ~~UI técnica de Agent Run Diagnostic / Governance Console~~ — **FASE 19 feito** (`/governance/*`)
5. Token/cost reais quando houver provider LLM no path Coach
6. Dual-write Memory ↔ Learning signals (opcional, cuidadoso)
7. Deprecar workflows LLM legados do Coach quando estáveis
8. Apply migrations FASE 11 + FASE 19 + FASE 22.6 + FASE 22.9 (`ai_schema_inventory_probe`) no projeto remoto Fit Companion
9. Wire Outcome/Learning no produto após follow-through real (attribution / accept proposal)
## 15. Docs relacionados

- [AI_CANONICAL_RUNTIME.md](./AI_CANONICAL_RUNTIME.md) — **FASE 22.1 entrypoint canônico**
- [AI_RAG_PRODUCTION.md](./AI_RAG_PRODUCTION.md) — **FASE 22.2 RAG production**
- [AI_AUDIT_DURABILITY.md](./AI_AUDIT_DURABILITY.md) — **FASE 22.6 durable critical audit**
- [AI_PRODUCTION_CERTIFICATION.md](./AI_PRODUCTION_CERTIFICATION.md) — **FASE 22.7 real certification**
- [AI_CI_CD_GATES.md](./AI_CI_CD_GATES.md) — **FASE 22.8 CI/CD Safety Gate**
- [AI_DATABASE_READINESS.md](./AI_DATABASE_READINESS.md) — **FASE 22.9 database migration verification**
- [AI_RATE_LIMITING.md](./AI_RATE_LIMITING.md) — **FASE 22.10 distributed rate limiting**
- [AI_KILL_SWITCH.md](./AI_KILL_SWITCH.md) — **FASE 22.11 kill switch & rollback**
- [AI_PRODUCTION_E2E.md](./AI_PRODUCTION_E2E.md) — **FASE 22.12 real production E2E**
- [AI_PRODUCTION_CERTIFICATION_FINAL.md](./AI_PRODUCTION_CERTIFICATION_FINAL.md) — **FASE 22.13 final certification**
- [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md) — foundation
- [AI_GOVERNANCE.md](./AI_GOVERNANCE.md) / [AI_EVALUATION.md](./AI_EVALUATION.md) / [GOVERNANCE_CONSOLE.md](./GOVERNANCE_CONSOLE.md)
- [AGENTS_ARCHITECTURE.md](./AGENTS_ARCHITECTURE.md) · [COACH_AGENT.md](./COACH_AGENT.md)
- [SKILLS_ARCHITECTURE.md](./SKILLS_ARCHITECTURE.md) · [MCP_ARCHITECTURE.md](./MCP_ARCHITECTURE.md)
- [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md) · [MEMORY_ARCHITECTURE.md](./MEMORY_ARCHITECTURE.md)
- [CONTEXT_ENGINE.md](./CONTEXT_ENGINE.md) · [DECISION_ENGINE.md](./DECISION_ENGINE.md)
- [LEARNING_ENGINE.md](./LEARNING_ENGINE.md)

## Critério de maturidade (FASE 10 + 15)

- Audit correlaciona os 7 artefatos
- Métricas listadas existem
- Eval cobre 12 casos
- `diagnoseAgentRun` responde as 12 perguntas sem secrets
- `runAiE2EPipeline` fecha Identity→Evaluation com fail-safe (FASE 15)
- `buildAiExecutionTrace` reconstrói correlação
- Build / testes OK
