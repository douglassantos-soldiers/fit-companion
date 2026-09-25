# RAG Architecture — Performance OS

Camada de **conhecimento** externa, versionada, rastreável. Separada de **User Memory**.

## RAG vs Memory

| | RAG (Knowledge) | Memory |
|--|-----------------|--------|
| O quê | Conhecimento geral / produto | Histórico e preferências do usuário |
| Onde | `src/ai/rag/` | `src/ai/memory/` + `ai_*` — ver [MEMORY_ARCHITECTURE.md](./MEMORY_ARCHITECTURE.md) |
| Autoridade | Nenhuma sobre Decision/Safety | Nenhuma sobre Decision/Safety |
| Citations | Obrigatórias em respostas dependentes de RAG | N/A |

**Não misturar.** Skills usam tools (dados do usuário) + refs `kb:*` (conhecimento). Memory não entra no corpus RAG.

## Pipeline

```
Source adapter → ingestion → chunking → embeddings → store
                                              ↓
                         retrieve → rerank → KnowledgeCitation[]
```

- **Store:** in-memory nesta fase (sem pgvector).
- **Embeddings:** `LocalLexicalEmbeddingProvider` (determinístico); interface pluggable.
- **Retrieval:** semantic (cosine) + keyword fallback + domain/metadata filters + scoring.
- **Sem conteúdo científico inventado:** adapters de domínio retornam `[]` até fontes reais.

## Tipos

- `KnowledgeDocument` — unidade de corpus (`document_id`, domain, source, source_type, version, language, content, metadata, timestamps)
- `KnowledgeChunk` — fragmento recuperável (+ embedding in-process)
- `KnowledgeSource` — origem registrada (`trust_tier`)
- `KnowledgeRetrieval` — run auditável (query, mode, hits, latency)
- `KnowledgeCitation` — rastreio de fonte para a resposta

Domínios: `exercise`, `nutrition`, `recovery`, `sleep`, `behavior`, `performance`, `supplementation`, `products`, `coaching`.

## API

```ts
import {
  ingestKnowledgeDocument,
  retrieveKnowledge,
  resolveKnowledgeRefs,
  getCitationsFromRetrieval,
} from "@/ai/rag";

const { retrieval, citations } = await retrieveKnowledge({
  query: "…",
  domains: ["exercise"],
  mode: "hybrid",
});
// citations → identificar fontes em qualquer resposta dependente de RAG
```

`resolveKnowledgeRefs(["kb:training.basics"])` — ponte para skills (sem alterar `runSkill` nesta fase).

## Sources

`src/ai/rag/sources/` — um adapter placeholder por domínio. `loadDocuments()` → `[]`.  
Ingestão pronta: `ingestFromSource(sourceId)` quando houver catalog / Content OS / markdown curado **real**.

## Avaliação

`src/ai/rag/evaluation/` — casos: retrieval relevance, source quality, empty retrieval, wrong domain, duplicate documents.  
Fixtures de teste são schema/produto (`source_type: fixture`), nunca papers fictícios.

## Anti-spaghetti / autoridade

Orquestração futura: Agent → Skills + Tools + RAG → Proposal → Decision Engine.  
RAG informa; **Decision Engine** decide.

Ver [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md), [SKILLS_ARCHITECTURE.md](./SKILLS_ARCHITECTURE.md), [MEMORY_ARCHITECTURE.md](./MEMORY_ARCHITECTURE.md), [MCP_ARCHITECTURE.md](./MCP_ARCHITECTURE.md).
