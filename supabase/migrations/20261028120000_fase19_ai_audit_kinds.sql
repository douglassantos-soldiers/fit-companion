-- FASE 19 — Align ai_audit_events.kind CHECK with AiAuditKind
-- Adds ai_gateway + proposal_merge (introduced in FASE 17/18).

ALTER TABLE public.ai_audit_events DROP CONSTRAINT IF EXISTS ai_audit_events_kind_check;

ALTER TABLE public.ai_audit_events
  ADD CONSTRAINT ai_audit_events_kind_check CHECK (
    kind IN (
      'agent_run',
      'skill_run',
      'tool_call',
      'rag_retrieval',
      'decision',
      'outcome',
      'learning_event',
      'ai_gateway',
      'proposal_merge'
    )
  );

COMMENT ON CONSTRAINT ai_audit_events_kind_check ON public.ai_audit_events IS
  'FASE19: includes ai_gateway + proposal_merge';
