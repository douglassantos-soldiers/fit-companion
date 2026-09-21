-- Fase 5 Learning/Behavior convergence — stable experiment upserts
-- Additive unique on (user_id, client_id). No new tables.

UPDATE public.behavior_experiments
SET client_id = id::text
WHERE client_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS behavior_experiments_user_client_uidx
  ON public.behavior_experiments (user_id, client_id)
  WHERE client_id IS NOT NULL;
