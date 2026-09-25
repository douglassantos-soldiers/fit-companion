# Agent Orchestrator — Performance OS

Roteia intent → Agents / Skills / Tools / Knowledge e emite um **AgentExecutionPlan**.

## O que NÃO é

- **Não** é autoridade de Decision (não escolhe `trainingMode`)
- **Não** executa Skills/Tools sozinho — use `runSpecialistAgent` ([AGENTS_ARCHITECTURE.md](./AGENTS_ARCHITECTURE.md))
- **Não** chama Safety/Decision engines — só agenda o handoff na `sequence`

```
User intent
  → createExecutionPlan
  → AgentExecutionPlan
  → (futuro) Agent Runtime
  → Proposal
  → Context → Safety → Decision Engine
```

## AgentExecutionPlan

| Campo | Papel |
|-------|--------|
| `intent` | Texto / objetivo do usuário |
| `agents` | Specialists / coach ordenados |
| `skills` / `tools` | Allowlist ∩ catálogo global |
| `knowledgeDomains` | Domínios RAG (refs; retrieval no Runtime) |
| `sequence` | Passos `agent` \| `skill` \| `tool` \| `knowledge` \| `handoff` |
| `maxSteps` / `timeout` / `estimatedCost` | Orçamento |

Handoff típico (treino/recovery): `context_engine` → `safety_engine` → `decision_engine`.

Exemplo: *"Estou muito cansado hoje, mas queria treinar."* → `specialist_recovery` + `specialist_training` + handoff Decision.

## Gates

- Agents / tools / skills não autorizados → `rejected`
- Loop (mesmo fingerprint do parent) → `rejected`
- `timeout <= 0`, custo > max, steps > max → `rejected`
- Anônimo → `rejected`
- `contextAvailable: false` → `insufficient_context` (fallback `generate_daily_context`, **sem** handoff Decision)

## API

```ts
import { createExecutionPlan } from "@/ai/orchestrator";

const { ok, plan } = createExecutionPlan({
  trustedUserId,
  intent: "Estou cansado mas quero treinar",
  contextAvailable: true,
});
```

Intent classifier é **heurístico determinístico** (sem LLM nesta fase).

## Testes

`src/ai/orchestrator/orchestrator.test.ts` — simple, training, nutrition, recovery, multi-agent, invalid agent/tool, loop, timeout, cost, insufficient context.

Ver [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md), [SKILLS_ARCHITECTURE.md](./SKILLS_ARCHITECTURE.md), [DECISION_ENGINE.md](./DECISION_ENGINE.md).
