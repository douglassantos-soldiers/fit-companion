-- Relative challenge progress: baseline at join + % evolution for leaderboards
ALTER TABLE public.challenge_progress
  ADD COLUMN IF NOT EXISTS baseline_value NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pct_value NUMERIC;

CREATE INDEX IF NOT EXISTS challenge_progress_challenge_pct_idx
  ON public.challenge_progress (challenge_id, pct_value DESC NULLS LAST);
