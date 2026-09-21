-- Fase 8 — Athlete Network + Content OS
-- activities = physical SoT (not activity_events feed).
-- Content OS extends content_items; CMS tables service_role only.
-- RLS unchanged pattern: revoke anon/authenticated, grant service_role.

-- ---------------------------------------------------------------------------
-- Activities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activities (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('app', 'strava', 'garmin', 'wearable', 'manual')),
  external_id text,
  type text NOT NULL CHECK (
    type IN ('strength', 'run', 'walk', 'football', 'cycling', 'cardio', 'challenge', 'manual')
  ),
  started_at timestamptz NOT NULL,
  duration_sec integer,
  distance_m numeric,
  calories numeric,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  proof_status text NOT NULL DEFAULT 'self_reported',
  device text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS activities_user_source_external_uid
  ON public.activities (user_id, source, external_id)
  WHERE external_id IS NOT NULL AND btrim(external_id) <> '';

CREATE INDEX IF NOT EXISTS activities_user_started_idx
  ON public.activities (user_id, started_at DESC);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.activities FROM anon, authenticated;
GRANT ALL ON TABLE public.activities TO service_role;

-- ---------------------------------------------------------------------------
-- Content OS — experts / collections / programs / progress
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.experts (
  id text PRIMARY KEY,
  name text NOT NULL,
  bio text NOT NULL DEFAULT '',
  specialty text NOT NULL DEFAULT '',
  photo_media_id text,
  social jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  updated_by text NOT NULL DEFAULT 'pin-admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.experts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.experts FROM anon, authenticated;
GRANT ALL ON TABLE public.experts TO service_role;

CREATE TABLE IF NOT EXISTS public.content_collections (
  id text PRIMARY KEY,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'education',
  expert_id text REFERENCES public.experts(id) ON DELETE SET NULL,
  cover_media_id text,
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  updated_by text NOT NULL DEFAULT 'pin-admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_collections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.content_collections FROM anon, authenticated;
GRANT ALL ON TABLE public.content_collections TO service_role;

CREATE TABLE IF NOT EXISTS public.programs (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  goal text,
  level text,
  duration_weeks integer NOT NULL DEFAULT 4,
  sessions_per_week integer NOT NULL DEFAULT 3,
  expert_ids text[] NOT NULL DEFAULT '{}'::text[],
  published boolean NOT NULL DEFAULT false,
  cover_media_id text,
  publish_at timestamptz,
  updated_by text NOT NULL DEFAULT 'pin-admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.programs FROM anon, authenticated;
GRANT ALL ON TABLE public.programs TO service_role;

CREATE TABLE IF NOT EXISTS public.program_sessions (
  id text PRIMARY KEY,
  program_id text NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  week integer NOT NULL DEFAULT 1,
  day integer NOT NULL DEFAULT 1,
  training_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  nutrition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  recovery_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_item_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS program_sessions_program_idx
  ON public.program_sessions (program_id, week, day);

ALTER TABLE public.program_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.program_sessions FROM anon, authenticated;
GRANT ALL ON TABLE public.program_sessions TO service_role;

CREATE TABLE IF NOT EXISTS public.content_progress (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_id text NOT NULL,
  completed_at timestamptz,
  completion_percent integer NOT NULL DEFAULT 0,
  saved boolean NOT NULL DEFAULT false,
  dismissed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_id)
);

ALTER TABLE public.content_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.content_progress FROM anon, authenticated;
GRANT ALL ON TABLE public.content_progress TO service_role;

-- ---------------------------------------------------------------------------
-- content_items extensions
-- ---------------------------------------------------------------------------
ALTER TABLE public.content_items DROP CONSTRAINT IF EXISTS content_items_kind_check;
ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_kind_check CHECK (
    kind IN ('article', 'tip', 'technique', 'nutrition', 'recovery', 'motivation', 'video', 'education')
  );

ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS expert_id text;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS collection_id text;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS media_id text;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS publish_at timestamptz;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS unpublish_at timestamptz;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- Soldiers media kinds for expert / program covers (draft packages)
-- ---------------------------------------------------------------------------
ALTER TABLE public.soldiers_media DROP CONSTRAINT IF EXISTS soldiers_media_kind_check;
ALTER TABLE public.soldiers_media
  ADD CONSTRAINT soldiers_media_kind_check CHECK (
    kind IN ('exercise', 'meal', 'product', 'hub', 'challenge', 'brand', 'howto', 'expert', 'program')
  );
