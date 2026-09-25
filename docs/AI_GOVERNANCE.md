# AI Governance

FASE 10 + **FASE 11 (persistência)** — governança, observabilidade e auditabilidade da AI do Performance OS.

SoT: [`src/ai/governance/`](../src/ai/governance/). Não é um segundo Decision Engine. Não muta Safety, thresholds nem Living Plan.

## Autoridade

| Camada | Papel |
|--------|--------|
| Decision Engine | Emite Decision |
| Safety / AuthZ | Bloqueios críticos |
| Governance | Audit + métricas + diagnóstico + eval |
| Agents / Skills / MCP / RAG | Emitem runs; governance espelha |

## Persistência (FASE 11 — `persist_v1`)

| Peça | Path |
|------|------|
| Tabela | `public.ai_audit_events` |
| Migration | `supabase/migrations/20261025120000_fase11_ai_audit_events.sql` |
| Persist | `persist.server.ts` (service_role, best-effort) |
| Serialize | `serialize.ts` (UUID user_id only; skip non-uuid) |
| Server fns | [`src/lib/ai-governance.functions.ts`](../src/lib/ai-governance.functions.ts) |

Fluxo: `recordAudit` → ring buffer **e** dual-write Postgres (se server + `AI_AUDIT_PERSIST≠0` + admin DB + UUID). Falha DB **não** derruba Coach/Agent.

APIs (sem UI):

- `listAiAudits` — TrustedIdentity + merge DB/memory
- `getAgentRunDiagnostic` — 12Q com `extraAudits` do DB
- `getAiGovernanceMetrics` — `computeAiMetrics({ source: "db" })`

RLS: service_role only (mesmo padrão Memory FASE 9). Apply remoto exige credenciais Fit Companion.

## O que auditar

`AgentRun` · `SkillRun` · `ToolCall` · `RAGRetrieval` (`KnowledgeRetrieval`) · `Decision` · `Outcome` · `LearningEvent`

Envelope: `AiAuditEvent` (`governance_v1`) com correlação `run_id` / `parent_run_id` / ids de skill/tool/retrieval/decision.

## 12 perguntas diagnósticas

`diagnoseAgentRun(runId, { extraAudits? })` responde:

1. Qual Agent participou?
2. Qual versão do Agent?
3. Qual Skill foi usada?
4. Quais Tools foram chamadas?
5. Qual RAG foi consultado?
6. Quais fontes foram utilizadas?
7. Qual Context foi utilizado?
8. Qual decisão foi produzida?
9. Quais evidências sustentaram a decisão?
10. Qual modelo foi utilizado?
11. Quanto custou?
12. Qual foi o resultado?

Respostas `known` | `unknown` | `insufficient` — **nunca inventa**. Vista técnica: `AgentRunDiagnosticView`.

## Métricas

`computeAiMetrics({ source?: "memory" | "db", audits? })`:

- `agent_success_rate` / `agent_failure_rate`
- `tool_error_rate`
- `rag_hit_rate` / `retrieval_relevance`
- `decision_success_rate`
- `action_adherence` / `outcome_quality`
- `latency` (p50/p95)
- `token_usage` / `estimated_cost` (proxies; path Coach atual é determinístico)

## Redaction

`redactForAudit` remove / mascara:

- API keys, access tokens, service_role, authorization, secrets, passwords, bearer

**Nunca expor** no audit/diagnóstico: API keys, access tokens, service role, secrets, PII desnecessário.

## Hooks

- `recordAgentRun` / `recordSkillRun` / `recordToolCall` → espelham `recordAudit` (+ persist)
- `retrieveKnowledge` → `recordRagRetrieval`
- Coach grava run pai + `parent_run_id` nos specialists
- `recordDecisionAudit` / `recordOutcomeAudit` / `auditLearningCycleResult` (helpers públicos)

## Versionamento

| Constante | Valor |
|-----------|--------|
| `AI_GOVERNANCE_VERSION` | `governance_v1` |
| `AI_GOVERNANCE_CONTRACT_VERSION` | `1` |
| `AI_AUDIT_PERSIST_VERSION` | `persist_v1` |

## Explicitamente fora

- UI dashboard de runs
- Billing real de provedor LLM
- Dual-write Memory / `coach_memories`
- Auto-remediação que altere Decision

## Ver também

- [AI_EVALUATION.md](./AI_EVALUATION.md)
- [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md)
- [AI_ARCHITECTURE_FINAL.md](./AI_ARCHITECTURE_FINAL.md)
- [LEARNING_ENGINE.md](./LEARNING_ENGINE.md)
