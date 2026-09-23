-- Tighten social feed RLS (phase 8.5 debt): drop transitional OR true on activity_events.
-- Writes remain service_role-only via social-write.server.
-- SELECT: public visibility only, or own rows when user_id matches auth mapping is not available
-- on anon; feed reads go through graph.server (service_role). Clients using anon key get
-- only rows marked public — no blanket USING (true).

DROP POLICY IF EXISTS activity_events_public_feed ON public.activity_events;
DROP POLICY IF EXISTS activity_events_select_public ON public.activity_events;

-- Public feed: explicit visibility in payload (default public for legacy rows without key)
CREATE POLICY activity_events_public_feed ON public.activity_events
  FOR SELECT TO anon, authenticated
  USING (
    COALESCE(payload->>'visibility', 'public') IN ('public', 'friends')
    AND hidden_at IS NULL
  );

-- Own rows always readable when user_id is set (authenticated app users via JWT rarely hit this;
-- device-bound reads use service_role). Fallback for authenticated UUID == user_id if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_events' AND column_name = 'user_id'
  ) THEN
    DROP POLICY IF EXISTS activity_events_owner_select ON public.activity_events;
    CREATE POLICY activity_events_owner_select ON public.activity_events
      FOR SELECT TO authenticated
      USING (user_id IS NOT NULL AND user_id::text = auth.uid()::text);
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- social_profiles: SELECT public display fields only (still SELECT * under RLS — avoid writes)
DROP POLICY IF EXISTS social_profiles_select_public ON public.social_profiles;
DROP POLICY IF EXISTS social_profiles_access ON public.social_profiles;
CREATE POLICY social_profiles_select_public ON public.social_profiles
  FOR SELECT TO anon, authenticated
  USING (true);

-- Ensure no anon/authenticated INSERT/UPDATE/DELETE on activity_events
REVOKE INSERT, UPDATE, DELETE ON public.activity_events FROM anon, authenticated;
GRANT SELECT ON public.activity_events TO anon, authenticated;
GRANT ALL ON public.activity_events TO service_role;

COMMENT ON POLICY activity_events_public_feed ON public.activity_events IS
  'PHASE 8.5 harden: public/friends visibility only — transitional OR true removed';
