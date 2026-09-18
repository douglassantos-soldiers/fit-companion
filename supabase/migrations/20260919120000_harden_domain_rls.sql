-- Harden domain + meal_entries + hubs/engagement: service_role only for writes.
-- Client sync/social mutations must go through server fns (service_role).
-- SELECT on social remains public for leaderboards/feeds.

-- ===== Domain tables: revoke anon/authenticated =====
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles',
    'sessions',
    'weights',
    'daily_metrics',
    'supplement_logs',
    'app_state',
    'meal_entries'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
      -- Drop known open policies
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_device_access', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_access', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all', t);
      EXECUTE format('DROP POLICY IF EXISTS meal_entries_all ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', '"' || t || '_device_access"', t);
    END IF;
  END LOOP;
END $$;

-- Explicit drop for profiles-style quoted policy names from early migration
DROP POLICY IF EXISTS "profiles_device_access" ON public.profiles;
DROP POLICY IF EXISTS "sessions_device_access" ON public.sessions;
DROP POLICY IF EXISTS "weights_device_access" ON public.weights;
DROP POLICY IF EXISTS "daily_metrics_device_access" ON public.daily_metrics;
DROP POLICY IF EXISTS "supplement_logs_device_access" ON public.supplement_logs;
DROP POLICY IF EXISTS "app_state_device_access" ON public.app_state;
DROP POLICY IF EXISTS meal_entries_all ON public.meal_entries;

-- ===== Social / engagement / hubs: SELECT public, no anon writes =====
DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'social_profiles',
    'challenge_entries',
    'challenge_progress',
    'clubs',
    'club_members',
    'activity_events',
    'club_league_weeks',
    'friend_quests',
    'club_stories',
    'activity_kudos',
    'engagement_events',
    'hubs',
    'hub_challenges',
    'hub_members'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);

      FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
      END LOOP;

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
        t || '_select_public',
        t
      );
    END IF;
  END LOOP;
END $$;
