# FASE 23 — Production Readiness Matrix

**Commit:** `af82ed7f9485144509bc478739fafe50daabd656`  
**Environment:** `LOCAL_TEST` (remote Supabase with service_role)  
**Certified at:** see `docs/certification/latest.json` timestamp  

| Gate | Status | Evidence |
|------|--------|----------|
| Current Commit | PASS | Exact SHA match HEAD `af82ed7` (ancestor/prefix não aceitos) |
| Supabase | PASS | database-readiness PASS + probe-ai-tables HTTP 200 |
| Migrations | PASS | remote verification PASS |
| RAG | PASS | seed 25 docs (`AI_RAG_ENV=production`); retrieval READY |
| Memory | PASS | SupabaseMemoryStore ping + isolation |
| LLM Gateway | PASS (structural) | live provider probe **BLOCKED** without keys — see `llm-live-probe.json` |
| Decision Authority | PASS | proposal ≠ decision; natural specialist→bridge E2E |
| Identity/RLS | PASS | ai_* service_role-only; device_id provenance only |
| Audit | PASS | critical persist + readback `audit_id` on E2E |
| Rate Limit | PASS | `ai_rate_limit_consume` remote RPC; tool path no longer misuses run_per_invoke |
| Kill Switch | PASS | kill-switch-readiness PASS |
| CI Structural Gate | PASS | `npm run ai:ci-verdict` exit 0 |
| Production Release Gate | PASS | `npm run ai:release-verdict` + exact SHA |
| Production E2E | PASS | happy `natural_path` (no aligned_proposal fallback) |
| Certification | PASS | `production_ready: true` on HEAD |
| Sync partial | PASS (code) | client no ACK on partial; clearAccountData remote-first |
| UI smoke | PENDING_OPERATOR | `docs/certification/ui-smoke-checklist.md` |

## Notes

- Coach product path remains **deterministic** (plan default).
- Live LLM provider probe requires `AI_LLM_LIVE_PROBE=1` + API keys. Absent keys → **BLOCKED** evidence in `docs/certification/llm-live-probe.json` (does not block deterministic `production_ready`).
- Happy E2E uses orchestrator → specialist_training → analyze_training → DecisionProposal → authoritative bridge (no synthetic aligned_proposal).
- Loose SQL reconciled in `docs/FASE_23_SQL_RECONCILIATION.md`.
- Baseline discovery: `docs/FASE_23_BASELINE.md`.
