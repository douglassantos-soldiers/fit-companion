-- Fase 11: medidas corporais + fotos de evolução (bucket privado).
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
-- progress_photos (metadata only — bytes live in private bucket)
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
