-- PHASE 5 Performance OS — additive evidence + upsert key for decision log
-- SoT of outcomes remains decision_outcomes; recommendation_decisions.outcome* = legacy.

ALTER TABLE public.recommendation_decisions
  ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.recommendation_decisions.evidence IS
  'Structured metrics that produced the decision (Phase 5). Prefer numbers over prose.';

COMMENT ON COLUMN public.recommendation_decisions.outcome IS
  'DEPRECATED legacy — prefer decision_outcomes table (Phase 5 / 8.5).';

COMMENT ON COLUMN public.recommendation_decisions.outcome_metrics IS
  'DEPRECATED legacy — prefer decision_outcomes.value + metadata.';

COMMENT ON COLUMN public.recommendation_decisions.decision_value IS
  'API alias: value. Shape { value: ... }.';

COMMENT ON COLUMN public.recommendation_decisions.input_snapshot IS
  'API alias: context_snapshot.';

-- Unique for idempotent upsert (user_id + date + engine + decision_type)
CREATE UNIQUE INDEX IF NOT EXISTS recommendation_decisions_user_date_engine_type_uidx
  ON public.recommendation_decisions (user_id, date, engine, decision_type);

CREATE INDEX IF NOT EXISTS decision_outcomes_decision_type_day_idx
  ON public.decision_outcomes (decision_id, outcome_type, observed_at DESC);
