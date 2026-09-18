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
