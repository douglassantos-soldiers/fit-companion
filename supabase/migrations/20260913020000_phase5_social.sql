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
