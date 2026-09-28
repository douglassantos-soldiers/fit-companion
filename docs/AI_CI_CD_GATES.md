# AI CI/CD Safety Gates (FASE 22.8)

Barreira real contra regressões na arquitetura de IA. **Não** permite green com checks não executados (UNTESTED ≠ PASS).

Workflow: [`.github/workflows/ai-eval.yml`](../.github/workflows/ai-eval.yml) (`AI CI/CD Safety Gate`).

## Triggers

Push / PR quando mudam:

- `src/ai/**`, `src/lib/engine/**`, `src/lib/coach/**`
- `supabase/migrations/**`
- scripts AI / cert / mock-guard / verdict
- `docs/AI_*.md`, `package.json`, `vitest.config.ts`, `tsconfig.json`, o próprio workflow
- `workflow_dispatch`

## Pipeline (sequencial, bloqueante)

```
lint → typecheck → unit → integration → AI eval → security → regression → db-readiness → rate-limit → kill-switch → prod-e2e → certification → certification-final → verdict → build
```

| Step | Comando |
|------|---------|
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Unit | `npm run test:ai-unit` |
| Integration | `npm run test:ai-integration` |
| AI Evaluation | `npm run test:eval` (12 modes + golden_v1 + thresholds) |
| Mock guard | `npm run guard:ai-mock` |
| Security | `npm run test:ai-security` |
| Regression | `npm run test:ai-regression` |
| DB readiness | `npm run ai:db-readiness` (FASE 22.9; BLOCKED sem secret OK) |
| Rate limit | `npm run ai:rate-limit` (FASE 22.10; BLOCKED sem secret OK) |
| Kill switch | `npm run ai:kill-switch` (FASE 22.11) |
| Prod E2E | `npm run ai:prod-e2e` (FASE 22.12; BLOCKED sem secret OK) |
| Certification | `CERT_REPORT_ONLY=1 npm run ai:certification` |
| Final cert | `npm run ai:certification:final` (FASE 22.13) |
| Verdict | `node scripts/ai-ci-gate-verdict.mjs` |
| Build | `npm run build` |

Artifact (sempre): `docs/certification/latest.json`, `vitest-suite.json`, `database-readiness.json`, `rate-limit-readiness.json`, `kill-switch-readiness.json`, `production-e2e.json`, `final.json`, `AI_PRODUCTION_READINESS_REPORT.md`, `AI_PRODUCTION_CERTIFICATION_FINAL.md`.

## Veredicto: PASS / FAIL / BLOCKED

Script: [`scripts/ai-ci-gate-verdict.mjs`](../scripts/ai-ci-gate-verdict.mjs)

| Gate | Significado | Exit |
|------|-------------|------|
| **FAIL** | Report ausente, suite não executada, critical `FAIL`/`UNTESTED`, ou `production_ready` exigido com service role e false | 1 |
| **BLOCKED** | Probes remotas BLOCKED/DEGRADED (DB/migrations/RAG sem secret) sem FAIL local | 0 |
| **PASS** | `production_ready: true` e nenhum blocker | 0 |

Com secret `SUPABASE_SERVICE_ROLE_KEY` no repo: exige `production_ready === true` (senão FAIL).

## Regression suite

[`src/ai/ci/ai-regression-suite.test.ts`](../src/ai/ci/ai-regression-suite.test.ts) cobre:

- 12 negatives: wrong_user, unauthorized_tool, invalid_proposal, safety_rejection, wrong_evidence, rag_failure, tool_failure, model_timeout, cost_limit, missing_context, hallucination, unsupported_claim
- Thresholds 100% safety / proposal / tool authorization
- Golden citation/unsupported claim
- Mock em production, InMemory RAG/Memory em production, UNTESTED≠PASS, no direct Decision/Living Plan write

## Local

```bash
npm run lint && npm run typecheck
npm run test:ai-unit
npm run test:ai-integration
npm run test:eval
npm run guard:ai-mock
npm run test:ai-security
npm run test:ai-regression
npm run ai:db-readiness
npm run ai:rate-limit
npm run ai:kill-switch
npm run ai:prod-e2e
npm run ai:certification:final
CERT_REPORT_ONLY=1 npm run ai:certification
npm run ai:ci-verdict
npm run build
```

## Ver também

- [AI_EVALUATION.md](./AI_EVALUATION.md)
- [AI_PRODUCTION_CERTIFICATION.md](./AI_PRODUCTION_CERTIFICATION.md)
- [AI_PRODUCTION_CERTIFICATION_FINAL.md](./AI_PRODUCTION_CERTIFICATION_FINAL.md)
- [AI_DATABASE_READINESS.md](./AI_DATABASE_READINESS.md)
- [AI_RATE_LIMITING.md](./AI_RATE_LIMITING.md)
- [AI_KILL_SWITCH.md](./AI_KILL_SWITCH.md)
- [AI_PRODUCTION_E2E.md](./AI_PRODUCTION_E2E.md)
- [AI_MOCK_POLICY.md](./AI_MOCK_POLICY.md)
- [AI_PRODUCTION_RUNBOOK.md](./AI_PRODUCTION_RUNBOOK.md)
