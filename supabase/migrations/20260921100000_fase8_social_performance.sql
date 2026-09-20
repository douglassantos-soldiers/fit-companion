-- FASE 8: personalized targets + proof status + anti-fraud flags on challenge progress
ALTER TABLE public.challenge_progress
  ADD COLUMN IF NOT EXISTS personal_target NUMERIC,
  ADD COLUMN IF NOT EXISTS proof_status TEXT NOT NULL DEFAULT 'self_reported',
  ADD COLUMN IF NOT EXISTS proof_source TEXT NOT NULL DEFAULT 'app_manual',
  ADD COLUMN IF NOT EXISTS fraud_flags JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.challenge_progress.personal_target IS
  'Personalized absolute target computed at join from user baseline';
COMMENT ON COLUMN public.challenge_progress.proof_status IS
  'self_reported | verified | pending — verified only after external integrations';
COMMENT ON COLUMN public.challenge_progress.proof_source IS
  'app_session | app_manual | apple_health | health_connect | garmin | strava | wearable';
COMMENT ON COLUMN public.challenge_progress.fraud_flags IS
  'Array of fraud flag objects from anti-fraud validation (no auto-ban in FASE 8)';
