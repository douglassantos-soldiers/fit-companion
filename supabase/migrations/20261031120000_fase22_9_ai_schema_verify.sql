-- FASE 22.9 — Schema inventory probe for Database Migration Verification
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
