# AI Canonical Runtime — FASE 22.1

Único runtime de produção para a jornada AI do Performance OS.

## Entrypoint

```ts
import { runProductionAiRuntime } from "@/ai/runtime";

const out = await runProductionAiRuntime({
  trustedUserId,
  intent,
  snapshot, // DecisionContextSnapshot já montado pelo Decision Engine
  emitOutcomeAndLearning: false, // produto
});
```

**Coach produto:** `askAiCoach` → `runCoachAgent` → `runProductionAiRuntime` (quando há snapshot).  
**Specialists API (compat):** `runSpecialistsDecisionPipeline` → thin wrapper do canônico.  
**Harness:** `runAiE2EPipeline` — **TEST ONLY** (QA + mocks; ≠ produção).  
**Production E2E:** `runProductionE2E` — FASE 22.12; PASS só com stores reais (ver [AI_PRODUCTION_E2E.md](./AI_PRODUCTION_E2E.md)).  
**Final cert:** `runFinalProductionCertification` — FASE 22.13 (ver [AI_PRODUCTION_CERTIFICATION_FINAL.md](./AI_PRODUCTION_CERTIFICATION_FINAL.md)).

## Fluxo oficial

```
User
  → Identity (TrustedUserId)
  → Context (DecisionContextSnapshot via assembleDecisionContext)
  → Orchestrator (createExecutionPlan — plan-only)
  → Specialist Runtime (runSpecialistAgent)
    → Skills → Tools (MCP) → RAG → Memory
  → DecisionProposal(s)
  → Conflict Resolution (mergeSpecialistProposals)
  → Proposal validation
  → Safety
  → Existing Decision Engine (resolveProposalAgainstEngine)
  → Decision (engine-authored)
  → Living Plan (snapshot.livingPlan — referência; não materializa)
  → Action / Outcome / Learning (produto: só após follow-through real)
  → Governance (audit trail)
```

Autoridade determinística intacta:

```
assembleDecisionContext → Context → Safety → computeDecisions → Living Plan → persist
```

## Audit Findings (pré-implementação)

Conflitos encontrados e resolvidos nesta fase:

1. **Duplicação Coach vs `runSpecialistsDecisionPipeline`** — ambos faziam plan → specialists → merge; Coach não fechava o bridge. **Resolvido:** núcleo em `runProductionAiRuntime`; Coach = facade; specialists pipeline = wrapper.
2. **`runAuthoritativeBridge` em `src/ai/e2e/` usado em produção** — boundary frágil. **Resolvido:** implementação em `src/ai/runtime/authoritative-bridge.ts`; e2e só reexporta (DEPRECATED location).
3. **Soft path sem snapshot** — proposal "accepted" sem alinhamento engine. **Mantido como LEGACY** explícito (`path_label: LEGACY`, metadata `legacy_soft_no_snapshot`); não inventa Decision.
4. **Outcome/Learning** — produto `emitOutcomeAndLearning: false`; E2E pode usar `true` com fixtures.
5. **Memória dual** — AI Memory (`validateMemoryWrite`) vs `upsertCoachMemory` — risco residual; não é writer de Decision/Living Plan.

## Classificação de paths

| Símbolo | Label |
|---------|-------|
| `runProductionAiRuntime` | **CANONICAL** |
| `runAuthoritativeBridge` (`src/ai/runtime/`) | **CANONICAL** |
| `runCoachAgent` (com snapshot) | **CANONICAL_FACADE** |
| `runSpecialistsDecisionPipeline` | **CANONICAL_WRAPPER** |
| `runAiE2EPipeline` | **TEST_ONLY** |
| Coach soft sem snapshot / `validateProposalAgainstDecisionEngine` soft | **LEGACY** |
| `coachReply` / `coachFreeform` / `callCoachProvider` / workflows review | **LEGACY** |
| Reexport `src/ai/e2e/authoritative-bridge` | **DEPRECATED** location |

## Responsabilidades

| Componente | Ownership |
|------------|-----------|
| Identity | TrustedUserId / session — nunca body client |
| Context / Decision / Living Plan persist | `assembleDecisionContext` + `getOrBuildDecisionContext` |
| Orchestrator | Plan-only (`createExecutionPlan`) |
| Specialists / Skills / Tools / RAG / Memory | Workers; emitem proposal |
| Merge / conflict | `mergeSpecialistProposals` |
| Bridge | `runAuthoritativeBridge` — Safety + engine resolve |
| Coach | Interface / FactPack / resposta; não decide |
| E2E | Test harness; injects + evaluation |

## Failure handling

Falhas retornam `{ ok: false, degraded: true, error_code, stage_results }` **sem inventar** Decision ou Living Plan.

Códigos relevantes: `invalid_identity`, `missing_context`, `specialist_failure`, `skill_failure`, `tool_error`, `rag_error`, `memory_error`, `proposal_error` / `no_proposal`, `safety_rejection`, `decision_error`.

## Security boundaries

- Agents / Skills / Gateway / Orchestrator / LLM **não** escrevem Decision nem Living Plan.
- Proposal nunca copia `proposed_value` para Decision (`resolveProposalAgainstEngine`).
- LLM nunca é autoridade (default `deterministic`).
- Integrity test cobre `src/ai/agents|gateway|skills|runtime`.

## Persistence boundaries

| Artefato | Quem persiste |
|----------|----------------|
| Decision / Living Plan (SoT) | Engine: `getOrBuildDecisionContext` → snapshots + `recommendation_decisions` |
| Bridge audit | `recordDecisionAudit` / governance (não é SoT de Decision) |
| Coach proposal history | `persistCoachProposal` (`coach_proposals`) — não é Decision Engine |
| Outcome / Learning (produto) | Após follow-through real — **não** no path Coach default |

## Correlation IDs

Propagados em `RunProductionAiRuntimeResult.correlation`:

`run_id`, `parent_run_id`, `skill_id` / `skill_run_id`, `tool_id` / `tool_call_id`, `retrieval_id`, `proposal_id`, `decision_id`, `outcome_id`, `learning_event_id`, `context_fingerprint`.

**Idempotência:** `idempotencyKey` opcional estabiliza `run_id` (`prod_${hash}`); não reescreve Decision no DB.

## Ver também

- [AI_ARCHITECTURE_FINAL.md](./AI_ARCHITECTURE_FINAL.md)
- [DECISION_PIPELINE.md](./DECISION_PIPELINE.md)
- [COACH_AGENT.md](./COACH_AGENT.md)
- [DECISION_ENGINE.md](./DECISION_ENGINE.md)
