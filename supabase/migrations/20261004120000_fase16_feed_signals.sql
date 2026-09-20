-- Fase 16: feed impressions (visto) + content dismissals (editorial ignorado).
-- Writes via service_role (same pattern as social graph / cms_overrides).

CREATE TABLE IF NOT EXISTS public.feed_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feed_impressions_user_event_idx
  ON public.feed_impressions (user_id, event_id);

CREATE TABLE IF NOT EXISTS public.content_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_impressions_user_content_idx
  ON public.content_impressions (user_id, content_id);

CREATE TABLE IF NOT EXISTS public.content_dismissals (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_id)
);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'feed_impressions',
    'content_impressions',
    'content_dismissals'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;
