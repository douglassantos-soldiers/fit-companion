-- FASE 9 — AI Memory Layer (User / Decision / Outcome / Learning)
-- Service-role only. Writes must go through validated Memory API (no LLM direct write).
-- Distinct from RAG corpus and from legacy coach_memories.

CREATE TABLE IF NOT EXISTS public.ai_user_memory (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL
    CHECK (source IN ('system', 'coach', 'user', 'learning', 'decision_engine')),
  confidence NUMERIC NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invalidated', 'expired')),
  key TEXT,
  low_confidence BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.ai_decision_memory (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL
    CHECK (source IN ('system', 'coach', 'user', 'learning', 'decision_engine')),
  confidence NUMERIC NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invalidated', 'expired')),
  key TEXT,
  low_confidence BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.ai_outcome_memory (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL
    CHECK (source IN ('system', 'coach', 'user', 'learning', 'decision_engine')),
  confidence NUMERIC NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invalidated', 'expired')),
  key TEXT,
  low_confidence BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.ai_learning_events (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL
    CHECK (source IN ('system', 'coach', 'user', 'learning', 'decision_engine')),
  confidence NUMERIC NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invalidated', 'expired')),
  key TEXT,
  low_confidence BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Partial unique: one active keyed memory per user/type/key
CREATE UNIQUE INDEX IF NOT EXISTS ai_user_memory_active_key_uidx
  ON public.ai_user_memory (user_id, type, key)
  WHERE key IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS ai_decision_memory_active_key_uidx
  ON public.ai_decision_memory (user_id, type, key)
  WHERE key IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS ai_outcome_memory_active_key_uidx
  ON public.ai_outcome_memory (user_id, type, key)
  WHERE key IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS ai_learning_events_active_key_uidx
  ON public.ai_learning_events (user_id, type, key)
  WHERE key IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS ai_user_memory_user_idx ON public.ai_user_memory (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ai_decision_memory_user_idx ON public.ai_decision_memory (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ai_outcome_memory_user_idx ON public.ai_outcome_memory (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ai_learning_events_user_idx ON public.ai_learning_events (user_id, updated_at DESC);

ALTER TABLE public.ai_user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_decision_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_outcome_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learning_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_user_memory FROM anon, authenticated;
REVOKE ALL ON public.ai_decision_memory FROM anon, authenticated;
REVOKE ALL ON public.ai_outcome_memory FROM anon, authenticated;
REVOKE ALL ON public.ai_learning_events FROM anon, authenticated;

GRANT ALL ON public.ai_user_memory TO service_role;
GRANT ALL ON public.ai_decision_memory TO service_role;
GRANT ALL ON public.ai_outcome_memory TO service_role;
GRANT ALL ON public.ai_learning_events TO service_role;

-- No authenticated policies: Memory API is the only write path (service_role).
