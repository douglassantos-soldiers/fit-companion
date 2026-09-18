-- Soldiers Fit Companion — full schema deploy
-- Project: zphtvrsxlhfgltwgbreu
-- Paste into Supabase SQL Editor → Run
-- Generated: 2026-09-17T19:02:06.9551036-03:00


-- ========== 20260913001917_d8e39ee3-454b-4a4e-94f6-35ffa13963a2.sql ==========

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.profiles (
  device_id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT 'saude',
  level TEXT NOT NULL DEFAULT 'iniciante',
  days_per_week INTEGER NOT NULL DEFAULT 3,
  age INTEGER NOT NULL DEFAULT 30,
  height_cm INTEGER NOT NULL DEFAULT 175,
  weight_kg NUMERIC NOT NULL DEFAULT 75,
  equipment TEXT NOT NULL DEFAULT 'academia',
  restrictions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_device_access" ON public.profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  day_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT current_date,
  duration_min INTEGER NOT NULL DEFAULT 0,
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  volume_kg NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (device_id, client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO anon, authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_device_access" ON public.sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX sessions_device_idx ON public.sessions (device_id, date DESC);

CREATE TABLE public.weights (
  device_id TEXT NOT NULL,
  date DATE NOT NULL,
  weight_kg NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weights TO anon, authenticated;
GRANT ALL ON public.weights TO service_role;
ALTER TABLE public.weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weights_device_access" ON public.weights FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_weights_updated_at BEFORE UPDATE ON public.weights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.daily_metrics (
  device_id TEXT NOT NULL,
  date DATE NOT NULL,
  water_ml INTEGER NOT NULL DEFAULT 0,
  meals INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_metrics TO anon, authenticated;
GRANT ALL ON public.daily_metrics TO service_role;
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_metrics_device_access" ON public.daily_metrics FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_daily_metrics_updated_at BEFORE UPDATE ON public.daily_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.supplement_logs (
  device_id TEXT NOT NULL,
  date DATE NOT NULL,
  supplement_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplement_logs TO anon, authenticated;
GRANT ALL ON public.supplement_logs TO service_role;
ALTER TABLE public.supplement_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplement_logs_device_access" ON public.supplement_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_supplement_logs_updated_at BEFORE UPDATE ON public.supplement_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.app_state (
  device_id TEXT NOT NULL PRIMARY KEY,
  supplement_routine TEXT[] NOT NULL DEFAULT '{}',
  challenges TEXT[] NOT NULL DEFAULT '{}',
  chat JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_state TO anon, authenticated;
GRANT ALL ON public.app_state TO service_role;
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_state_device_access" ON public.app_state FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_app_state_updated_at BEFORE UPDATE ON public.app_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 20260913001949_41b01012-3273-425e-8020-0b52fa73c768.sql ==========

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, PUBLIC;

-- ========== 20260913020000_phase5_social.sql ==========

-- Phase 5 social (device_id identity, no auth)
--
-- APPLY (manual): cole este arquivo no SQL Editor do projeto Supabase
--   ref: zphtvrsxlhfgltwgbreu  (Dashboard → SQL → New query → Run)
-- Client já degrada offline se as tabelas não existirem.
--
-- Smoke checklist (2 devices / 2 abas anônimas):
--   1. Perfil: ativar "compartilhar progresso" → social_profiles recebe device_id
--   2. Desafios: entrar em um desafio → ranking mostra entries de ambos
--   3. Clubes: criar clube → copiar código → segundo device entra com o código
-- Sem Auth: identidade = device_id local.

CREATE TABLE IF NOT EXISTS public.social_profiles (
  device_id TEXT NOT NULL PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_profiles TO anon, authenticated;
GRANT ALL ON public.social_profiles TO service_role;
ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_profiles_access ON public.social_profiles;
CREATE POLICY social_profiles_access ON public.social_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.challenge_entries (
  device_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, challenge_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_entries TO anon, authenticated;
GRANT ALL ON public.challenge_entries TO service_role;
ALTER TABLE public.challenge_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS challenge_entries_access ON public.challenge_entries;
CREATE POLICY challenge_entries_access ON public.challenge_entries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS challenge_entries_challenge_idx ON public.challenge_entries (challenge_id);

CREATE TABLE IF NOT EXISTS public.challenge_progress (
  device_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, challenge_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_progress TO anon, authenticated;
GRANT ALL ON public.challenge_progress TO service_role;
ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS challenge_progress_access ON public.challenge_progress;
CREATE POLICY challenge_progress_access ON public.challenge_progress FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS challenge_progress_challenge_idx ON public.challenge_progress (challenge_id, value DESC);

CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_by_device_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs TO anon, authenticated;
GRANT ALL ON public.clubs TO service_role;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clubs_access ON public.clubs;
CREATE POLICY clubs_access ON public.clubs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.club_members (
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, device_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_members TO anon, authenticated;
GRANT ALL ON public.club_members TO service_role;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS club_members_access ON public.club_members;
CREATE POLICY club_members_access ON public.club_members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS club_members_device_idx ON public.club_members (device_id);

CREATE TABLE IF NOT EXISTS public.activity_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  kudos_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_events TO anon, authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activity_events_access ON public.activity_events;
CREATE POLICY activity_events_access ON public.activity_events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS activity_events_created_idx ON public.activity_events (created_at DESC);


-- ========== 20260917160000_phase6_engagement.sql ==========

-- Phase 6+: retention, leagues, friend quests, stories, kudos, engagement, auth bridge

ALTER TABLE public.app_state
  ADD COLUMN IF NOT EXISTS retention JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.club_league_weeks (
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  device_id TEXT NOT NULL,
  points NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, week_start, device_id)
);
CREATE INDEX IF NOT EXISTS club_league_weeks_week_idx ON public.club_league_weeks (club_id, week_start, points DESC);
ALTER TABLE public.club_league_weeks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "club_league_weeks_all" ON public.club_league_weeks;
CREATE POLICY "club_league_weeks_all" ON public.club_league_weeks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_league_weeks TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.friend_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  device_a TEXT NOT NULL,
  device_b TEXT NOT NULL,
  target INT NOT NULL DEFAULT 4,
  progress_a INT NOT NULL DEFAULT 0,
  progress_b INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS friend_quests_pair_week
  ON public.friend_quests (club_id, week_start, device_a, device_b);
ALTER TABLE public.friend_quests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "friend_quests_all" ON public.friend_quests;
CREATE POLICY "friend_quests_all" ON public.friend_quests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_quests TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.club_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS club_stories_club_created ON public.club_stories (club_id, created_at DESC);
ALTER TABLE public.club_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "club_stories_all" ON public.club_stories;
CREATE POLICY "club_stories_all" ON public.club_stories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_stories TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.activity_kudos (
  event_id UUID NOT NULL REFERENCES public.activity_events(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, device_id)
);
ALTER TABLE public.activity_kudos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_kudos_all" ON public.activity_kudos;
CREATE POLICY "activity_kudos_all" ON public.activity_kudos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_kudos TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS engagement_events_device_created ON public.engagement_events (device_id, created_at DESC);
ALTER TABLE public.engagement_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "engagement_events_all" ON public.engagement_events;
CREATE POLICY "engagement_events_all" ON public.engagement_events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON public.engagement_events TO anon, authenticated;

-- Auth bridge: optional user_id on social_profiles
ALTER TABLE public.social_profiles
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Storage bucket for check-ins / stories (run in dashboard if storage API unavailable here)
INSERT INTO storage.buckets (id, name, public)
VALUES ('checkins', 'checkins', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "checkins_public_read" ON storage.objects;
CREATE POLICY "checkins_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'checkins');

DROP POLICY IF EXISTS "checkins_anon_write" ON storage.objects;
CREATE POLICY "checkins_anon_write" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'checkins');

DROP POLICY IF EXISTS "checkins_anon_update" ON storage.objects;
CREATE POLICY "checkins_anon_update" ON storage.objects
  FOR UPDATE TO anon, authenticated USING (bucket_id = 'checkins');


-- ========== 20260917180000_shopify_entitlements.sql ==========

-- Shopify purchase entitlements (permanent access after any paid order)

CREATE TABLE IF NOT EXISTS public.app_entitlements (
  device_id TEXT NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  shopify_customer_id TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'shopify_order',
  order_count INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_entitlements_email_idx ON public.app_entitlements (lower(email));

ALTER TABLE public.app_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_entitlements_all" ON public.app_entitlements;
CREATE POLICY "app_entitlements_all" ON public.app_entitlements
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_entitlements TO anon, authenticated;
GRANT ALL ON public.app_entitlements TO service_role;


-- ========== 20260917190000_shopify_companion_f1.sql ==========

-- Shopify Companion F1: email-level entitlements, magic link, order snapshot

CREATE TABLE IF NOT EXISTS public.app_entitlement_emails (
  email TEXT NOT NULL PRIMARY KEY,
  shopify_customer_id TEXT,
  order_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  magic_token_hash TEXT,
  magic_expires_at TIMESTAMPTZ,
  last_order_at TIMESTAMPTZ,
  access_tier TEXT NOT NULL DEFAULT 'base',
  product_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_entitlement_emails_token_hash_idx
  ON public.app_entitlement_emails (magic_token_hash)
  WHERE magic_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS app_entitlement_emails_customer_idx
  ON public.app_entitlement_emails (shopify_customer_id);

ALTER TABLE public.app_entitlement_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_entitlement_emails_all" ON public.app_entitlement_emails;
CREATE POLICY "app_entitlement_emails_all" ON public.app_entitlement_emails
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_entitlement_emails TO anon, authenticated;
GRANT ALL ON public.app_entitlement_emails TO service_role;

ALTER TABLE public.app_entitlements
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_tier TEXT NOT NULL DEFAULT 'base',
  ADD COLUMN IF NOT EXISTS product_ids TEXT[] NOT NULL DEFAULT '{}';


-- ========== 20260917200000_harden_rls_entitlements.sql ==========

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

