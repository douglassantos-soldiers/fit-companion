# Coach Agent — Performance OS

O Coach **não** é um chatbot isolado. É a interface que orquestra o pipeline AI.

```
USER
  → COACH AGENT (runCoachAgent)
  → ORCHESTRATOR (createExecutionPlan)
  → SPECIALIST AGENTS (runSpecialistAgent)
  → Context / RAG / Memory / MCP (via skills/tools)
  → Safety + Decision facts (SoT)
  → Coach Response (determinística)
```

## Responsabilidades

- Entender intenção (incl. **"Por que meu plano mudou?"**)
- Buscar contexto / chamar especialistas / Skills / RAG / Memory
- Explicar decisões e mudanças no Living Plan com **Decision + Evidence + Context + Outcome**
- Apresentar evidências

## Proibido

- Inventar dados ou justificativas
- Acessar DB diretamente
- Alterar Living Plan diretamente
- Ignorar Safety
- Criar decisão crítica fora do Decision Engine

## Insufficient context

Se `contextAvailable: false` ou plano `insufficient_context` → resposta honesta, sem invenção.

## API

```ts
import { runCoachAgent } from "@/ai/agents/coach";

const out = await runCoachAgent({
  trustedUserId,
  message: "Por que meu plano mudou?",
});
// out.text / out.structured — fatos apenas
```

Produto: [`askAiCoach`](../src/lib/coach.functions.ts) chama `runCoachAgent` (sem UI change).

## WHY

Intent `why_plan_changed` força especialista de performance + `explain_decision` / `analyze_outcome`.  
Sem reason codes / decisões → `insufficient_evidence`.

Ver [AGENTS_ARCHITECTURE.md](./AGENTS_ARCHITECTURE.md), [ORCHESTRATOR.md](./ORCHESTRATOR.md), [DECISION_ENGINE.md](./DECISION_ENGINE.md).
