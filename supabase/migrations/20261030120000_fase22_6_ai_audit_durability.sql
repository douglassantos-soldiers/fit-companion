-- FASE 22.6 — Durable Critical AI Audit indexes
-- Correlation lookups by decision_id and parent_run_id.
-- RLS unchanged: service_role only (FASE 11).

CREATE INDEX IF NOT EXISTS ai_audit_events_decision_id_idx
  ON public.ai_audit_events (decision_id)
  WHERE decision_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_audit_events_parent_run_idx
  ON public.ai_audit_events (parent_run_id)
  WHERE parent_run_id IS NOT NULL;

COMMENT ON INDEX public.ai_audit_events_decision_id_idx IS
  'FASE22.6: reconstruct Decision audit trail by decision_id';

COMMENT ON INDEX public.ai_audit_events_parent_run_idx IS
  'FASE22.6: correlation chain via parent_run_id';
