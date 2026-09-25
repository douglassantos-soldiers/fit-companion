-- FASE 11 — AI Governance audit persistence
-- Service-role only writes (same pattern as ai_* Memory FASE 9).
-- App must redact secrets before insert. Never expose service_role to client.

CREATE TABLE IF NOT EXISTS public.ai_audit_events (
  audit_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL
    CHECK (kind IN (
      'agent_run',
      'skill_run',
      'tool_call',
      'rag_retrieval',
      'decision',
      'outcome',
      'learning_event'
    )),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  subject_id TEXT NOT NULL,
  run_id TEXT,
  parent_run_id TEXT,
  agent_id TEXT,
  agent_version TEXT,
  skill_id TEXT,
  tool_id TEXT,
  retrieval_id TEXT,
  decision_id TEXT,
  outcome_id TEXT,
  learning_event_id TEXT,
  context_fingerprint TEXT,
  status TEXT,
  latency_ms INTEGER,
  model TEXT,
  estimated_cost NUMERIC,
  summary TEXT,
  token_usage JSONB,
  metadata JSONB,
  session_id TEXT,
  role TEXT,
  governance_version TEXT NOT NULL DEFAULT 'governance_v1',
  contract_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS ai_audit_events_user_created_idx
  ON public.ai_audit_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_audit_events_run_idx
  ON public.ai_audit_events (run_id)
  WHERE run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_audit_events_kind_created_idx
  ON public.ai_audit_events (kind, created_at DESC);

ALTER TABLE public.ai_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_audit_events FROM anon, authenticated;
GRANT ALL ON public.ai_audit_events TO service_role;

-- No authenticated policies: Governance persist API is the only write path (service_role).

COMMENT ON TABLE public.ai_audit_events IS
  'FASE11 AI Governance audit (persist_v1). Dual-write from in-memory ring buffer; redacted metadata only.';
