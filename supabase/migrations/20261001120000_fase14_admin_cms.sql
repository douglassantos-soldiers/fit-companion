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
