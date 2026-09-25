# Skills Framework — Performance OS

Capacidades especializadas e reutilizáveis. **Agent** = raciocínio/orquestração (futuro). **Skill** = capacidade versionada que só acessa dados via Tool Layer.

## Princípio

```
Agent / Caller
  → runSkill
  → Auth (TrustedUserId)
  → Input Validation
  → Skill.execute
  → callTool → invokeTool (MCP)
  → Domain (via Tools)
  → SkillResult (+ SkillProposal opcional)
```

**Nunca:** Skill → Database.  
**Crítico:** Skills emitem `SkillProposal` → bridge `toDecisionProposalFromSkill` → Decision Engine (autoridade).

## Estrutura

```
src/ai/skills/
  core/           registry, run, tool-bridge, proposal
  training/       6 skills
  nutrition/      3
  recovery/       3
  behavior/       3
  performance/    4
```

## SkillResult

```ts
{
  result: unknown;
  evidence: [{ signal, value, source? }];
  confidence: number;
  warnings: string[];
  proposal?: SkillProposal | null;
}
```

## Skills iniciais (determinísticas)

| Domain | Skills |
|--------|--------|
| training | analyze_training, select_exercise, substitute_exercise, adjust_training_load, progression, regression |
| nutrition | analyze_nutrition, adjust_macros, meal_substitution |
| recovery | analyze_sleep, analyze_recovery, analyze_fatigue |
| behavior | analyze_adherence, detect_friction, habit_intervention |
| performance | analyze_performance, explain_decision, analyze_outcome, generate_daily_context |

`required_knowledge` usa refs `kb:*` — resolução via `resolveKnowledgeRefs` em [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md) (skills ainda não auto-fetchem no `runSkill`).

## API

```ts
import { runSkill, registerAllSkills, toDecisionProposalFromSkill } from "@/ai/skills";

const out = await runSkill({
  skillId: "adjust_training_load",
  trustedUserId, // resolveTrustedIdentity
  input: { date: "2026-03-11" },
});

if (out.data?.proposal) {
  const decisionProposal = toDecisionProposalFromSkill(out.data.proposal);
  // → resolveProposalAgainstEngine(snapshot)
}
```

## Anti-spaghetti

Um caminho: Orchestrator → Specialist Agent → Skills + Tools → Proposal → Context → Safety → Decision Engine.

Ver [MCP_ARCHITECTURE.md](./MCP_ARCHITECTURE.md), [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md), [ORCHESTRATOR.md](./ORCHESTRATOR.md), [DECISION_ENGINE.md](./DECISION_ENGINE.md), [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md).

## Testes

`src/ai/skills/skills.test.ts` — registry 19, anonymous, invalid input, cada skill com mock tools, proposals, explain_decision.
