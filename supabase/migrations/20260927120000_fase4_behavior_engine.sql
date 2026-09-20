-- PHASE 4 Behavior Engine — patterns, interventions, outcomes, experiments
-- Does NOT duplicate Customer360. Writes prefer service_role (like coach_proposals).

CREATE TABLE IF NOT EXISTS public.behavior_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  support_count INTEGER NOT NULL DEFAULT 0,
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate', 'active', 'decayed')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

CREATE INDEX IF NOT EXISTS behavior_patterns_user_idx ON public.behavior_patterns (user_id);
CREATE INDEX IF NOT EXISTS behavior_patterns_user_status_idx ON public.behavior_patterns (user_id, status);

CREATE TABLE IF NOT EXISTS public.behavior_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trigger_key TEXT NOT NULL,
  type TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  expected_outcome TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'shown', 'accepted', 'dismissed', 'completed')),
  channel TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS behavior_interventions_user_idx ON public.behavior_interventions (user_id);
CREATE INDEX IF NOT EXISTS behavior_interventions_user_created_idx
  ON public.behavior_interventions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.behavior_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  intervention_id UUID REFERENCES public.behavior_interventions(id) ON DELETE SET NULL,
  success BOOLEAN NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS behavior_outcomes_user_idx ON public.behavior_outcomes (user_id);
CREATE INDEX IF NOT EXISTS behavior_outcomes_user_observed_idx
  ON public.behavior_outcomes (user_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS public.behavior_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id TEXT,
  target TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  baseline NUMERIC NOT NULL DEFAULT 0,
  result NUMERIC,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS behavior_experiments_user_idx ON public.behavior_experiments (user_id);
CREATE INDEX IF NOT EXISTS behavior_experiments_user_status_idx
  ON public.behavior_experiments (user_id, status);

-- RLS
ALTER TABLE public.behavior_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_experiments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.behavior_patterns FROM anon, authenticated;
REVOKE ALL ON public.behavior_interventions FROM anon, authenticated;
REVOKE ALL ON public.behavior_outcomes FROM anon, authenticated;
REVOKE ALL ON public.behavior_experiments FROM anon, authenticated;

GRANT ALL ON public.behavior_patterns TO service_role;
GRANT ALL ON public.behavior_interventions TO service_role;
GRANT ALL ON public.behavior_outcomes TO service_role;
GRANT ALL ON public.behavior_experiments TO service_role;

GRANT SELECT ON public.behavior_patterns TO authenticated;
GRANT SELECT ON public.behavior_interventions TO authenticated;
GRANT SELECT ON public.behavior_outcomes TO authenticated;
GRANT SELECT ON public.behavior_experiments TO authenticated;

DROP POLICY IF EXISTS behavior_patterns_owner_select ON public.behavior_patterns;
CREATE POLICY behavior_patterns_owner_select ON public.behavior_patterns
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS behavior_interventions_owner_select ON public.behavior_interventions;
CREATE POLICY behavior_interventions_owner_select ON public.behavior_interventions
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS behavior_outcomes_owner_select ON public.behavior_outcomes;
CREATE POLICY behavior_outcomes_owner_select ON public.behavior_outcomes
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS behavior_experiments_owner_select ON public.behavior_experiments;
CREATE POLICY behavior_experiments_owner_select ON public.behavior_experiments
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
