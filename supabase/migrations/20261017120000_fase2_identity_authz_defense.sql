-- FASE 2 — Identity / AuthZ defense-in-depth
-- Goals:
--   1. private.current_app_user_id() SECURITY DEFINER for effective JWT ownership
--   2. Recreate USER_PRIVATE owner policies to use the helper (users table has no SELECT for authenticated)
--   3. Public feed view with minimal columns (no raw device_id as identity)
--   4. Re-confirm social/commerce/admin revoke (idempotent)
-- device_id is NOT identity. App AuthZ remains resolveTrustedIdentity + service_role.

-- ===== A. private helper =====
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT id
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.current_app_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_app_user_id() TO service_role;

COMMENT ON FUNCTION private.current_app_user_id() IS
  'FASE2: maps auth.uid() → public.users.id without requiring SELECT on users (SECURITY DEFINER).';

-- ===== B. Recreate ownership policies on USER_PRIVATE tables =====
DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles',
    'app_state',
    'sessions',
    'weights',
    'daily_metrics',
    'day_checkins',
    'meal_entries',
    'supplement_logs',
    'exercise_performance',
    'personal_records',
    'exercise_preferences',
    'muscle_load_snapshots',
    'meal_items',
    'supplement_dose_logs',
    'coach_memories',
    'coach_sessions',
    'coach_proposals',
    'behavior_patterns',
    'behavior_interventions',
    'behavior_outcomes',
    'behavior_experiments',
    'body_measurements',
    'progress_photos',
    'wearable_connections',
    'push_subscriptions',
    'content_progress'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id'
    ) THEN
      -- Drop existing owner-style policies (name patterns)
      FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t
          AND (
            policyname ILIKE '%owner%'
            OR policyname ILIKE '%_select'
            OR policyname ILIKE '%_write'
            OR policyname ILIKE '%_insert'
            OR policyname ILIKE '%_update'
            OR policyname ILIKE '%_delete'
          )
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
      END LOOP;

      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = private.current_app_user_id())',
        t || '_owner_select_v2', t
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = private.current_app_user_id())',
        t || '_owner_insert_v2', t
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (user_id = private.current_app_user_id()) WITH CHECK (user_id = private.current_app_user_id())',
        t || '_owner_update_v2', t
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (user_id = private.current_app_user_id())',
        t || '_owner_delete_v2', t
      );
    END IF;
  END LOOP;
END $$;

-- ===== C. Public feed view (minimal columns) =====
DROP VIEW IF EXISTS public.activity_events_public;
CREATE VIEW public.activity_events_public
  WITH (security_invoker = true)
AS
SELECT
  id,
  kind,
  display_name,
  payload,
  kudos_count,
  created_at,
  hidden_at,
  user_id
FROM public.activity_events
WHERE COALESCE(payload->>'visibility', 'public') = 'public'
  AND hidden_at IS NULL;

REVOKE ALL ON public.activity_events_public FROM anon, authenticated;
GRANT SELECT ON public.activity_events_public TO anon, authenticated;
GRANT ALL ON public.activity_events_public TO service_role;

COMMENT ON VIEW public.activity_events_public IS
  'FASE2: public feed without device_id; prefer this over direct activity_events SELECT.';

-- Keep activity_events policy but prefer view for new clients
DROP POLICY IF EXISTS activity_events_public_feed ON public.activity_events;
CREATE POLICY activity_events_public_feed ON public.activity_events
  FOR SELECT TO anon, authenticated
  USING (
    COALESCE(payload->>'visibility', 'public') = 'public'
    AND hidden_at IS NULL
  );

-- ===== D. Re-confirm social / commerce / admin / analytics revoke =====
DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'challenge_progress',
    'challenge_entries',
    'club_members',
    'friend_quests',
    'club_stories',
    'club_league_weeks',
    'engagement_events',
    'activity_kudos',
    'clubs',
    'social_profiles',
    'hub_members',
    'hubs',
    'hub_challenges',
    'social_follows',
    'social_blocks',
    'social_mutes',
    'activity_comments',
    'activity_reactions',
    'feed_dismissals',
    'challenge_invites',
    'app_entitlements',
    'app_entitlement_emails',
    'orders',
    'order_items',
    'customer_identities',
    'shopify_webhook_events',
    'cms_overrides',
    'admin_audit_log',
    'users',
    'devices',
    'user_events',
    'recommendation_decisions',
    'decision_outcomes',
    'decision_actions',
    'decision_context_snapshots',
    'feed_impressions',
    'content_impressions'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
      FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ===== E. Storage checkins: keep public read; no anon writes =====
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'checkins') THEN
    DROP POLICY IF EXISTS "checkins_anon_write" ON storage.objects;
    DROP POLICY IF EXISTS "checkins_anon_insert" ON storage.objects;
    DROP POLICY IF EXISTS "checkins_anon_update" ON storage.objects;
    DROP POLICY IF EXISTS checkins_anon_write ON storage.objects;
    DROP POLICY IF EXISTS checkins_anon_insert ON storage.objects;
    DROP POLICY IF EXISTS checkins_anon_update ON storage.objects;
    DROP POLICY IF EXISTS "checkins_public_read" ON storage.objects;
    CREATE POLICY "checkins_public_read" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'checkins');
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

COMMENT ON SCHEMA private IS 'FASE2: unexposed helpers (current_app_user_id). Do not expose via PostgREST.';
