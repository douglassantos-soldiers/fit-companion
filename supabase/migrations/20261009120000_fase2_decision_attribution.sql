-- FASE 2 Decision Outcome Attribution
-- decision_actions = expected vs actual execution (UNIQUE decision_id)
-- decision_outcomes += window / attribution / learning_signal
-- Historical fan-out rows stay attribution_type=unknown and are deduped before UNIQUE.

CREATE TABLE IF NOT EXISTS public.decision_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES public.recommendation_decisions(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  expected_action TEXT NOT NULL,
  actual_action TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT decision_actions_decision_uidx UNIQUE (decision_id),
  CONSTRAINT decision_actions_status_chk CHECK (
    status IN ('pending', 'started', 'completed', 'skipped', 'rejected', 'modified')
  )
);

CREATE INDEX IF NOT EXISTS decision_actions_user_date_idx
  ON public.decision_actions (user_id, date DESC);

CREATE INDEX IF NOT EXISTS decision_actions_user_status_idx
  ON public.decision_actions (user_id, status);

ALTER TABLE public.decision_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.decision_actions FROM anon, authenticated;
GRANT ALL ON TABLE public.decision_actions TO service_role;

ALTER TABLE public.decision_outcomes
  ADD COLUMN IF NOT EXISTS action_id UUID REFERENCES public.decision_actions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outcome_window TEXT NOT NULL DEFAULT 'd0',
  ADD COLUMN IF NOT EXISTS attribution_type TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS attribution_confidence NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS outcome_quality TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS learning_signal TEXT;

UPDATE public.decision_outcomes
SET
  outcome_window = COALESCE(NULLIF(outcome_window, ''), 'd0'),
  attribution_type = COALESCE(NULLIF(attribution_type, ''), 'unknown'),
  outcome_quality = COALESCE(NULLIF(outcome_quality, ''), 'unknown')
WHERE TRUE;

-- Keep oldest row per (decision_id, outcome_type, outcome_window) before UNIQUE.
DELETE FROM public.decision_outcomes
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY decision_id, outcome_type, outcome_window
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.decision_outcomes
  ) ranked
  WHERE ranked.rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS decision_outcomes_decision_type_window_uidx
  ON public.decision_outcomes (decision_id, outcome_type, outcome_window);

CREATE INDEX IF NOT EXISTS decision_outcomes_action_id_idx
  ON public.decision_outcomes (action_id)
  WHERE action_id IS NOT NULL;

COMMENT ON TABLE public.decision_actions IS
  'Expected vs actual action for one recommendation_decisions row. UNIQUE(decision_id).';

COMMENT ON COLUMN public.decision_outcomes.attribution_type IS
  'direct | indirect | weak | unknown. Legacy fan-out rows are unknown and must not train.';

COMMENT ON COLUMN public.decision_outcomes.outcome_window IS
  'd0 | d1 | d3 | d7 relative to the decision date (user timezone key).';
