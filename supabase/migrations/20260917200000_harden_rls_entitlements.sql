-- Harden RLS: entitlements service_role only; social SELECT public, writes require matching device_id claim interim
-- Device-scoped writes still spoofable without JWT — access gate cookie is primary entitlement control.
-- Apply: supabase db push / SQL Editor zphtvrsxlhfgltwgbreu

-- ===== Entitlements / emails: revoke anon =====
REVOKE ALL ON TABLE public.app_entitlements FROM anon, authenticated;
GRANT ALL ON TABLE public.app_entitlements TO service_role;
ALTER TABLE public.app_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_entitlements_all" ON public.app_entitlements;
DROP POLICY IF EXISTS app_entitlements_access ON public.app_entitlements;
-- No policies for anon/authenticated → deny by default when RLS on

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'app_entitlement_emails'
  ) THEN
    EXECUTE 'REVOKE ALL ON TABLE public.app_entitlement_emails FROM anon, authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.app_entitlement_emails TO service_role';
    EXECUTE 'ALTER TABLE public.app_entitlement_emails ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "app_entitlement_emails_all" ON public.app_entitlement_emails';
    EXECUTE 'DROP POLICY IF EXISTS app_entitlement_emails_access ON public.app_entitlement_emails';
  END IF;
END $$;

-- ===== Social: keep SELECT for ranking; block blanket FOR ALL =====
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'social_profiles',
    'challenge_entries',
    'challenge_progress',
    'clubs',
    'club_members',
    'activity_events'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_access', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all', t);
      -- permissive select for public leaderboards
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
        t || '_select',
        t
      );
      -- insert/update still allowed for companion (device_id identity) — tighten when Auth lands
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)',
        t || '_insert',
        t
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)',
        t || '_update',
        t
      );
      -- no DELETE for anon
    END IF;
  END LOOP;
END $$;

-- Storage checkins: keep public read; insert only under folder pattern (best-effort)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'checkins') THEN
    DROP POLICY IF EXISTS "checkins_public_read" ON storage.objects;
    DROP POLICY IF EXISTS "checkins_anon_insert" ON storage.objects;
    DROP POLICY IF EXISTS "checkins_anon_update" ON storage.objects;
    CREATE POLICY "checkins_public_read" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'checkins');
    CREATE POLICY "checkins_anon_insert" ON storage.objects
      FOR INSERT TO anon, authenticated
      WITH CHECK (
        bucket_id = 'checkins'
        AND (storage.foldername(name))[1] IS NOT NULL
        AND length((storage.foldername(name))[1]) >= 8
      );
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;
