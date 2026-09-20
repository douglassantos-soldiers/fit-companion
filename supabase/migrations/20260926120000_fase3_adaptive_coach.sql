-- PHASE 3 Adaptive Coach — memories, sessions, proposals
-- Does NOT duplicate Customer360 or recommendation_decisions.

CREATE TABLE IF NOT EXISTS public.coach_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('facts', 'preferences', 'patterns', 'recent_decisions', 'coach_notes')),
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC NOT NULL DEFAULT 0.7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, key)
);

CREATE INDEX IF NOT EXISTS coach_memories_user_idx ON public.coach_memories (user_id);
CREATE INDEX IF NOT EXISTS coach_memories_user_kind_idx ON public.coach_memories (user_id, kind);

CREATE TABLE IF NOT EXISTS public.coach_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT NOT NULL DEFAULT '',
  message_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS coach_sessions_user_idx ON public.coach_sessions (user_id);

CREATE TABLE IF NOT EXISTS public.coach_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  action TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'accepted', 'rejected', 'superseded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_proposals_user_date_idx ON public.coach_proposals (user_id, date DESC);

-- RLS
ALTER TABLE public.coach_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_proposals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.coach_memories FROM anon, authenticated;
REVOKE ALL ON public.coach_sessions FROM anon, authenticated;
REVOKE ALL ON public.coach_proposals FROM anon, authenticated;

GRANT ALL ON public.coach_memories TO service_role;
GRANT ALL ON public.coach_sessions TO service_role;
GRANT ALL ON public.coach_proposals TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_memories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_sessions TO authenticated;
GRANT SELECT ON public.coach_proposals TO authenticated;

DROP POLICY IF EXISTS coach_memories_owner_select ON public.coach_memories;
CREATE POLICY coach_memories_owner_select ON public.coach_memories
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS coach_memories_owner_write ON public.coach_memories;
CREATE POLICY coach_memories_owner_write ON public.coach_memories
  FOR ALL TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS coach_sessions_owner_select ON public.coach_sessions;
CREATE POLICY coach_sessions_owner_select ON public.coach_sessions
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS coach_sessions_owner_write ON public.coach_sessions;
CREATE POLICY coach_sessions_owner_write ON public.coach_sessions
  FOR ALL TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS coach_proposals_owner_select ON public.coach_proposals;
CREATE POLICY coach_proposals_owner_select ON public.coach_proposals
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
-- Writes to coach_proposals: service_role only (via server fn)
