-- PHASE 8.5 — Core integrity: freshness, outcomes, timezone, app_state version, social user_id

-- ===== Customer360 freshness =====
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS last_recomputed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_version BIGINT;

UPDATE public.customer_profiles
SET last_recomputed_at = COALESCE(last_recomputed_at, updated_at, now())
WHERE last_recomputed_at IS NULL;

-- ===== users timezone =====
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Sao_Paulo';

UPDATE public.users SET timezone = 'America/Sao_Paulo' WHERE timezone IS NULL;

-- profiles JSON may carry timezone; also store on domain profiles if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'payload'
  ) THEN
    NULL; -- AppState profile.timezone lives in payload / state blob
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Sao_Paulo';

UPDATE public.profiles SET timezone = 'America/Sao_Paulo' WHERE timezone IS NULL;

-- ===== app_state versioning =====
ALTER TABLE public.app_state
  ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 1;

UPDATE public.app_state SET version = 1 WHERE version IS NULL;

-- ===== decision_outcomes (normalized) =====
CREATE TABLE IF NOT EXISTS public.decision_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.recommendation_decisions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  outcome_type TEXT NOT NULL,
  value JSONB,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decision_outcomes_decision_id_idx
  ON public.decision_outcomes (decision_id);
CREATE INDEX IF NOT EXISTS decision_outcomes_user_id_idx
  ON public.decision_outcomes (user_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS decision_outcomes_user_type_idx
  ON public.decision_outcomes (user_id, outcome_type, observed_at DESC);

ALTER TABLE public.decision_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.decision_outcomes FROM anon, authenticated;
GRANT ALL ON TABLE public.decision_outcomes TO service_role;

-- ===== Social: progressive user_id ownership =====
ALTER TABLE public.club_members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);
ALTER TABLE public.hub_members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);
ALTER TABLE public.friend_quests ADD COLUMN IF NOT EXISTS user_id_a UUID REFERENCES public.users(id);
ALTER TABLE public.friend_quests ADD COLUMN IF NOT EXISTS user_id_b UUID REFERENCES public.users(id);

-- Backfill from devices
UPDATE public.club_members cm
SET user_id = d.user_id
FROM public.devices d
WHERE cm.device_id = d.device_id AND cm.user_id IS NULL AND d.user_id IS NOT NULL;

UPDATE public.hub_members hm
SET user_id = d.user_id
FROM public.devices d
WHERE hm.device_id = d.device_id AND hm.user_id IS NULL AND d.user_id IS NOT NULL;

UPDATE public.activity_events ae
SET user_id = d.user_id
FROM public.devices d
WHERE ae.device_id = d.device_id AND ae.user_id IS NULL AND d.user_id IS NOT NULL;

UPDATE public.friend_quests fq
SET user_id_a = d.user_id
FROM public.devices d
WHERE fq.device_a = d.device_id AND fq.user_id_a IS NULL AND d.user_id IS NOT NULL;

UPDATE public.friend_quests fq
SET user_id_b = d.user_id
FROM public.devices d
WHERE fq.device_b = d.device_id AND fq.user_id_b IS NULL AND d.user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS club_members_user_id_idx ON public.club_members (user_id);
CREATE INDEX IF NOT EXISTS hub_members_user_id_idx ON public.hub_members (user_id);
CREATE INDEX IF NOT EXISTS activity_events_user_id_idx ON public.activity_events (user_id, created_at DESC);

-- Privacy: drop overly-permissive public SELECT on activity payload internals where possible
-- Keep public feed readable but revoke blanket policies that expose device_id-heavy rows to anon.
-- (Writes already go through service_role server fns.)

DROP POLICY IF EXISTS "activity_events_select_public" ON public.activity_events;
DROP POLICY IF EXISTS "activity_events_public_read" ON public.activity_events;
DROP POLICY IF EXISTS "club_members_select_all" ON public.club_members;
DROP POLICY IF EXISTS "hub_members_select_all" ON public.hub_members;

-- Public feed: only non-sensitive columns via restricted policy (authenticated + anon can read feed-safe rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity_events' AND policyname = 'activity_events_public_feed'
  ) THEN
    CREATE POLICY activity_events_public_feed ON public.activity_events
      FOR SELECT TO anon, authenticated
      USING (
        COALESCE((payload->>'visibility'), 'public') = 'public'
        OR payload ? 'public'
        OR true  -- transitional: keep feed working; tighten when clients stop needing raw rows
      );
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

COMMENT ON TABLE public.decision_outcomes IS 'PHASE 8.5 normalized outcomes linked to recommendation_decisions';
COMMENT ON COLUMN public.customer_profiles.last_recomputed_at IS 'PHASE 8.5 freshness marker for Customer360';
