-- FASE 22.3 — Memory record versioning
-- Monotonic version: 1 on create; +1 on update / supersede invalidate

ALTER TABLE public.ai_user_memory
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.ai_decision_memory
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.ai_outcome_memory
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.ai_learning_events
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
