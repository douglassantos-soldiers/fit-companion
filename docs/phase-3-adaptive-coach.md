# PHASE 3 — Adaptive Coach Platform

## Objetivo

Transformar o AI Coach (FASE 6) em uma **Adaptive Coach Platform** data-first em `src/lib/coach/`, conectada a Customer360, Context, Safety, Recommendation, Decision Log e Training/Nutrition — sem o LLM ser fonte de verdade e sem Behavior Engine completo.

Referências conceituais apenas: Coach Leo, AI Coach openGym. Nenhum código copiado.

## Regra fundamental

```
USER REQUEST → AUTH → IDENTITY → CUSTOMER360 → CONTEXT → SAFETY → RECOMMENDATION → DECISION → COACH → RESPONSE
```

Engines calculam. Decision decide. Coach explica / propõe. UI executa.

## Arquitetura

```
src/lib/coach/
  context.server · tools · memory.server · proposals · actions · classify · provider
  workflows/ (morning-checkin, post-workout, weekly-review, …)
        │
        ├── coach.functions.ts (askAiCoach + review fns)
        ├── coach-contract.ts (prompt server-only)
        └── routes/coach.tsx (evidence + action links)
```

## CoachContext tipado

`buildCoachContext(userId, date)` hidrata DB e monta JSON allowlisted (perfil, treino, PRs/1RM, recovery, nutrição, C360, decisões, patterns, safety, memory).  
`formatCoachContextForPrompt` — **não** envia AppState inteiro nem secrets/commerce raw.

## Tools

Allowlist server-side; `trustedUserId` da sessão — `args.userId` forjado é rejeitado.  
Prefetch em turns factual/explanatory (ex.: “por que leve?” → recovery + decisions + today plan).

## Workflows

Determinísticos: analysis → proposal → outcomeExpectation. LLM só narra.  
`weeklyReview` / `postWorkout` também via `runWeeklyReviewFn` / `runPostWorkoutReviewFn`.

## Memory / Proposals

- `coach_memories` — facts, preferences, patterns, recent_decisions, coach_notes (cap por kind)
- `coach_sessions` — resumo, não transcript infinito
- `coach_proposals` — propostas validadas vs Safety/Decision; writes service_role

## Security

Access session + trusted identity + rate limit + system prompt 100% server + tools allowlisted.

## Migration

`supabase/migrations/20260926120000_fase3_adaptive_coach.sql`

## Testes

`src/lib/coach/adaptive-coach.test.ts` — prompt protection, classify, evidence, tools allowlist, proposal validation, post-workout, weekly review.

## Fora de escopo

Behavior Engine completo, redesign do chat, multi-agent, coach escrevendo sessions/meals direto.
