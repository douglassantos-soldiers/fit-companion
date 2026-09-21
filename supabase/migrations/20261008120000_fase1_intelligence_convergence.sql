-- FASE 1 Intelligence Convergence: day's assembled DecisionContextSnapshot
-- Envelope for UI/Coach hydration. recommendation_decisions remains the learning ledger.

CREATE TABLE IF NOT EXISTS public.decision_context_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  engine TEXT NOT NULL DEFAULT 'decision_v1',
  snapshot_version INTEGER NOT NULL DEFAULT 1,
  customer360_version BIGINT,
  stale360 BOOLEAN NOT NULL DEFAULT false,
  input_fingerprint TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT decision_context_snapshots_user_date_uidx UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS decision_context_snapshots_user_date_idx
  ON public.decision_context_snapshots (user_id, date DESC);

CREATE INDEX IF NOT EXISTS decision_context_snapshots_user_updated_idx
  ON public.decision_context_snapshots (user_id, updated_at DESC);

ALTER TABLE public.decision_context_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.decision_context_snapshots FROM anon, authenticated;
GRANT ALL ON TABLE public.decision_context_snapshots TO service_role;
