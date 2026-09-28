# AI Production Certification (FASE 22.7)

Certificação de produção **real**. Defaults cosmética (`?? "pass"`, `test_suite_ok: true`) foram eliminados.

## Regras

| Estado | Satisfaz gate? |
|--------|----------------|
| **PASS** (com `executed_at`) | Sim |
| FAIL | Não |
| **UNTESTED** | Não — bloqueia |
| BLOCKED | Não — bloqueia |
| DEGRADED | Não — bloqueia critical |
| SKIPPED / UNKNOWN / MOCKED | Nunca mapeiam para PASS |

**Somente EXECUTED + PASS** satisfaz um gate.

## Como rodar

```bash
npm run ai:certification
# report-only (exit 0 mesmo se not ready):
CERT_REPORT_ONLY=1 npm run ai:certification
# FASE 22.13 final aggregator:
npm run ai:certification:final
```

Entrypoint: `runProductionCertification()` em [`src/ai/certification/run-production-certification.ts`](../src/ai/certification/run-production-certification.ts).

## O que executa

1. **Suite Vitest real** (spawn `npx vitest run` nos testes de cert — nunca `ok: true` hardcoded)
2. **Probes** (cada um com `duration_ms` + `evidence`):
   identity, authorization, context, safety, decision_engine, proposal_contract, tools, skills, rag, memory, llm, audit, database, rate_limit, kill_switch, rollback, migrations, e2e (FASE 22.12 production readiness), cost
3. **Gates críticos (100%)**
   - `critical_safety`
   - `proposal_validity`
   - `tool_authorization`
4. **Persistência**
   - `docs/certification/latest.json`
   - `docs/certification/history/<timestamp>.json`
   - `docs/AI_PRODUCTION_READINESS_REPORT.md`

Report inclui: `timestamp`, `commit_sha`, `environment`, `checks`, `failures`, `warnings`, `evidence`, `production_ready`, `test_suite`.

## `production_ready`

`true` somente se:

- todos os checks **critical** = PASS executado
- nenhum critical em FAIL / UNTESTED / BLOCKED / DEGRADED
- suite Vitest `executed && ok`
- gates = 100%

Caso contrário `false` com falhas explícitas. Remoto inacessível → **BLOCKED** (não PASS).

## Meta-teste

[`certification-integrity.test.ts`](../src/ai/certification/certification-integrity.test.ts) garante UNTESTED ≠ PASS.

## Migrations probe

Permission/RLS errors → `unavailable` / BLOCKED — **não** contam como applied.

**Veredito local típico:** `production_ready: false` com RAG corpus vazio e/ou DB remoto BLOCKED — **correto**. Não declarar produção pronta sem certificação real verde.

Report-only (não falha o processo): `CERT_REPORT_ONLY=1 npm run ai:certification`

CI gate: [AI_CI_CD_GATES.md](./AI_CI_CD_GATES.md) (`npm run ai:ci-verdict`).

## Ver também

- [AI_PRODUCTION_CERTIFICATION_FINAL.md](./AI_PRODUCTION_CERTIFICATION_FINAL.md) — FASE 22.13 final certification
- [AI_PRODUCTION_E2E.md](./AI_PRODUCTION_E2E.md) — FASE 22.12 real production smoke
- [AI_PRODUCTION_RUNBOOK.md](./AI_PRODUCTION_RUNBOOK.md)
- [AI_ROLLBACK.md](./AI_ROLLBACK.md)
- [AI_AUDIT_DURABILITY.md](./AI_AUDIT_DURABILITY.md)
- [AI_PRODUCTION_READINESS_REPORT.md](./AI_PRODUCTION_READINESS_REPORT.md)
