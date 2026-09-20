-- FASE 7: Nutrition Intelligence + Supplement Intelligence
-- Dose logging (consumption) separate from purchases; meal provenance in payload;
-- profile prefs JSONB for nutrition intelligence.

-- ===== 1. profiles.prefs (nutritionProfile, skipBreakfast, etc.) =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ===== 2. supplement_dose_logs (SoT for consumption) =====
CREATE TABLE IF NOT EXISTS public.supplement_dose_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id TEXT,
  client_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  dose NUMERIC(10, 3) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'serving',
  frequency TEXT NOT NULL DEFAULT '1x_day',
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'manual',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supplement_dose_logs_unit_check
    CHECK (unit IN ('g', 'ml', 'caps', 'scoop', 'serving')),
  CONSTRAINT supplement_dose_logs_source_check
    CHECK (source IN ('manual', 'routine_toggle')),
  UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS supplement_dose_logs_user_taken_idx
  ON public.supplement_dose_logs (user_id, taken_at DESC);

CREATE INDEX IF NOT EXISTS supplement_dose_logs_user_product_idx
  ON public.supplement_dose_logs (user_id, product_id, taken_at DESC);

ALTER TABLE public.supplement_dose_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.supplement_dose_logs FROM anon, authenticated;
GRANT ALL ON TABLE public.supplement_dose_logs TO service_role;

-- Defense-in-depth ownership policies (writes primarily via service_role sync)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.supplement_dose_logs TO authenticated;

DROP POLICY IF EXISTS supplement_dose_logs_owner_select ON public.supplement_dose_logs;
CREATE POLICY supplement_dose_logs_owner_select ON public.supplement_dose_logs
  FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS supplement_dose_logs_owner_insert ON public.supplement_dose_logs;
CREATE POLICY supplement_dose_logs_owner_insert ON public.supplement_dose_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS supplement_dose_logs_owner_update ON public.supplement_dose_logs;
CREATE POLICY supplement_dose_logs_owner_update ON public.supplement_dose_logs
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS supplement_dose_logs_owner_delete ON public.supplement_dose_logs;
CREATE POLICY supplement_dose_logs_owner_delete ON public.supplement_dose_logs
  FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()))
  );

-- updated_at trigger if helper exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_supplement_dose_logs_updated_at ON public.supplement_dose_logs;
    CREATE TRIGGER update_supplement_dose_logs_updated_at
      BEFORE UPDATE ON public.supplement_dose_logs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
