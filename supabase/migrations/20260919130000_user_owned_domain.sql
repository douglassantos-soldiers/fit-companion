-- User-owned domain: ownership key = user_id; device_id remains channel/provenance.
-- Safe, non-destructive where possible; dedupes before unique constraints.

-- ===== 0. Helper: backfill user_id from devices =====
UPDATE public.profiles p
SET user_id = d.user_id
FROM public.devices d
WHERE p.user_id IS NULL AND p.device_id = d.device_id;

UPDATE public.app_state a
SET user_id = d.user_id
FROM public.devices d
WHERE a.user_id IS NULL AND a.device_id = d.device_id;

UPDATE public.sessions s
SET user_id = d.user_id
FROM public.devices d
WHERE s.user_id IS NULL AND s.device_id = d.device_id;

UPDATE public.weights w
SET user_id = d.user_id
FROM public.devices d
WHERE w.user_id IS NULL AND w.device_id = d.device_id;

UPDATE public.daily_metrics m
SET user_id = d.user_id
FROM public.devices d
WHERE m.user_id IS NULL AND m.device_id = d.device_id;

UPDATE public.supplement_logs l
SET user_id = d.user_id
FROM public.devices d
WHERE l.user_id IS NULL AND l.device_id = d.device_id;

UPDATE public.meal_entries e
SET user_id = d.user_id
FROM public.devices d
WHERE e.user_id IS NULL AND e.device_id = d.device_id;

-- Orphan rows without user: create anonymous users + devices already should cover most;
-- leave nulls for now; unique indexes are partial WHERE user_id IS NOT NULL.

-- ===== 1. Deduplicate profiles → one row per user_id (keep latest updated_at) =====
DELETE FROM public.profiles p
USING public.profiles newer
WHERE p.user_id IS NOT NULL
  AND newer.user_id = p.user_id
  AND newer.ctid <> p.ctid
  AND (
    COALESCE(newer.updated_at, '1970-01-01'::timestamptz) >
    COALESCE(p.updated_at, '1970-01-01'::timestamptz)
    OR (newer.updated_at IS NOT DISTINCT FROM p.updated_at AND newer.ctid > p.ctid)
  );

DELETE FROM public.app_state a
USING public.app_state newer
WHERE a.user_id IS NOT NULL
  AND newer.user_id = a.user_id
  AND newer.ctid <> a.ctid
  AND (
    COALESCE(newer.updated_at, '1970-01-01'::timestamptz) >
    COALESCE(a.updated_at, '1970-01-01'::timestamptz)
    OR (newer.updated_at IS NOT DISTINCT FROM a.updated_at AND newer.ctid > a.ctid)
  );

-- Sessions: same user_id+client_id keep latest
DELETE FROM public.sessions s
USING public.sessions newer
WHERE s.user_id IS NOT NULL
  AND newer.user_id = s.user_id
  AND newer.client_id = s.client_id
  AND newer.ctid <> s.ctid
  AND (
    COALESCE(newer.updated_at, '1970-01-01'::timestamptz) >
    COALESCE(s.updated_at, '1970-01-01'::timestamptz)
    OR (newer.updated_at IS NOT DISTINCT FROM s.updated_at AND newer.ctid > s.ctid)
  );

DELETE FROM public.weights w
USING public.weights newer
WHERE w.user_id IS NOT NULL
  AND newer.user_id = w.user_id
  AND newer.date = w.date
  AND newer.ctid <> w.ctid
  AND (
    COALESCE(newer.updated_at, '1970-01-01'::timestamptz) >
    COALESCE(w.updated_at, '1970-01-01'::timestamptz)
    OR (newer.updated_at IS NOT DISTINCT FROM w.updated_at AND newer.ctid > w.ctid)
  );

DELETE FROM public.daily_metrics m
USING public.daily_metrics newer
WHERE m.user_id IS NOT NULL
  AND newer.user_id = m.user_id
  AND newer.date = m.date
  AND newer.ctid <> m.ctid
  AND (
    COALESCE(newer.updated_at, '1970-01-01'::timestamptz) >
    COALESCE(m.updated_at, '1970-01-01'::timestamptz)
    OR (newer.updated_at IS NOT DISTINCT FROM m.updated_at AND newer.ctid > m.ctid)
  );

DELETE FROM public.supplement_logs l
USING public.supplement_logs newer
WHERE l.user_id IS NOT NULL
  AND newer.user_id = l.user_id
  AND newer.date = l.date
  AND newer.ctid <> l.ctid
  AND (
    COALESCE(newer.updated_at, '1970-01-01'::timestamptz) >
    COALESCE(l.updated_at, '1970-01-01'::timestamptz)
    OR (newer.updated_at IS NOT DISTINCT FROM l.updated_at AND newer.ctid > l.ctid)
  );

DELETE FROM public.meal_entries e
USING public.meal_entries newer
WHERE e.user_id IS NOT NULL
  AND newer.user_id = e.user_id
  AND newer.client_id = e.client_id
  AND newer.ctid <> e.ctid
  AND (
    COALESCE(newer.updated_at, '1970-01-01'::timestamptz) >
    COALESCE(e.updated_at, '1970-01-01'::timestamptz)
    OR (newer.updated_at IS NOT DISTINCT FROM e.updated_at AND newer.ctid > e.ctid)
  );

-- ===== 2. profiles: drop device PK → unique user_id =====
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pkey' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_pkey;
  END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE public.profiles SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.profiles ALTER COLUMN id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pkey' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique
  ON public.profiles (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_device_id_idx ON public.profiles (device_id);

-- ===== 3. app_state: drop device PK → unique user_id =====
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_state_pkey' AND conrelid = 'public.app_state'::regclass
  ) THEN
    ALTER TABLE public.app_state DROP CONSTRAINT app_state_pkey;
  END IF;
END $$;

ALTER TABLE public.app_state ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE public.app_state SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.app_state ALTER COLUMN id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_state_pkey' AND conrelid = 'public.app_state'::regclass
  ) THEN
    ALTER TABLE public.app_state ADD CONSTRAINT app_state_pkey PRIMARY KEY (id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS app_state_user_id_unique
  ON public.app_state (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_state_device_id_idx ON public.app_state (device_id);

-- ===== 4. sessions / weights / daily_metrics / supplement_logs / meal_entries =====
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_device_id_client_id_key'
  ) THEN
    ALTER TABLE public.sessions DROP CONSTRAINT sessions_device_id_client_id_key;
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Drop common unique names
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_device_id_client_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS sessions_user_client_unique
  ON public.sessions (user_id, client_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.weights DROP CONSTRAINT IF EXISTS weights_pkey;
ALTER TABLE public.weights ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE public.weights SET id = gen_random_uuid() WHERE id IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weights_pkey') THEN
    ALTER TABLE public.weights ALTER COLUMN id SET NOT NULL;
    ALTER TABLE public.weights ADD CONSTRAINT weights_pkey PRIMARY KEY (id);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS weights_user_date_unique
  ON public.weights (user_id, date) WHERE user_id IS NOT NULL;

ALTER TABLE public.daily_metrics DROP CONSTRAINT IF EXISTS daily_metrics_pkey;
ALTER TABLE public.daily_metrics ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE public.daily_metrics SET id = gen_random_uuid() WHERE id IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_metrics_pkey') THEN
    ALTER TABLE public.daily_metrics ALTER COLUMN id SET NOT NULL;
    ALTER TABLE public.daily_metrics ADD CONSTRAINT daily_metrics_pkey PRIMARY KEY (id);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS daily_metrics_user_date_unique
  ON public.daily_metrics (user_id, date) WHERE user_id IS NOT NULL;

ALTER TABLE public.supplement_logs DROP CONSTRAINT IF EXISTS supplement_logs_pkey;
ALTER TABLE public.supplement_logs ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE public.supplement_logs SET id = gen_random_uuid() WHERE id IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplement_logs_pkey') THEN
    ALTER TABLE public.supplement_logs ALTER COLUMN id SET NOT NULL;
    ALTER TABLE public.supplement_logs ADD CONSTRAINT supplement_logs_pkey PRIMARY KEY (id);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS supplement_logs_user_date_unique
  ON public.supplement_logs (user_id, date) WHERE user_id IS NOT NULL;

-- meal_entries already has id PK; ensure unique (user_id, client_id)
DROP INDEX IF EXISTS meal_entries_device_client_unique;
ALTER TABLE public.meal_entries DROP CONSTRAINT IF EXISTS meal_entries_device_id_client_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS meal_entries_user_client_unique
  ON public.meal_entries (user_id, client_id) WHERE user_id IS NOT NULL;

-- ===== 5. Social: user_id columns + uniques =====
ALTER TABLE public.social_profiles ADD COLUMN IF NOT EXISTS app_user_id UUID REFERENCES public.users(id);
-- Prefer app_user_id to avoid clash with auth UUID in user_id column historically used for auth
-- Also stamp legacy user_id when it looks like app user (exists in public.users)

UPDATE public.social_profiles sp
SET app_user_id = d.user_id
FROM public.devices d
WHERE sp.app_user_id IS NULL AND sp.device_id = d.device_id;

DELETE FROM public.social_profiles sp
USING public.social_profiles newer
WHERE sp.app_user_id IS NOT NULL
  AND newer.app_user_id = sp.app_user_id
  AND newer.ctid <> sp.ctid
  AND (
    COALESCE(newer.updated_at, '1970-01-01'::timestamptz) >
    COALESCE(sp.updated_at, '1970-01-01'::timestamptz)
    OR (newer.updated_at IS NOT DISTINCT FROM sp.updated_at AND newer.ctid > sp.ctid)
  );

CREATE UNIQUE INDEX IF NOT EXISTS social_profiles_app_user_unique
  ON public.social_profiles (app_user_id) WHERE app_user_id IS NOT NULL;

ALTER TABLE public.challenge_entries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);
UPDATE public.challenge_entries ce
SET user_id = d.user_id
FROM public.devices d
WHERE ce.user_id IS NULL AND ce.device_id = d.device_id;

DELETE FROM public.challenge_entries ce
USING public.challenge_entries newer
WHERE ce.user_id IS NOT NULL
  AND newer.user_id = ce.user_id
  AND newer.challenge_id = ce.challenge_id
  AND newer.ctid <> ce.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS challenge_entries_user_challenge_unique
  ON public.challenge_entries (user_id, challenge_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.challenge_progress ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);
UPDATE public.challenge_progress cp
SET user_id = d.user_id
FROM public.devices d
WHERE cp.user_id IS NULL AND cp.device_id = d.device_id;

DELETE FROM public.challenge_progress cp
USING public.challenge_progress newer
WHERE cp.user_id IS NOT NULL
  AND newer.user_id = cp.user_id
  AND newer.challenge_id = cp.challenge_id
  AND newer.ctid <> cp.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS challenge_progress_user_challenge_unique
  ON public.challenge_progress (user_id, challenge_id) WHERE user_id IS NOT NULL;

-- ===== 6. Entitlements: optional user_id stamp =====
ALTER TABLE public.app_entitlements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);
UPDATE public.app_entitlements ae
SET user_id = d.user_id
FROM public.devices d
WHERE ae.user_id IS NULL AND ae.device_id = d.device_id;
CREATE INDEX IF NOT EXISTS app_entitlements_user_id_idx ON public.app_entitlements (user_id);

-- ===== 7. RLS: authenticated ownership policies (defense in depth; service_role still used by server) =====
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles',
    'sessions',
    'weights',
    'daily_metrics',
    'supplement_logs',
    'app_state',
    'meal_entries'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_delete', t);

    -- Grant authenticated limited access via ownership (JWT linked users)
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()))
      )',
      t || '_owner_select', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()))
      )',
      t || '_owner_insert', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
        USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid())))
        WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid())))
      ',
      t || '_owner_update', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()))
      )',
      t || '_owner_delete', t
    );
  END LOOP;
END $$;

-- Keep anon revoked on domain (no open world)
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.sessions FROM anon;
REVOKE ALL ON TABLE public.weights FROM anon;
REVOKE ALL ON TABLE public.daily_metrics FROM anon;
REVOKE ALL ON TABLE public.supplement_logs FROM anon;
REVOKE ALL ON TABLE public.app_state FROM anon;
REVOKE ALL ON TABLE public.meal_entries FROM anon;
