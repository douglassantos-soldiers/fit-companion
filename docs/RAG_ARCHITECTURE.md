# RAG Architecture — Performance OS (FASE 16)

Camada de **conhecimento** externa, versionada, rastreável. Separada de **User Memory**.

## 1. Arquitetura (production)

```
SOURCE REGISTRY
  → FETCH / VALIDATE / NORMALIZE
  → CHUNK → METADATA → EMBEDDING
  → VectorStore (memory | supabase+pgvector)
  → retrieveKnowledge (hybrid)
  → rerank → EvidenceQuality → Citations
  → Agent / Skill (evidence only)
  → DecisionProposal → Safety → Decision Engine
```

**RAG não decide.** Não escreve Living Plan. Não altera Safety/Decision Engine.

## 2. Fontes conectadas (curadas, sem scraping)

| source_id | Domínio | Conteúdo |
|-----------|---------|----------|
| `src_exercise_catalog_schema` | exercise / training | Catálogo, load, progression, substitutions |
| `src_nutrition_labels` | nutrition | Labels, macros, meals |
| `src_recovery_checkin` | recovery | Sinais de recovery / fadiga |
| `src_sleep_checkin` | sleep | Campos de sono |
| `src_behavior_habits` | behavior | Adesão, friction, hábitos |
| `src_performance_os` | performance | Pipeline Performance OS |
| `src_supplementation_timing` | supplementation | Timing no Living Plan |
| `src_products_catalog` | products | Schema de produtos |
| `src_coaching_faq` | coaching | FAQ Coach determinístico |

Corpus: [`src/ai/rag/corpus/product-knowledge.ts`](../src/ai/rag/corpus/product-knowledge.ts).  
Seed: `seedProductionCorpus()` / `ingestFromSource(sourceId)`.

## 3. Providers

| Peça | Implementação |
|------|----------------|
| EmbeddingProvider | `LocalLexicalEmbeddingProvider` (`local_lexical_v1`, dim 256) |
| API | `generateEmbedding` / `generateEmbeddings` / `similarity` (+ `embed`) |
| VectorStore | `InMemoryVectorStore` (test/dev) · `SupabasePgvectorStore` (**obrigatório em production**) |
| Resolução | `ensureVectorStore()` — **sem fallback silencioso** para memory em prod / quando `AI_RAG_STORE=supabase` |
| Migration | `supabase/migrations/20261027120000_fase16_ai_knowledge.sql` |

Swap de embedding/store **não** exige mudar Agents/Skills.

Ver hardening: [`AI_RAG_PRODUCTION.md`](./AI_RAG_PRODUCTION.md) (FASE 22.2). Seed: `npm run rag:seed`.

### Availability (agents)

`rag_availability`: `RAG_AVAILABLE` | `RAG_DEGRADED` | `RAG_UNAVAILABLE`  
Códigos: `RAG_UNAVAILABLE`, `RAG_EMPTY`, `RAG_LOW_CONFIDENCE`, `RAG_SOURCE_INVALID`.  
Health: `checkRagHealth()` / `getRagReadiness()` → `RAG_READY`.

## 4. Fluxo de retrieval

```ts
const { retrieval, citations, evidence_quality } = await retrieveKnowledge({
  query: "…",
  domains: ["nutrition"], // training ↔ exercise alias
  mode: "hybrid", // semantic | keyword | hybrid
  asOf: "2026-03-11T12:00:00.000Z", // versionamento histórico
  timeoutMs: 5000,
});
// retrieval.rag_status / retrieval_status / evidence_available
// hit: chunk_id, source_id, score, rerank_score, content, metadata, citation
```

Citation chain: `source` → `document` → `section` → `chunk` → `retrieval_id` (+ `document_version`).

Evidence quality: `relevance`, `sufficiency`, `source_quality`, `freshness`, `domain_match` → `evidence_adequate`.  
Citação sozinha **não** prova adequação.

Skills com `required_knowledge: ["kb:…"]` resolvem via `resolveKnowledgeRefs` em `runSkill`.

## 5. Testes

- [`src/ai/rag/rag.test.ts`](../src/ai/rag/rag.test.ts) — registry, ingest, hybrid, kb_ref, eval fixtures
- [`src/ai/rag/rag-production.test.ts`](../src/ai/rag/rag-production.test.ts) — empty, stale, wrong domain, citation, duplicate, versioning, timeout, evidence quality, skill kb, domain dataset

## 6. Limitações

- Embeddings lexicais locais (não modelo neural); dim 256
- Supabase store usa cosine client-side até RPC ANN
- Apply migration `fase16_ai_knowledge` no remoto ainda necessário
- Corpus curado de produto — não literatura científica externa
- Sem scraping web
- User Memory permanece fora do corpus RAG

## RAG vs Memory

| | RAG (Knowledge) | Memory |
|--|-----------------|--------|
| O quê | Conhecimento geral / produto | Histórico e preferências do usuário |
| Onde | `src/ai/rag/` + `ai_knowledge_*` | `src/ai/memory/` + `ai_*` memory |
| Autoridade | Nenhuma sobre Decision/Safety | Nenhuma |

Ver [AI_ARCHITECTURE_FINAL.md](./AI_ARCHITECTURE_FINAL.md), [SKILLS_ARCHITECTURE.md](./SKILLS_ARCHITECTURE.md), [MEMORY_ARCHITECTURE.md](./MEMORY_ARCHITECTURE.md).
