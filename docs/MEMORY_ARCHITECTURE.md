# Memory Architecture — Performance OS

Camada de **histórico e contexto por usuário**. Separada de RAG.

## Memory vs RAG

| | Memory | RAG |
|--|--------|-----|
| O quê | Histórico / contexto específico do usuário | Conhecimento geral / produto |
| Onde | `src/ai/memory/` + tabelas `ai_*` | `src/ai/rag/` |
| Autoridade | Nenhuma sobre Decision/Safety | Nenhuma |
| Escrita | Só API validada (`create`/`update`/`invalidate`) | Ingestão de documentos |

**Não misturar.** LLM **não** grava Memory diretamente — source `llm` / `agent_raw` é rejeitado.

## Quatro famílias

| Família | Tabela | Exemplos de `type` |
|---------|--------|-------------------|
| User | `ai_user_memory` | facts, preferences, goals, … |
| Decision | `ai_decision_memory` | decision_snapshot, mode_history, … |
| Outcome | `ai_outcome_memory` | outcome_observed, attribution, … |
| Learning | `ai_learning_events` | pattern_detected, bias_blocked, … |

Ledger (`recommendation_decisions` / `decision_outcomes`) permanece **SoT** de Decision. Memory é projeção/contexto.

`coach_memories` é legado do Coach — **sem dual-write** nesta fase.

## Pipeline de escrita

```
Caller → TrustedUserId (deny anônimo)
      → validateMemoryWrite (source, schema, sensitive keys, confidence)
      → create | update | invalidate
      → MemoryStore (InMemory | Supabase service_role)
```

## API

```ts
import {
  createMemory,
  retrieveMemory,
  updateMemory,
  invalidateMemory,
} from "@/ai/memory";

await createMemory({
  trustedUserId, // resolveTrustedIdentity
  family: "user",
  type: "preferences",
  key: "training_time",
  data: { value: "morning" },
  source: "user", // system | coach | user | learning | decision_engine
  confidence: 0.9,
  expiresAt?: string,
});
```

Sources permitidas: `system`, `coach`, `user`, `learning`, `decision_engine`.  
Conflito no mesmo `(user, family, type, key)` ativo → `CONFLICTING_MEMORY` (ou `supersede: true`).

## Segurança / privacidade

- Isolamento por `user_id` (IDOR fail-closed)
- Tabelas `ai_*`: RLS on; **somente `service_role`** (sem write autenticado direto)
- Denylist de keys sensíveis (`password`, `token`, `ssn`, …)
- Não armazenar dumps de chat nem PII desnecessária
- Low confidence (`< 0.4`) é aceito com flag; filtrável via `minConfidence`

## Testes

`src/ai/memory/memory.test.ts` — anonymous, isolation, expiration, update, invalidation, conflict, low confidence.

Ver [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md), [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md), [DECISION_ENGINE.md](./DECISION_ENGINE.md).
