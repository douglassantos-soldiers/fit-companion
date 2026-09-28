# AI RAG Production — FASE 22.2

Production RAG hardening for Performance OS. RAG supplies **evidence/knowledge only** — never Decision authority.

## Environments

| Env | Detection | Store |
|-----|-----------|--------|
| **TEST** | `VITEST=true` or `AI_RAG_ENV=test` | `InMemoryVectorStore` (default) |
| **DEVELOPMENT** | default / `AI_RAG_ENV=development` | memory default; `AI_RAG_STORE=supabase` requires live DB (**no silent fallback**) |
| **PRODUCTION** | `NODE_ENV=production` or `AI_RAG_ENV=production` | **Supabase pgvector obrigatório** |

Production **never** falls back to InMemory. `AI_RAG_STORE=memory` in production is a configuration error (`RAG_UNAVAILABLE`).

## Entrypoints

```ts
import {
  ensureVectorStore,
  retrieveKnowledge,
  seedProductionCorpus,
  checkRagHealth,
  getRagReadiness,
} from "@/ai/rag";

await ensureVectorStore(); // resolve store for current env
const { retrieval, citations } = await retrieveKnowledge({ query: "…" });
// retrieval.rag_availability: RAG_AVAILABLE | RAG_DEGRADED | RAG_UNAVAILABLE
```

## Seed (idempotent)

```bash
npm run rag:seed
# AI_RAG_ENV=production AI_RAG_STORE=supabase npm run rag:seed
```

Flow: register sources → upsert `ai_knowledge_sources` → documents → chunk → embed → `ai_knowledge_chunks`.

Upserts by `source_id` / `document_id` / `chunk_id` — safe to re-run.

## Health & readiness

```ts
const health = await checkRagHealth();
// database | pgvector_tables | embeddings | corpus | retrieval | citation

const { RAG_READY, reasons } = await getRagReadiness();
```

`RAG_READY` is true only when all required checks pass. In production, store must be `supabase_pgvector_v1`.

Certification checklist item **RAG** is **critical** and defaults to `pending` until probed (`getRagReadiness` / overrides).

## Failure codes

| Code | Meaning |
|------|---------|
| `RAG_UNAVAILABLE` | Store/DB down; production misconfig; timeout/error path |
| `RAG_EMPTY` | Retrieval ok, zero hits |
| `RAG_LOW_CONFIDENCE` | Hits but evidence quality inadequate |
| `RAG_SOURCE_INVALID` | Unknown / invalid source adapter |

Agents/skills expose `rag_availability` and must **not** present answers as knowledge-backed when `RAG_UNAVAILABLE` or empty.

## Persistence boundaries

| Layer | Writes |
|-------|--------|
| RAG | `ai_knowledge_sources`, `ai_knowledge_documents`, `ai_knowledge_chunks` |
| Decision / Living Plan | **Never** via RAG |
| Memory | Separate `ai_*` memory tables |

## Env vars

- `AI_RAG_ENV` — `development` \| `test` \| `production`
- `AI_RAG_STORE` — `memory` \| `supabase`
- `AI_RAG_ENABLED` — feature flag (skip retrieval when off)
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — required for supabase store

## Verify corpus in DB

```sql
select count(*) from ai_knowledge_sources;
select count(*) from ai_knowledge_documents;
select count(*) from ai_knowledge_chunks;
```

Code corpus (`product-knowledge.ts`) ≠ DB until seed runs.

## See also

- [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md)
- [AI_ARCHITECTURE_FINAL.md](./AI_ARCHITECTURE_FINAL.md)
- Migration: `supabase/migrations/20261027120000_fase16_ai_knowledge.sql`
