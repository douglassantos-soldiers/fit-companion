-- soldiers_rls_audit: service_role remote probe for open USING(true) policies on domain tables.
-- Used by scripts/validate-rls-remote.mjs + npm run gate:operator.

CREATE OR REPLACE FUNCTION public.soldiers_rls_audit()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  open_rows jsonb;
BEGIN
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', p.tablename,
        'policy', p.policyname,
        'roles', p.roles,
        'cmd', p.cmd,
        'qual', p.qual
      )
    ),
    '[]'::jsonb
  )
  INTO open_rows
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename = ANY (
      ARRAY[
        'profiles',
        'sessions',
        'meal_entries',
        'app_state',
        'activity_events',
        'clubs',
        'club_members',
        'challenge_entries',
        'challenge_progress',
        'social_profiles',
        'ai_user_memory',
        'ai_decision_memory',
        'weights',
        'daily_metrics',
        'supplement_logs',
        'day_checkins',
        'progress_photos',
        'body_measurements'
      ]
    )
    AND (
      coalesce(p.qual, '') ~* '^\s*true\s*$'
      OR coalesce(p.with_check, '') ~* '^\s*true\s*$'
    );

  RETURN jsonb_build_object(
    'open_policies', open_rows,
    'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.soldiers_rls_audit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soldiers_rls_audit() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soldiers_rls_audit() TO service_role;

COMMENT ON FUNCTION public.soldiers_rls_audit() IS
  'Beta gate: service_role audit of open USING(true)/WITH CHECK(true) policies on domain tables.';
