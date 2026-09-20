-- PHASE 1 Deep Training Engine — derived tables (add-only, sessions JSONB remains SoT)
-- RLS: service_role + owner policies (auth.uid via users.auth_user_id)

CREATE TABLE IF NOT EXISTS public.exercise_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  best_weight NUMERIC NOT NULL DEFAULT 0,
  best_reps NUMERIC NOT NULL DEFAULT 0,
  best_volume NUMERIC NOT NULL DEFAULT 0,
  estimated_1rm NUMERIC NOT NULL DEFAULT 0,
  recent_weight NUMERIC NOT NULL DEFAULT 0,
  recent_reps NUMERIC NOT NULL DEFAULT 0,
  recent_rpe TEXT,
  trend TEXT NOT NULL DEFAULT 'unknown',
  last_performed_at DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS public.personal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  exercise_id TEXT,
  pr_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  previous_value NUMERIC,
  session_id TEXT,
  achieved_at DATE NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS personal_records_dedupe
  ON public.personal_records (user_id, COALESCE(exercise_id, ''), pr_type, value, achieved_at);

CREATE TABLE IF NOT EXISTS public.exercise_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  preference TEXT NOT NULL CHECK (preference IN ('preferred', 'neutral', 'disliked', 'avoided')),
  reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS public.muscle_load_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  muscle TEXT NOT NULL,
  direct_sets NUMERIC NOT NULL DEFAULT 0,
  indirect_sets NUMERIC NOT NULL DEFAULT 0,
  effective_sets NUMERIC NOT NULL DEFAULT 0,
  rolling_7d NUMERIC NOT NULL DEFAULT 0,
  rolling_28d NUMERIC NOT NULL DEFAULT 0,
  load_trend TEXT NOT NULL DEFAULT 'unknown',
  fatigue_contribution NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, muscle)
);

CREATE INDEX IF NOT EXISTS exercise_performance_user_idx ON public.exercise_performance (user_id);
CREATE INDEX IF NOT EXISTS personal_records_user_idx ON public.personal_records (user_id);
CREATE INDEX IF NOT EXISTS exercise_preferences_user_idx ON public.exercise_preferences (user_id);
CREATE INDEX IF NOT EXISTS muscle_load_snapshots_user_date_idx ON public.muscle_load_snapshots (user_id, date DESC);

ALTER TABLE public.exercise_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muscle_load_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.exercise_performance FROM anon, authenticated;
REVOKE ALL ON public.personal_records FROM anon, authenticated;
REVOKE ALL ON public.exercise_preferences FROM anon, authenticated;
REVOKE ALL ON public.muscle_load_snapshots FROM anon, authenticated;

GRANT ALL ON public.exercise_performance TO service_role;
GRANT ALL ON public.personal_records TO service_role;
GRANT ALL ON public.exercise_preferences TO service_role;
GRANT ALL ON public.muscle_load_snapshots TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_performance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.muscle_load_snapshots TO authenticated;

DROP POLICY IF EXISTS exercise_performance_owner_select ON public.exercise_performance;
CREATE POLICY exercise_performance_owner_select ON public.exercise_performance
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS exercise_performance_owner_write ON public.exercise_performance;
CREATE POLICY exercise_performance_owner_write ON public.exercise_performance
  FOR ALL TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS personal_records_owner_select ON public.personal_records;
CREATE POLICY personal_records_owner_select ON public.personal_records
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS personal_records_owner_write ON public.personal_records;
CREATE POLICY personal_records_owner_write ON public.personal_records
  FOR ALL TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS exercise_preferences_owner_select ON public.exercise_preferences;
CREATE POLICY exercise_preferences_owner_select ON public.exercise_preferences
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS exercise_preferences_owner_write ON public.exercise_preferences;
CREATE POLICY exercise_preferences_owner_write ON public.exercise_preferences
  FOR ALL TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS muscle_load_snapshots_owner_select ON public.muscle_load_snapshots;
CREATE POLICY muscle_load_snapshots_owner_select ON public.muscle_load_snapshots
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS muscle_load_snapshots_owner_write ON public.muscle_load_snapshots;
CREATE POLICY muscle_load_snapshots_owner_write ON public.muscle_load_snapshots
  FOR ALL TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
