# Specialist Agents — Performance OS

Cinco specialists + Coach. Consomem Context (via tools/skills), MCP, Skills, RAG e Memory.  
Respeitam sempre: **Safety → Decision Engine**.

## Agents

| Id | Responsabilidade |
|----|------------------|
| `specialist_performance` | Estado geral, tendências, drivers, riscos — **não** altera plano |
| `specialist_training` | Treino, exercício, progressão/regressão, volume, intensidade |
| `specialist_nutrition` | Nutrição, macros, refeições, substituições, aderência |
| `specialist_recovery` | Sono, fadiga, recovery, readiness, carga |
| `specialist_behavior` | Aderência, fricção, hábitos, barreiras |
| `coach` | Entrada de produto / composição leve |

## Saída

Todo agent produz `AgentAnalysisResult`:

- `analysis`
- `evidence`
- `confidence`
- `proposal?` (`DecisionProposal` via bridge — **nunca** Decision final)

## Fluxo

```
createExecutionPlan → AgentExecutionPlan
  → runSpecialistAgent(agentId, plan)  // Context + MCP + Skills + RAG + Memory
  → AgentAnalysisResult (± proposal)
  → (caller externo) Context → Safety → Decision Engine
```

Handoffs `context_engine` / `safety_engine` / `decision_engine` no plano são **marcadores** — o specialist **não** os executa.

## API

```ts
import { createExecutionPlan } from "@/ai/orchestrator";
import { runSpecialistAgent } from "@/ai/agents";

const { plan } = createExecutionPlan({ trustedUserId, intent });
const { result } = await runSpecialistAgent({
  trustedUserId,
  agentId: "specialist_recovery",
  plan,
});
// result.proposal → resolveProposalAgainstEngine (fora do agent)
```

## Anti-autoridade

- Sem `computeDecisions` em `src/ai/agents`
- Sem WRITE tools / mutação de Living Plan
- LLM não é autoridade (runtime determinístico nesta fase)

Produto: [`runCoachAgent`](./COACH_AGENT.md) orquestra specialists. Coach Agent = interface; Decision Engine = autoridade.
