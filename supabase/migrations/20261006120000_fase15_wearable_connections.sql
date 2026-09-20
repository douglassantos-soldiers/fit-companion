-- Fase 15: OAuth tokens for Strava/Garmin. Never exposed to anon/authenticated.
-- Tokens stay service_role-only. AppState only stores connection status.

CREATE TABLE IF NOT EXISTS public.wearable_connections (
  user_id uuid NOT NULL,
  provider text NOT NULL,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE public.wearable_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.wearable_connections FROM anon, authenticated;
GRANT ALL ON TABLE public.wearable_connections TO service_role;
