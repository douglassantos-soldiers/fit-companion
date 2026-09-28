-- Fit Companion / APP — pending AI migrations (FASE 16/19/22.3–22.10)
-- Project: zphtvrsxlhfgltwgbreu
-- Apply in Supabase SQL Editor if CLI lacks privileges, OR via: supabase db push --linked
-- Generated: 2026-09-27T23:53:22.9461564-03:00

-- ========== supabase/migrations/20261027120000_fase16_ai_knowledge.sql ==========
-- FASE 16 â€” AI Knowledge Base (RAG corpus)
-- Service-role only. Global product knowledge (not per-user PII).
-- Distinct from ai_* Memory tables and from User Memory.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.ai_knowledge_sources (
  source_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'structured',
  publisher TEXT NOT NULL DEFAULT 'Soldiers Fit Companion',
  version TEXT NOT NULL DEFAULT '1.0.0',
  url TEXT,
  reference TEXT,
  license TEXT NOT NULL DEFAULT 'proprietary-internal',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deprecated', 'draft')),
  trust_level TEXT NOT NULL DEFAULT 'curated'
    CHECK (trust_level IN ('fixture', 'internal', 'curated', 'external_unverified')),
  effective_date DATE,
  expiration_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_knowledge_documents (
  document_id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES public.ai_knowledge_sources(source_id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  domain TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  language TEXT NOT NULL DEFAULT 'pt-BR',
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'superseded', 'draft')),
  effective_date DATE,
  expiration_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_knowledge_documents_domain_idx
  ON public.ai_knowledge_documents (domain);

CREATE INDEX IF NOT EXISTS ai_knowledge_documents_source_idx
  ON public.ai_knowledge_documents (source_id);

-- Embedding dim 256 matches LocalLexicalEmbeddingProvider (local_lexical_v1)
CREATE TABLE IF NOT EXISTS public.ai_knowledge_chunks (
  chunk_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES public.ai_knowledge_documents(document_id) ON DELETE CASCADE,
  source_id TEXT,
  ordinal INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding vector(256),
  embedding_provider TEXT NOT NULL DEFAULT 'local_lexical_v1',
  embedding_ref TEXT,
  document_version TEXT NOT NULL DEFAULT '1.0.0',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_document_idx
  ON public.ai_knowledge_chunks (document_id);

CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_source_idx
  ON public.ai_knowledge_chunks (source_id);

ALTER TABLE public.ai_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_knowledge_sources FROM anon, authenticated;
REVOKE ALL ON public.ai_knowledge_documents FROM anon, authenticated;
REVOKE ALL ON public.ai_knowledge_chunks FROM anon, authenticated;

GRANT ALL ON public.ai_knowledge_sources TO service_role;
GRANT ALL ON public.ai_knowledge_documents TO service_role;
GRANT ALL ON public.ai_knowledge_chunks TO service_role;

COMMENT ON TABLE public.ai_knowledge_sources IS
  'FASE16 RAG source registry. Service_role only; curated product knowledge.';
COMMENT ON TABLE public.ai_knowledge_documents IS
  'FASE16 RAG documents (versioned). Not User Memory.';
COMMENT ON TABLE public.ai_knowledge_chunks IS
  'FASE16 RAG chunks + embeddings (vector 256 / local_lexical_v1).';


-- ========== supabase/migrations/20261028120000_fase19_ai_audit_kinds.sql ==========
-- FASE 19 â€” Align ai_audit_events.kind CHECK with AiAuditKind
-- Adds ai_gateway + proposal_merge (introduced in FASE 17/18).

ALTER TABLE public.ai_audit_events DROP CONSTRAINT IF EXISTS ai_audit_events_kind_check;

ALTER TABLE public.ai_audit_events
  ADD CONSTRAINT ai_audit_events_kind_check CHECK (
    kind IN (
      'agent_run',
      'skill_run',
      'tool_call',
      'rag_retrieval',
      'decision',
      'outcome',
      'learning_event',
      'ai_gateway',
      'proposal_merge'
    )
  );

COMMENT ON CONSTRAINT ai_audit_events_kind_check ON public.ai_audit_events IS
  'FASE19: includes ai_gateway + proposal_merge';


-- ========== supabase/migrations/20261029120000_fase22_3_memory_version.sql ==========
-- FASE 22.3 â€” Memory record versioning
-- Monotonic version: 1 on create; +1 on update / supersede invalidate

ALTER TABLE public.ai_user_memory
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.ai_decision_memory
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.ai_outcome_memory
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.ai_learning_events
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;


-- ========== supabase/migrations/20261030120000_fase22_6_ai_audit_durability.sql ==========
-- FASE 22.6 â€” Durable Critical AI Audit indexes
-- Correlation lookups by decision_id and parent_run_id.
-- RLS unchanged: service_role only (FASE 11).

CREATE INDEX IF NOT EXISTS ai_audit_events_decision_id_idx
  ON public.ai_audit_events (decision_id)
  WHERE decision_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_audit_events_parent_run_idx
  ON public.ai_audit_events (parent_run_id)
  WHERE parent_run_id IS NOT NULL;

COMMENT ON INDEX public.ai_audit_events_decision_id_idx IS
  'FASE22.6: reconstruct Decision audit trail by decision_id';

COMMENT ON INDEX public.ai_audit_events_parent_run_idx IS
  'FASE22.6: correlation chain via parent_run_id';


-- ========== supabase/migrations/20261031120000_fase22_9_ai_schema_verify.sql ==========
-- FASE 22.9 â€” Schema inventory probe for Database Migration Verification
-- SECURITY DEFINER, service_role EXECUTE only. Never expose to anon/authenticated.

CREATE OR REPLACE FUNCTION public.ai_schema_inventory_probe()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT jsonb_build_object(
    'extensions',
    coalesce(
      (
        SELECT jsonb_agg(e.extname ORDER BY e.extname)
        FROM pg_extension e
        WHERE e.extname IN ('vector')
      ),
      '[]'::jsonb
    ),
    'tables',
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'name', c.relname,
            'rls', c.relrowsecurity
          )
          ORDER BY c.relname
        )
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname IN (
            'ai_audit_events',
            'ai_user_memory',
            'ai_decision_memory',
            'ai_outcome_memory',
            'ai_learning_events',
            'ai_knowledge_sources',
            'ai_knowledge_documents',
            'ai_knowledge_chunks',
            'recommendation_decisions',
            'decision_context_snapshots',
            'decision_actions'
          )
      ),
      '[]'::jsonb
    ),
    'indexes',
    coalesce(
      (
        SELECT jsonb_agg(i.indexname ORDER BY i.indexname)
        FROM pg_indexes i
        WHERE i.schemaname = 'public'
          AND i.tablename IN (
            'ai_audit_events',
            'ai_user_memory',
            'ai_decision_memory',
            'ai_outcome_memory',
            'ai_learning_events',
            'ai_knowledge_sources',
            'ai_knowledge_documents',
            'ai_knowledge_chunks'
          )
      ),
      '[]'::jsonb
    ),
    'columns',
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'table', cols.table_name,
            'column', cols.column_name,
            'udt', cols.udt_name
          )
          ORDER BY cols.table_name, cols.column_name
        )
        FROM information_schema.columns cols
        WHERE cols.table_schema = 'public'
          AND (
            (cols.table_name IN (
              'ai_user_memory',
              'ai_decision_memory',
              'ai_outcome_memory',
              'ai_learning_events'
            ) AND cols.column_name = 'version')
            OR (cols.table_name = 'ai_knowledge_chunks' AND cols.column_name = 'embedding')
          )
      ),
      '[]'::jsonb
    ),
    'policies',
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'table', p.tablename,
            'policy', p.policyname,
            'roles', p.roles,
            'cmd', p.cmd
          )
        )
        FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename IN (
            'ai_audit_events',
            'ai_user_memory',
            'ai_decision_memory',
            'ai_outcome_memory',
            'ai_learning_events',
            'ai_knowledge_sources',
            'ai_knowledge_documents',
            'ai_knowledge_chunks'
          )
      ),
      '[]'::jsonb
    ),
    'function_present', true
  );
$$;

REVOKE ALL ON FUNCTION public.ai_schema_inventory_probe() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_schema_inventory_probe() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_schema_inventory_probe() TO service_role;

COMMENT ON FUNCTION public.ai_schema_inventory_probe() IS
  'FASE22.9: service_role schema inventory for AI database readiness (tables/indexes/RLS/pgvector).';


-- ========== supabase/migrations/20261101120000_fase22_10_ai_rate_limits.sql ==========
-- FASE 22.10 â€” Distributed AI rate limit buckets (atomic consume + TTL)
-- service_role only. Never expose to anon/authenticated.

CREATE TABLE IF NOT EXISTS public.ai_rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_rate_limit_buckets_expires_idx
  ON public.ai_rate_limit_buckets (expires_at);

ALTER TABLE public.ai_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_rate_limit_buckets FROM anon, authenticated;
GRANT ALL ON public.ai_rate_limit_buckets TO service_role;

COMMENT ON TABLE public.ai_rate_limit_buckets IS
  'FASE22.10: distributed fixed-window rate/cost counters (service_role only).';

/**
 * Atomic consume (or peek). Fixed window with TTL.
 * Returns jsonb: allowed, remaining, limit, reset_at_ms, retry_after_sec, count
 */
CREATE OR REPLACE FUNCTION public.ai_rate_limit_consume(
  p_key TEXT,
  p_limit INT,
  p_window_ms BIGINT,
  p_amount INT DEFAULT 1,
  p_peek BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_row public.ai_rate_limit_buckets%ROWTYPE;
  v_amount INT := GREATEST(COALESCE(p_amount, 1), 0);
  v_limit INT := GREATEST(COALESCE(p_limit, 1), 1);
  v_window_ms BIGINT := GREATEST(COALESCE(p_window_ms, 60000), 1);
  v_expires TIMESTAMPTZ;
  v_allowed BOOLEAN;
  v_count INT;
  v_remaining INT;
  v_retry INT;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'limit', v_limit,
      'reset_at_ms', (extract(epoch from v_now) * 1000)::bigint,
      'retry_after_sec', 60,
      'count', 0,
      'error', 'empty_key'
    );
  END IF;

  -- Opportunistic cleanup of expired rows (cheap, best-effort)
  DELETE FROM public.ai_rate_limit_buckets
  WHERE expires_at < v_now - interval '1 hour'
    AND bucket_key = p_key;

  SELECT * INTO v_row
  FROM public.ai_rate_limit_buckets
  WHERE bucket_key = p_key
  FOR UPDATE;

  IF NOT FOUND OR v_row.expires_at <= v_now THEN
    v_expires := v_now + (v_window_ms || ' milliseconds')::interval;
    v_count := CASE WHEN p_peek THEN 0 ELSE v_amount END;
    IF p_peek THEN
      v_allowed := v_amount <= v_limit;
    ELSE
      IF v_amount > v_limit THEN
        v_allowed := false;
        v_count := 0;
      ELSE
        v_allowed := true;
        INSERT INTO public.ai_rate_limit_buckets (bucket_key, count, window_started_at, expires_at)
        VALUES (p_key, v_amount, v_now, v_expires)
        ON CONFLICT (bucket_key) DO UPDATE
          SET count = EXCLUDED.count,
              window_started_at = EXCLUDED.window_started_at,
              expires_at = EXCLUDED.expires_at;
      END IF;
    END IF;
  ELSE
    v_expires := v_row.expires_at;
    IF p_peek THEN
      v_count := v_row.count;
      v_allowed := (v_row.count + v_amount) <= v_limit;
    ELSE
      IF (v_row.count + v_amount) <= v_limit THEN
        UPDATE public.ai_rate_limit_buckets
        SET count = count + v_amount
        WHERE bucket_key = p_key
          AND count + v_amount <= v_limit
        RETURNING count INTO v_count;
        IF FOUND THEN
          v_allowed := true;
        ELSE
          v_allowed := false;
          v_count := v_row.count;
        END IF;
      ELSE
        v_allowed := false;
        v_count := v_row.count;
      END IF;
    END IF;
  END IF;

  v_remaining := GREATEST(v_limit - v_count, 0);
  v_retry := GREATEST(ceil(extract(epoch from (v_expires - v_now))), 1)::int;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'limit', v_limit,
    'reset_at_ms', (extract(epoch from v_expires) * 1000)::bigint,
    'retry_after_sec', v_retry,
    'count', v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ai_rate_limit_consume(TEXT, INT, BIGINT, INT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_rate_limit_consume(TEXT, INT, BIGINT, INT, BOOLEAN) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_rate_limit_consume(TEXT, INT, BIGINT, INT, BOOLEAN) TO service_role;

COMMENT ON FUNCTION public.ai_rate_limit_consume(TEXT, INT, BIGINT, INT, BOOLEAN) IS
  'FASE22.10: atomic fixed-window rate/cost consume (or peek) for AI distributed limits.';


