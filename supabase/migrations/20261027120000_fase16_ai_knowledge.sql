-- FASE 16 — AI Knowledge Base (RAG corpus)
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
