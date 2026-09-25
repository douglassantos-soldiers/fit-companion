# Decision Engine — Contract Consolidation (FASE 1)

O Decision Engine é a **autoridade única** de decisão do Performance OS. IA (Coach / Agents futuros) é uma camada **em volta** deste núcleo — não um segundo cérebro.

## Pipeline autoritativo

```
DOMAIN / C360
    → CONTEXT ENGINE
    → SAFETY ENGINE
    → DECISION ENGINE   ← só aqui nasce Decision
    → LIVING PLAN
```

IA futura (fora desta fase):

```
Agent / Coach
    → DecisionProposal
    → Validation (schema → context → safety)
    → Existing Decision Engine
    → Decision (engine-authored)
```

**Regra inegociável:** Agents/Coach emitem `DecisionProposal`; **somente** o Decision Engine emite `Decision`. Nunca copiar `proposed_value` para Decision.

## Contratos

| Peça | Path | Notas |
|------|------|--------|
| Regras | `src/lib/engine/decision.ts` (`computeDecisions`) | Determinístico, sem LLM |
| Contrato | `src/lib/engine/decision-contract.ts` | snake_case persistido |
| Evidence | `src/lib/engine/decision-evidence.ts` | `metrics` + `items` (provenance) |
| Proposal | `src/lib/engine/decision-proposal.ts` | parse / validate / resolve |
| Thresholds | `src/lib/engine/decision-thresholds.ts` | `SLEEP_LOW_HOURS`, `TIME_LIMITED_MIN` |
| Reason codes | `src/lib/engine/reason-codes.ts` | snake SoT + SCREAMING aliases |
| AI surface | `src/ai/contracts/decision.ts`, `proposal.ts` | reexport + `DecisionView` |
| Coach bridge | `src/lib/coach/proposals.ts` | `toDecisionProposal` / snapshot validate |

### WHY / WHAT / EXPECTED_OUTCOME

Cada `Decision` carrega:

- **why** — `reason_codes` + `reason_aliases` (+ summary opcional)
- **what** — `actions` + `decision_value` (+ `primary`)
- **expected_outcome** — `{ kind, horizon?, metric?, note? } \| null`

Coach futuro **não inventa** limiares: recebe WHY=`LOW_SLEEP`, WHAT=`REDUCE_ACCESSORY_VOLUME` / mode, EXPECTED=`REDUCE_FATIGUE` e narra em linguagem natural.

`toDecisionView(d)` expõe camelCase para a camada AI.

### DecisionProposal

```
parse → validateContext → validateSafety → resolveAgainstEngine
```

Resultado sempre inclui `authoritative: Decision[]` do bundle. `ok: false` ainda devolve as Decisions do engine (ex.: FULL_WORKOUT vs `trainingMode=rest`).

Persistência de Decision continua só via `getOrBuildDecisionContext` / `logAuthoritativeDecisions`. Proposal **não** é gravada como Decision.

## Anti-spaghetti

Um caminho principal (futuro):

```
USER → ORCHESTRATOR → SPECIALIST AGENT → SKILLS + tools + RAG
    → DecisionProposal → CONTEXT → SAFETY → DECISION ENGINE → Decision
```

Evitar cadeias Agent→Agent→Skill→Agent→RAG→MCP→Agent.

## Thresholds compartilhados

SoT em `decision-thresholds.ts`, usados por:

- `context-snapshot.ts` (reason seeds sleep)
- `safety.ts` (low_sleep)
- `decision.ts` (sleepLow / timeLimited / very-low deload)

Não re-declarar `6` / `40` nesses módulos.

## Reason codes (versionados)

SoT = snake_case (`sleep_low`). SCREAMING = aliases para Coach / Proposal / docs.

`REASON_CODES_VERSION` em `reason-codes.ts` (bump quando o mapa de aliases muda).

Aliases de produto (entrada → SoT):

| Alias | SoT |
|-------|-----|
| LOW_SLEEP | sleep_low |
| HIGH_RECOVERY_LOAD | recovery_low |
| HIGH_TRAINING_LOAD | excessive_muscle_load |
| LOW_ADHERENCE | adherence_drop |
| TRAINING_PROGRESS | progression_ready |
| PLATEAU | plateau_detected |
| LIMITED_TIME | time_limited |
| REST_DAY | deload_week |
| NUTRITION_ADHERENCE | protein_low |
| RECOVERY_IMPROVED | low_muscle_fatigue |

## Relatório de regras duplicadas (inventário)

| Local | Tipo | Ação |
|-------|------|------|
| Context / Safety / Decision sleep&lt;6, time&lt;40 | Thresholds | **Consolidado** em `decision-thresholds.ts` |
| `coach/proposals.ts` alignment vs mode | Soft UX rules | Mantido; bridge usa `resolveProposalAgainstEngine` |
| Recovery muscle sleep&lt;6 (`recovery/muscle.ts`) | Domain heuristic | **Só documentado** — fora do escopo Decision |
| Behavior adherence sleep&lt;6 (`behavior/adherence.ts`) | Domain heuristic | **Só documentado** |
| Learned patterns sleep&lt;6 (`learned-patterns.ts`) | Learning signal | **Só documentado** |
| Workflows / Coach copy limiares | Prosa | **Só documentado** — Coach não é SoT |
| Progressão de carga (`training/progression.ts`) | Domain decision auxiliar | **Só documentado** — não redefine mode do dia |
| Anti-fraud / Shopify ingest “decision” | Outro domínio | **Não é** Decision Engine de performance |

Próximas fases podem migrar heurísticas de domínio para Skills determinísticas — sem segundo Decision Engine.

## Roadmap (norte — não implementar aqui)

| Fase | Conteúdo |
|------|----------|
| **1** | Decision Contract Consolidation |
| **2 (Tool Layer)** | AI Tool Layer interno — ver [MCP_ARCHITECTURE.md](./MCP_ARCHITECTURE.md) |
| **3 (Skills)** | Skills Framework — ver [SKILLS_ARCHITECTURE.md](./SKILLS_ARCHITECTURE.md) |
| **4 (RAG)** | RAG Infrastructure — ver [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md) |
| 5 | Agent Runtime (thin via Specialists) |
| **6 (Orchestrator)** | Agent Orchestrator (plan-only) — ver [ORCHESTRATOR.md](./ORCHESTRATOR.md) |
| **7 (Specialists)** | Specialist Agents — ver [AGENTS_ARCHITECTURE.md](./AGENTS_ARCHITECTURE.md) |
| **8 (Coach Agent)** | Coach Agent — ver [COACH_AGENT.md](./COACH_AGENT.md) |
| **9 (Memory)** | Memory Layer — ver [MEMORY_ARCHITECTURE.md](./MEMORY_ARCHITECTURE.md) |
| **Learning Engine** | Decision→Outcome→Signal — ver [LEARNING_ENGINE.md](./LEARNING_ENGINE.md) |
| **10 (Governance)** | AI Governance / Evaluation — ver [AI_GOVERNANCE.md](./AI_GOVERNANCE.md), [AI_EVALUATION.md](./AI_EVALUATION.md) |
| **11 (Audit Persist)** | Postgres `ai_audit_events` dual-write — ver [AI_GOVERNANCE.md](./AI_GOVERNANCE.md) § Persistência |

MCP = protocolo **sobre** Tool Layer. RAG depois de Skills. UI só depois de backend + AI + Coach Agent.

## Explicitamente fora de escopo (FASE 1)

- Novo Decision Engine em `src/ai/decision/`
- Agent Runtime / Orchestrator / MCP server / RAG / Skill framework
- Mudanças de UI / Coach product UX
- Rename Postgres snake→camel

## Ver também

- [decision-consolidation.md](./decision-consolidation.md) — mapa FASE 2 pipeline
- [CONTEXT_ENGINE.md](./CONTEXT_ENGINE.md) — Context SoT
- [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md) — camada AI-native
- [decision-attribution.md](./decision-attribution.md) — Decision→Action→Outcome
- [LEARNING_ENGINE.md](./LEARNING_ENGINE.md) — Outcome→LearningSignal (sinais only)
