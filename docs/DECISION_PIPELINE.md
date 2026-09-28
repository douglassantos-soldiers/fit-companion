# Decision Pipeline — FASE 18 / 22.1

Integra Specialist Agents ao **Decision Engine existente** via coleta, conflito e prioridade explícitos.  
Não cria novo Decision Engine. Agents **nunca** escrevem Living Plan.

**FASE 22.1:** `runSpecialistsDecisionPipeline` é **CANONICAL_WRAPPER** de [`runProductionAiRuntime`](./AI_CANONICAL_RUNTIME.md). Merge helpers (`mergeSpecialistProposals`, collect/conflict/priority) permanecem neste módulo.

## Fluxo

```
Context (assembleDecisionContext)
  → runProductionAiRuntime (CANONICAL)
      → Orchestrator → Specialists → merge → Safety → Bridge
  → Living Plan = snapshot.livingPlan (já materializado no assemble)
```

API: `runSpecialistsDecisionPipeline` / `mergeSpecialistProposals` em [`src/ai/decision-pipeline/`](../src/ai/decision-pipeline/).  
Entrypoint canônico: [`src/ai/runtime/production-runtime.ts`](../src/ai/runtime/production-runtime.ts).

## Prioridade (determinística)

1. Safety / escalateCare  
2. Recovery (REST / SLEEP_FOCUS / INCREASE_RECOVERY / deload-from-recovery)  
3. Training  
4. Nutrition  
5. Behavior  
6. Performance  

Empate: maior `evidence_confidence`, depois alinhamento com `snapshot.decisions.trainingMode`.  
**Não** usa max `confidence` arbitrário entre agents.

## Conflitos observáveis

| Tipo | Exemplo |
|------|---------|
| `training_vs_recovery` | FULL/PROGRESSION vs REST |
| `nutrition_vs_performance` | NUTRITION_FOCUS vs performance hold |
| `behavior_vs_safety` / `proposal_vs_safety` | CHECKIN/FULL vs escalateCare |
| `same_domain_incompatible` | dois tipos no mesmo domínio |

Audit: `kind: "proposal_merge"` com `conflict_type`, agents, `resolution_reason`.

## Confidence (separado)

| Campo | Significado |
|-------|-------------|
| `model_confidence` | LLM/gateway — **nunca** vira `Decision.confidence` |
| `evidence_confidence` | Cobertura context/tool/RAG/memory |
| `proposal_confidence` / `confidence` | Score da candidata SkillProposal |
| `Decision.confidence` | Sempre do Decision Engine |

Missing evidence / low proposal confidence → discard observável (não inventa proposal).

## Evidence

Toda proposal promovida passa por `attachProposalEvidence` com sinais de context, tools, RAG e memory.

## Explanation (WHY / WHAT / EXPECTED_OUTCOME)

Coach explica com fatos do **Decision** (`decision-contract` / `explain_decision` espelhando tools).  
Nunca inventa justificativas a partir de `proposed_value`.

## O que Agents / LLM não podem fazer

- Emitir Decision final  
- Escolher arbitrariamente entre proposals (usar merge)  
- Escrever Living Plan  
- Copiar `model_confidence` para Decision  
- Pular Safety

## Testes

[`src/ai/decision-pipeline/decision-pipeline.test.ts`](../src/ai/decision-pipeline/decision-pipeline.test.ts)
