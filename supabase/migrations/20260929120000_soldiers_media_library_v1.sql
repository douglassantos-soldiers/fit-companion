-- Soldiers Media Library V1: owned posters/motion for exercises, meals, products, hubs, challenges, brand, howtos.
-- Public read of published rows only. Writes are service_role (ingest scripts / admin).

CREATE TABLE IF NOT EXISTS public.soldiers_media (
  kind text NOT NULL CHECK (
    kind IN ('exercise', 'meal', 'product', 'hub', 'challenge', 'brand', 'howto')
  ),
  entity_id text NOT NULL,
  version text NOT NULL DEFAULT 'v1',
  style text NOT NULL DEFAULT 'soldiers-v1',
  source text NOT NULL DEFAULT 'soldiers',
  ownership text NOT NULL DEFAULT 'owned',
  license text NOT NULL DEFAULT 'soldiers-owned',
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'generated', 'qa', 'published', 'rejected')
  ),
  needs_motion boolean NOT NULL DEFAULT false,
  poster_url text,
  thumbnail_url text,
  webm_url text,
  mp4_url text,
  gif_url text,
  duration_sec numeric,
  qa_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, entity_id, version)
);

CREATE INDEX IF NOT EXISTS soldiers_media_published_idx
  ON public.soldiers_media (kind, entity_id)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS soldiers_media_kind_status_idx
  ON public.soldiers_media (kind, status);

COMMENT ON TABLE public.soldiers_media IS
  'Soldiers-owned media packages. Motion (webm/mp4) only when needs_motion. GIF is optional last resort.';

ALTER TABLE public.soldiers_media ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.soldiers_media FROM anon, authenticated;
GRANT SELECT ON TABLE public.soldiers_media TO anon, authenticated;
GRANT ALL ON TABLE public.soldiers_media TO service_role;

DROP POLICY IF EXISTS soldiers_media_public_read ON public.soldiers_media;
CREATE POLICY soldiers_media_public_read
  ON public.soldiers_media
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

INSERT INTO storage.buckets (id, name, public)
VALUES ('soldiers-media', 'soldiers-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS soldiers_media_public_read_obj ON storage.objects;
CREATE POLICY soldiers_media_public_read_obj
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'soldiers-media');

DROP POLICY IF EXISTS soldiers_media_service_insert ON storage.objects;
CREATE POLICY soldiers_media_service_insert
  ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'soldiers-media');

DROP POLICY IF EXISTS soldiers_media_service_update ON storage.objects;
CREATE POLICY soldiers_media_service_update
  ON storage.objects
  FOR UPDATE
  TO service_role
  USING (bucket_id = 'soldiers-media')
  WITH CHECK (bucket_id = 'soldiers-media');

DROP POLICY IF EXISTS soldiers_media_service_delete ON storage.objects;
CREATE POLICY soldiers_media_service_delete
  ON storage.objects
  FOR DELETE
  TO service_role
  USING (bucket_id = 'soldiers-media');
