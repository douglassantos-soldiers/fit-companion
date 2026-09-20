-- Soldiers Training — pending remote deploy
-- Project: zphtvrsxlhfgltwgbreu
-- Paste into SQL Editor and Run
-- Generated: 2026-09-19T23:28:13.7299070-03:00


-- ========== 20260930120000_fase10_push_lgpd.sql ==========
-- Fase 10: Web Push subscriptions + send log. Service_role only (same pattern as identity writes).
-- No SECURITY DEFINER functions in public.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS public.push_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_sends_user_sent_idx
  ON public.push_sends (user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS push_sends_user_cat_sent_idx
  ON public.push_sends (user_id, category, sent_at DESC);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_sends ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.push_subscriptions FROM anon, authenticated;
REVOKE ALL ON TABLE public.push_sends FROM anon, authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;
GRANT ALL ON TABLE public.push_sends TO service_role;

-- Analytics funnel reads by event_type + time
CREATE INDEX IF NOT EXISTS user_events_type_occurred_idx
  ON public.user_events (event_type, occurred_at DESC);

-- Cron: invoke POST /api/cron/daily-pushes hourly with Authorization: Bearer $CRON_SECRET
-- pg_cron is optional and not created here (extension may be unavailable).

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260930120000', '20260930120000_fase10_push_lgpd')
ON CONFLICT (version) DO NOTHING;


-- ========== 20261001120000_fase14_admin_cms.sql ==========
-- Fase 14: Admin operacional + CMS editorial.
-- Catalog overlays, training rules, content, user status, reports.
-- Service_role only for catalog/CMS/moderation tables (same pattern as cms_overrides).
-- No SECURITY DEFINER functions in public.

-- ---------------------------------------------------------------------------
-- User account status (no health columns)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status_until timestamptz;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_status_check
      CHECK (status IN ('active', 'suspended', 'banned'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_status_idx
  ON public.users (status)
  WHERE status <> 'active';

-- ---------------------------------------------------------------------------
-- Exercise catalog overlay (code library remains seed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalog_exercises (
  id text PRIMARY KEY,
  name text NOT NULL,
  muscle_group text NOT NULL,
  equipment text NOT NULL CHECK (equipment IN ('casa', 'academia', 'ambos')),
  swap_group text NOT NULL DEFAULT '',
  joints text[] NOT NULL DEFAULT '{}'::text[],
  unit text NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg', 'corpo', 'min')),
  base_load numeric NOT NULL DEFAULT 0,
  priority integer NOT NULL DEFAULT 2,
  primary_muscles text[] NOT NULL DEFAULT '{}'::text[],
  secondary_muscles text[] NOT NULL DEFAULT '{}'::text[],
  movement_pattern text,
  difficulty text,
  planner_eligible boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  instructions text[] NOT NULL DEFAULT '{}'::text[],
  video_url text,
  media_url text,
  cues text,
  alternative_ids text[] NOT NULL DEFAULT '{}'::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'pin-admin'
);

CREATE INDEX IF NOT EXISTS catalog_exercises_active_idx
  ON public.catalog_exercises (active, planner_eligible);

ALTER TABLE public.catalog_exercises ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.catalog_exercises FROM anon, authenticated;
GRANT ALL ON TABLE public.catalog_exercises TO service_role;

-- ---------------------------------------------------------------------------
-- Challenge catalog overlay
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalog_challenges (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'consistency',
  metric text NOT NULL DEFAULT 'sessoes',
  target numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'treinos',
  duration_days integer NOT NULL DEFAULT 7,
  ranking_mode text NOT NULL DEFAULT 'absolute',
  reward text,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  requires_performance boolean NOT NULL DEFAULT false,
  target_pct numeric,
  personal_target_min numeric,
  personal_target_max numeric,
  personal_target_factor numeric,
  personal_target_offset numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'pin-admin'
);

CREATE INDEX IF NOT EXISTS catalog_challenges_active_idx
  ON public.catalog_challenges (active);

ALTER TABLE public.catalog_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.catalog_challenges FROM anon, authenticated;
GRANT ALL ON TABLE public.catalog_challenges TO service_role;

-- ---------------------------------------------------------------------------
-- Program / level rules (single-row JSON)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_rules (
  id text PRIMARY KEY DEFAULT 'default',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'pin-admin'
);

ALTER TABLE public.training_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.training_rules FROM anon, authenticated;
GRANT ALL ON TABLE public.training_rules TO service_role;

INSERT INTO public.training_rules (id, payload)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Editorial CMS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (
    kind IN ('article', 'tip', 'technique', 'nutrition', 'recovery', 'motivation')
  ),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  media_url text,
  goals text[] NOT NULL DEFAULT '{}'::text[],
  levels text[] NOT NULL DEFAULT '{}'::text[],
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  updated_by text NOT NULL DEFAULT 'pin-admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_items_published_idx
  ON public.content_items (published, sort_order, created_at DESC);

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.content_items FROM anon, authenticated;
GRANT ALL ON TABLE public.content_items TO service_role;

-- ---------------------------------------------------------------------------
-- Social moderation (thin Fase 12 slice)
-- ---------------------------------------------------------------------------
ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS hidden_by text;

CREATE INDEX IF NOT EXISTS activity_events_feed_idx
  ON public.activity_events (created_at DESC)
  WHERE hidden_at IS NULL;

CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  target_kind text NOT NULL DEFAULT 'activity_event',
  target_id text NOT NULL,
  reason text NOT NULL DEFAULT 'other',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text
);

CREATE INDEX IF NOT EXISTS content_reports_status_idx
  ON public.content_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS content_reports_target_idx
  ON public.content_reports (target_kind, target_id);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.content_reports FROM anon, authenticated;
GRANT ALL ON TABLE public.content_reports TO service_role;

-- Dashboard aggregates
CREATE INDEX IF NOT EXISTS personal_records_achieved_idx
  ON public.personal_records (achieved_at DESC);

CREATE INDEX IF NOT EXISTS challenge_entries_joined_idx
  ON public.challenge_entries (joined_at DESC);

CREATE INDEX IF NOT EXISTS users_created_idx
  ON public.users (created_at DESC);

-- ---------------------------------------------------------------------------
-- Expand admin audit actions
-- ---------------------------------------------------------------------------
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check
  CHECK (
    action IN (
      'cms_save',
      'entitlement_resync',
      'entitlement_grant',
      'entitlement_revoke',
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
      'activity_unhide'
    )
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261001120000', '20261001120000_fase14_admin_cms')
ON CONFLICT (version) DO NOTHING;


-- ========== 20261002120000_fase11_body_evidence.sql ==========
-- Fase 11: medidas corporais + fotos de evoluÃ§Ã£o (bucket privado).
-- Metadata tables: service_role only (same pattern as weights).
-- Storage: owner-only via auth.uid() folder; never reuse public checkins bucket.

-- ---------------------------------------------------------------------------
-- body_measurements (one row per user/day)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id text,
  date date NOT NULL,
  waist_cm numeric,
  arm_cm numeric,
  chest_cm numeric,
  hip_cm numeric,
  thigh_cm numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS body_measurements_user_date_idx
  ON public.body_measurements (user_id, date);

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.body_measurements FROM anon, authenticated;
GRANT ALL ON TABLE public.body_measurements TO service_role;

-- ---------------------------------------------------------------------------
-- progress_photos (metadata only â€” bytes live in private bucket)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id text,
  taken_on date NOT NULL,
  pose text NOT NULL CHECK (pose IN ('front', 'side', 'back')),
  storage_path text NOT NULL,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'card', 'feed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, taken_on, pose)
);

CREATE INDEX IF NOT EXISTS progress_photos_user_taken_idx
  ON public.progress_photos (user_id, taken_on);

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progress_photos FROM anon, authenticated;
GRANT ALL ON TABLE public.progress_photos TO service_role;

-- ---------------------------------------------------------------------------
-- Private bucket: progress-photos
-- Path: {auth.uid()}/{taken_on}/{pose}-{id}.jpg
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'progress-photos',
  'progress-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "progress_photos_select_own" ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_delete_own" ON storage.objects;

CREATE POLICY "progress_photos_select_own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

CREATE POLICY "progress_photos_insert_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

CREATE POLICY "progress_photos_update_own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

CREATE POLICY "progress_photos_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261002120000', '20261002120000_fase11_body_evidence')
ON CONFLICT (version) DO NOTHING;


-- ========== 20261003120000_fase12_social_graph.sql ==========
-- Fase 12: social graph (follows/blocks/mutes), comments, reactions, privacy, invites.
-- Writes via service_role (same pattern as cms_overrides / content_reports).

-- ---------------------------------------------------------------------------
-- Privacy on social_profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.social_profiles
  ADD COLUMN IF NOT EXISTS privacy_profile text NOT NULL DEFAULT 'public';
ALTER TABLE public.social_profiles
  ADD COLUMN IF NOT EXISTS privacy_workouts text NOT NULL DEFAULT 'public';
ALTER TABLE public.social_profiles
  ADD COLUMN IF NOT EXISTS privacy_prs text NOT NULL DEFAULT 'public';
ALTER TABLE public.social_profiles
  ADD COLUMN IF NOT EXISTS privacy_weight text NOT NULL DEFAULT 'private';
ALTER TABLE public.social_profiles
  ADD COLUMN IF NOT EXISTS privacy_photos text NOT NULL DEFAULT 'private';
ALTER TABLE public.social_profiles
  ADD COLUMN IF NOT EXISTS privacy_nutrition text NOT NULL DEFAULT 'private';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_profiles_privacy_profile_check') THEN
    ALTER TABLE public.social_profiles
      ADD CONSTRAINT social_profiles_privacy_profile_check
      CHECK (privacy_profile IN ('public', 'friends', 'private'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_profiles_privacy_workouts_check') THEN
    ALTER TABLE public.social_profiles
      ADD CONSTRAINT social_profiles_privacy_workouts_check
      CHECK (privacy_workouts IN ('public', 'friends', 'private'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_profiles_privacy_prs_check') THEN
    ALTER TABLE public.social_profiles
      ADD CONSTRAINT social_profiles_privacy_prs_check
      CHECK (privacy_prs IN ('public', 'friends', 'private'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_profiles_privacy_weight_check') THEN
    ALTER TABLE public.social_profiles
      ADD CONSTRAINT social_profiles_privacy_weight_check
      CHECK (privacy_weight IN ('public', 'friends', 'private'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_profiles_privacy_photos_check') THEN
    ALTER TABLE public.social_profiles
      ADD CONSTRAINT social_profiles_privacy_photos_check
      CHECK (privacy_photos IN ('public', 'friends', 'private'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_profiles_privacy_nutrition_check') THEN
    ALTER TABLE public.social_profiles
      ADD CONSTRAINT social_profiles_privacy_nutrition_check
      CHECK (privacy_nutrition IN ('public', 'friends', 'private'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Graph
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_follows (
  follower_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT social_follows_no_self CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS social_follows_following_idx ON public.social_follows (following_id);

CREATE TABLE IF NOT EXISTS public.social_blocks (
  blocker_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT social_blocks_no_self CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS social_blocks_blocked_idx ON public.social_blocks (blocked_id);

CREATE TABLE IF NOT EXISTS public.social_mutes (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  muted_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, muted_id),
  CONSTRAINT social_mutes_no_self CHECK (user_id <> muted_id)
);

CREATE TABLE IF NOT EXISTS public.activity_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.activity_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  hidden_at timestamptz,
  hidden_by text,
  CONSTRAINT activity_comments_body_len CHECK (char_length(body) BETWEEN 1 AND 280)
);
CREATE INDEX IF NOT EXISTS activity_comments_event_idx
  ON public.activity_comments (event_id, created_at);

CREATE TABLE IF NOT EXISTS public.activity_reactions (
  event_id uuid NOT NULL REFERENCES public.activity_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('fire', 'muscle', 'clap', 'trophy', 'heart')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS activity_reactions_user_idx ON public.activity_reactions (user_id);

CREATE TABLE IF NOT EXISTS public.feed_dismissals (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, author_user_id, kind)
);

CREATE TABLE IF NOT EXISTS public.challenge_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id text NOT NULL,
  from_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenge_invites_no_self CHECK (from_user_id <> to_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS challenge_invites_pending_unique
  ON public.challenge_invites (challenge_id, from_user_id, to_user_id)
  WHERE status = 'pending';

-- Backfill kudos â†’ fire reactions when we can resolve user_id
INSERT INTO public.activity_reactions (event_id, user_id, kind)
SELECT k.event_id, COALESCE(sp.app_user_id, d.user_id), 'fire'
FROM public.activity_kudos k
LEFT JOIN public.social_profiles sp ON sp.device_id = k.device_id
LEFT JOIN public.devices d ON d.device_id = k.device_id
WHERE COALESCE(sp.app_user_id, d.user_id) IS NOT NULL
ON CONFLICT (event_id, user_id) DO NOTHING;

-- Reports: allow comment | user besides activity_event
ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_target_kind_check;
ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_target_kind_check
  CHECK (target_kind IN ('activity_event', 'comment', 'user'));

-- RLS: service_role only
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'social_follows',
    'social_blocks',
    'social_mutes',
    'activity_comments',
    'activity_reactions',
    'feed_dismissals',
    'challenge_invites'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;

ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check
  CHECK (
    action IN (
      'cms_save',
      'entitlement_resync',
      'entitlement_grant',
      'entitlement_revoke',
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
      'comment_unhide'
    )
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261003120000', '20261003120000_fase12_social_graph')
ON CONFLICT (version) DO NOTHING;


-- ========== 20261004120000_fase16_feed_signals.sql ==========
-- Fase 16: feed impressions (visto) + content dismissals (editorial ignorado).
-- Writes via service_role (same pattern as social graph / cms_overrides).

CREATE TABLE IF NOT EXISTS public.feed_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feed_impressions_user_event_idx
  ON public.feed_impressions (user_id, event_id);

CREATE TABLE IF NOT EXISTS public.content_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_impressions_user_content_idx
  ON public.content_impressions (user_id, content_id);

CREATE TABLE IF NOT EXISTS public.content_dismissals (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_id)
);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'feed_impressions',
    'content_impressions',
    'content_dismissals'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261004120000', '20261004120000_fase16_feed_signals')
ON CONFLICT (version) DO NOTHING;


-- ========== 20261005120000_fase13_catalog_flags.sql ==========
-- Fase 13: catalog license flag. TACO rows in food_items are ignored unless taco_license_verified.
-- Writes via service_role (same pattern as cms_overrides / food catalog).

CREATE TABLE IF NOT EXISTS public.catalog_settings (
  id text PRIMARY KEY DEFAULT 'default',
  taco_license_verified boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.catalog_settings (id, taco_license_verified)
VALUES ('default', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.catalog_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.catalog_settings FROM anon, authenticated;
GRANT ALL ON TABLE public.catalog_settings TO service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261005120000', '20261005120000_fase13_catalog_flags')
ON CONFLICT (version) DO NOTHING;


-- ========== 20261006120000_fase15_wearable_connections.sql ==========
-- Fase 15: OAuth tokens for Strava/Garmin. Never exposed to anon/authenticated.
-- Tokens stay service_role-only. AppState only stores connection status.

CREATE TABLE IF NOT EXISTS public.wearable_connections (
  user_id uuid NOT NULL,
  provider text NOT NULL,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE public.wearable_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.wearable_connections FROM anon, authenticated;
GRANT ALL ON TABLE public.wearable_connections TO service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261006120000', '20261006120000_fase15_wearable_connections')
ON CONFLICT (version) DO NOTHING;


-- ========== 20261007120000_shopify_customers_import_audit.sql ==========
-- Expand admin audit actions for Shopify customer list import.
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check
  CHECK (
    action IN (
      'cms_save',
      'entitlement_resync',
      'entitlement_grant',
      'entitlement_revoke',
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
      'shopify_customers_import'
    )
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261007120000', '20261007120000_shopify_customers_import_audit')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
