-- FASE 1 — Security & Authorization Hardening
-- Inventory note (2026-09-23): live MCP/CLI for zphtvrsxlhfgltwgbreu unavailable in agent session;
-- this migration is the intended remote state derived from repo migrations + code audit.
-- Goals: revoke broad social SELECT, lock checkins writes, challenge eligible_value, audit columns.

-- ===== A. Challenge progress: recorded vs eligible =====
ALTER TABLE public.challenge_progress
  ADD COLUMN IF NOT EXISTS recorded_value NUMERIC,
  ADD COLUMN IF NOT EXISTS eligible_value NUMERIC,
  ADD COLUMN IF NOT EXISTS verification_status TEXT;

UPDATE public.challenge_progress
SET
  recorded_value = COALESCE(recorded_value, value),
  eligible_value = COALESCE(
    eligible_value,
    CASE
      WHEN fraud_flags IS NOT NULL
        AND jsonb_typeof(fraud_flags) = 'array'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(fraud_flags) f
          WHERE COALESCE(f->>'severity', '') = 'high'
        )
      THEN 0
      ELSE value
    END
  ),
  verification_status = COALESCE(
    verification_status,
    CASE
      WHEN fraud_flags IS NOT NULL
        AND jsonb_typeof(fraud_flags) = 'array'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(fraud_flags) f
          WHERE COALESCE(f->>'severity', '') = 'high'
        )
      THEN 'rejected'
      WHEN fraud_flags IS NOT NULL
        AND jsonb_typeof(fraud_flags) = 'array'
        AND jsonb_array_length(fraud_flags) > 0
      THEN 'flagged'
      ELSE 'accepted'
    END
  );

ALTER TABLE public.challenge_progress
  ALTER COLUMN recorded_value SET DEFAULT 0,
  ALTER COLUMN eligible_value SET DEFAULT 0,
  ALTER COLUMN verification_status SET DEFAULT 'accepted';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'challenge_progress_verification_status_check'
  ) THEN
    ALTER TABLE public.challenge_progress
      ADD CONSTRAINT challenge_progress_verification_status_check
      CHECK (verification_status IN ('accepted', 'rejected', 'flagged'));
  END IF;
END $$;

-- Keep legacy `value` aligned with eligible for any residual readers
UPDATE public.challenge_progress
SET value = eligible_value
WHERE eligible_value IS NOT NULL
  AND value IS DISTINCT FROM eligible_value
  AND verification_status = 'rejected';

COMMENT ON COLUMN public.challenge_progress.recorded_value IS 'FASE1: raw client/server reported value (never deleted)';
COMMENT ON COLUMN public.challenge_progress.eligible_value IS 'FASE1: ranking score after fraud validation';
COMMENT ON COLUMN public.challenge_progress.verification_status IS 'FASE1: accepted|rejected|flagged';

-- ===== B. Social SELECT: revoke anon/authenticated; service_role only =====
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
    'hub_challenges'
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

-- activity_events: public feed only (no friends for anon)
DROP POLICY IF EXISTS activity_events_public_feed ON public.activity_events;
DROP POLICY IF EXISTS activity_events_owner_select ON public.activity_events;
DROP POLICY IF EXISTS activity_events_select_public ON public.activity_events;

REVOKE INSERT, UPDATE, DELETE ON public.activity_events FROM anon, authenticated;
GRANT SELECT ON public.activity_events TO anon, authenticated;
GRANT ALL ON public.activity_events TO service_role;

CREATE POLICY activity_events_public_feed ON public.activity_events
  FOR SELECT TO anon, authenticated
  USING (
    COALESCE(payload->>'visibility', 'public') = 'public'
    AND hidden_at IS NULL
  );

-- ===== C. Storage checkins: drop anon writes =====
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'checkins') THEN
    DROP POLICY IF EXISTS "checkins_anon_write" ON storage.objects;
    DROP POLICY IF EXISTS "checkins_anon_insert" ON storage.objects;
    DROP POLICY IF EXISTS "checkins_anon_update" ON storage.objects;
    DROP POLICY IF EXISTS checkins_anon_write ON storage.objects;
    DROP POLICY IF EXISTS checkins_anon_insert ON storage.objects;
    DROP POLICY IF EXISTS checkins_anon_update ON storage.objects;
    -- Keep public read for existing story URLs (no UX break); writes via service_role only
    DROP POLICY IF EXISTS "checkins_public_read" ON storage.objects;
    CREATE POLICY "checkins_public_read" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'checkins');
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- ===== D. Audit log: extend columns + actions =====
ALTER TABLE public.admin_audit_log
  ADD COLUMN IF NOT EXISTS actor_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS resource_type TEXT,
  ADD COLUMN IF NOT EXISTS resource_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check
  CHECK (
    action IN (
      'cms_save',
      'entitlement_resync',
      'entitlement_grant',
      'entitlement_revoke',
      'entitlement_shopify_webhook',
      'entitlement_device_attach',
      'user_suspend',
      'user_ban',
      'user_unsuspend',
      'catalog_exercise_save',
      'catalog_challenge_save',
      'training_rules_save',
      'content_item_save',
      'content_item_delete',
      'content_report_resolve',
      'activity_hide',
      'activity_unhide',
      'comment_hide',
      'comment_unhide',
      'expert_save',
      'program_save',
      'collection_save',
      'shopify_customers_import',
      'media_status_change',
      'leaderboard_correction',
      'challenge_moderation',
      'social_moderation',
      'access_session_establish',
      'destructive_action'
    )
  );

COMMENT ON TABLE public.admin_audit_log IS 'FASE1: critical ops audit (admin + entitlement + moderation)';
