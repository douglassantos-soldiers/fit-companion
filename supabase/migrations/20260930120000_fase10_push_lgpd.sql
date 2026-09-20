-- Fase 10: Web Push subscriptions + send log. Service_role only (same pattern as identity writes).
-- No SECURITY DEFINER functions in public.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS public.push_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_sends_user_sent_idx
  ON public.push_sends (user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS push_sends_user_cat_sent_idx
  ON public.push_sends (user_id, category, sent_at DESC);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_sends ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.push_subscriptions FROM anon, authenticated;
REVOKE ALL ON TABLE public.push_sends FROM anon, authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;
GRANT ALL ON TABLE public.push_sends TO service_role;

-- Analytics funnel reads by event_type + time
CREATE INDEX IF NOT EXISTS user_events_type_occurred_idx
  ON public.user_events (event_type, occurred_at DESC);

-- Cron: invoke POST /api/cron/daily-pushes hourly with Authorization: Bearer $CRON_SECRET
-- pg_cron is optional and not created here (extension may be unavailable).
