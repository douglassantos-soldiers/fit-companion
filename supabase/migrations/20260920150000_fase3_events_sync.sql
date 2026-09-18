-- FASE 3: Event Layer + Multi-Device Sync
-- Non-destructive: extend user_events, add day_checkins, version columns.

-- ===== 1. user_events: entity + metadata =====
ALTER TABLE public.user_events
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill metadata from legacy payload
UPDATE public.user_events
SET metadata = COALESCE(payload, '{}'::jsonb)
WHERE metadata = '{}'::jsonb
  AND payload IS NOT NULL
  AND payload <> '{}'::jsonb;

CREATE INDEX IF NOT EXISTS user_events_user_occurred_idx
  ON public.user_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS user_events_user_entity_idx
  ON public.user_events (user_id, entity_type, entity_id)
  WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;

-- ===== 2. Version columns on important entities =====
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.meal_entries
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- ===== 3. day_checkins (structured history for Learning Engine) =====
CREATE TABLE IF NOT EXISTS public.day_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id TEXT,
  date TEXT NOT NULL,
  sleep NUMERIC(4, 1),
  energy TEXT,
  soreness INTEGER,
  stress INTEGER,
  available_time INTEGER,
  equipment TEXT,
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS day_checkins_user_date_idx
  ON public.day_checkins (user_id, date DESC);

ALTER TABLE public.day_checkins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.day_checkins FROM anon, authenticated;
GRANT ALL ON TABLE public.day_checkins TO service_role;

DROP POLICY IF EXISTS day_checkins_owner_select ON public.day_checkins;
-- No anon/authenticated policies: writes via service_role server fns only (same as domain tables).

-- Optional owner SELECT if authenticated ever gains grants later
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'day_checkins'
  ) THEN
    DROP POLICY IF EXISTS day_checkins_select_owner ON public.day_checkins;
  END IF;
END $$;

-- Backfill day_checkins from app_state.retention.dayCheckIns (best-effort)
INSERT INTO public.day_checkins (
  user_id, device_id, date, sleep, energy, available_time, equipment, version, updated_at
)
SELECT
  a.user_id,
  a.device_id,
  d.key AS date,
  NULLIF(d.value->>'sleepHours', '')::numeric,
  d.value->>'energy',
  NULLIF(d.value->>'availableMin', '')::integer,
  CASE
    WHEN (d.value->>'noEquipment')::boolean IS TRUE THEN 'none'
    ELSE NULL
  END,
  1,
  COALESCE(a.updated_at, now())
FROM public.app_state a
CROSS JOIN LATERAL jsonb_each(COALESCE(a.retention->'dayCheckIns', '{}'::jsonb)) AS d(key, value)
WHERE a.user_id IS NOT NULL
  AND d.key ~ '^\d{4}-\d{2}-\d{2}$'
ON CONFLICT (user_id, date) DO NOTHING;
