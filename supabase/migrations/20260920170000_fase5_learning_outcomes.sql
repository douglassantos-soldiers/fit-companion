-- FASE 5: Decision outcome metrics for Learning Loop
ALTER TABLE public.recommendation_decisions
  ADD COLUMN IF NOT EXISTS outcome_metrics JSONB;

COMMENT ON COLUMN public.recommendation_decisions.outcome_metrics IS
  'Optional post-action metrics: workoutCompleted, rpe, nextDayEnergy, volumeFactor, sessionDurationMin, etc.';
