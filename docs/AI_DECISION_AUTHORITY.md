# FASE 23 — Decision Authority & AI Output Paths

## Authority

Only the **Decision Engine** (`computeDecisions` via `assembleDecisionContext` → Safety → persist) produces a final **Decision**.

Agents / LLM / Coach / Skills produce **DecisionProposal** only.

Resolution path:

```
DecisionProposal
  → Context fingerprint + Safety
  → resolveProposalAgainstEngine
  → Decision (from engine bundle — never copied from proposed_value)
  → Living Plan / Action
```

Canonical product path:

`askAiCoach` → `runCoachAgent` → `runProductionAiRuntime` → `runAuthoritativeBridge`

## What does NOT need Decision Engine

| Output | Path | Notes |
|--------|------|--------|
| Meal AI suggestion (macros) | Gateway `meal_ai` | Suggestion only; no Living Plan write |
| Deterministic catalog voice parse | Local | No LLM |
| Observational audit / metrics | Governance | Not state mutation |

## What MUST use Decision Engine

Any output that changes critical user state: training decisions, recovery escalations, goal adaptation that mutates plan, Living Plan writes.

## Parallel path rule (FASE 23.3)

- No direct `fetch` to OpenAI/Anthropic from product modules.
- Meal AI and legacy `callCoachProvider` go through Gateway controls (kill switch, rate limit, audit, timeout).
- E2E harness (`runAiE2EPipeline`) is TEST_ONLY — import from `@/ai/e2e`, not public `@/ai` barrel.
