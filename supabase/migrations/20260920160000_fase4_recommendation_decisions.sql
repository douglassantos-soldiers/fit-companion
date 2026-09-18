-- FASE 4: Decision log for Context + Decision Engine
CREATE TABLE IF NOT EXISTS public.recommendation_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  engine TEXT NOT NULL DEFAULT 'decision_v1',
  decision_type TEXT NOT NULL,
  decision_value JSONB NOT NULL,
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(4, 3),
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recommendation_decisions_user_date_idx
  ON public.recommendation_decisions (user_id, date DESC);

CREATE INDEX IF NOT EXISTS recommendation_decisions_user_type_idx
  ON public.recommendation_decisions (user_id, decision_type, created_at DESC);

ALTER TABLE public.recommendation_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.recommendation_decisions FROM anon, authenticated;
GRANT ALL ON TABLE public.recommendation_decisions TO service_role;
