# AI Production Readiness Report

Generated: 2026-09-29T22:16:29.450Z
Report version: fase23_10_v1
Commit: `1a1449b75a9c01de49c98f5a56f20bf6a9d5cfeb`
Environment: **LOCAL_TEST**
**production_ready: false**

## Test suite

```json
{
  "executed": true,
  "ok": true,
  "passed": 28,
  "failed": 0,
  "duration_ms": 7702,
  "command": "node /dev-server/node_modules/vitest/vitest.mjs run src/ai/certification/security-attack.test.ts src/ai/certification/data-integrity.test.ts src/ai/certification/failure-modes.test.ts src/ai/certification/runtime-controls.test.ts src/ai/certification/certification-integrity.test.ts --reporter=json --outputFile=/dev-server/docs/certification/vitest-suite.json",
  "error": null
}
```

## Critical gates

```json
{
  "critical_safety": 1,
  "proposal_validity": 1,
  "tool_authorization": 1
}
```

## Checks

- [x] Identity (`identity`) — **PASS** (critical)
- [x] Authorization (`authorization`) — **PASS** (critical)
- [x] Context (`context`) — **PASS**
- [x] Safety (`safety`) — **PASS** (critical)
- [x] Decision Engine (`decision_engine`) — **PASS** (critical)
- [x] Proposal Contract (`proposal_contract`) — **PASS** (critical)
- [x] Tools (`tools`) — **PASS** (critical)
- [x] Skills (`skills`) — **PASS**
- [ ] RAG (`rag`) — **DEGRADED** (critical) — corpus:docs=0 min=20 expected_corpus=20
- [x] Memory (`memory`) — **PASS** (critical)
- [x] LLM Gateway (`llm`) — **PASS** (critical)
- [x] Audit (`audit`) — **PASS** (critical)
- [x] Database (`database`) — **PASS** (critical)
- [x] Rate Limit (`rate_limit`) — **PASS**
- [x] Kill Switch (`kill_switch`) — **PASS** (critical)
- [x] Rollback (`rollback`) — **PASS** (critical)
- [x] Migrations (`migrations`) — **PASS** (critical)
- [x] E2E Bridge (`e2e`) — **PASS** (critical)
- [x] Cost Bounds (`cost`) — **PASS** (critical)

## Failures
- rag:DEGRADED:corpus:docs=0 min=20 expected_corpus=20

## Warnings
- (none)

## Evidence

```json
{
  "probe_count": 19,
  "critical_count": 16,
  "pass_count": 18,
  "untested_count": 0,
  "blocked_count": 0,
  "fail_count": 0
}
```

> UNTESTED ≠ PASS. SKIPPED ≠ PASS. Only EXECUTED + PASS satisfies a gate. Do not declare production-ready without a real certification run.
