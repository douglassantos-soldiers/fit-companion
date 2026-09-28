# AI Memory Production — FASE 22.3

Production Memory persistence hardening for Performance OS. Memory is **per-user history/context** — never Decision authority, never RAG.

## Environments

| Env | Detection | Store |
|-----|-----------|--------|
| **TEST** | `VITEST=true` or `AI_MEMORY_ENV=test` | `InMemoryMemoryStore` (default) |
| **DEVELOPMENT** | default / `AI_MEMORY_ENV=development` | memory default; `AI_MEMORY_STORE=supabase` requires live DB (**no silent fallback**) |
| **PRODUCTION** | `NODE_ENV=production` or `AI_MEMORY_ENV=production` | **SupabaseMemoryStore obrigatório** |

Production **never** falls back to InMemory. `AI_MEMORY_STORE=memory` in production is a configuration error (`MEMORY_UNAVAILABLE`).

## Entrypoints

```ts
import {
  ensureMemoryStore,
  createMemory,
  retrieveMemory,
  checkMemoryHealth,
  checkMemoryPersistence,
  getMemoryReadiness,
} from "@/ai/memory";

await ensureMemoryStore();
const { MEMORY_READY, reasons } = await getMemoryReadiness();
```

## Ownership

| Família | Owner | Schema | Write path | Read path | Retention | Privacy | Audit |
|---------|-------|--------|------------|-----------|-----------|---------|-------|
| **User** | Coach / system / user (API) | `ai_user_memory` | `createMemory` / `updateMemory` (validated) | `retrieveMemory` (specialists) | TTL via `expires_at` | service_role + TrustedUserId | memory events |
| **Decision** | Decision Engine projection only | `ai_decision_memory` | API com `source: decision_engine` — **não** agents | retrieve por user | invalidation / expire | idem | audit |
| **Outcome** | Outcome / attribution pipeline | `ai_outcome_memory` | API `source: system\|learning` | retrieve | TTL | idem | audit |
| **Learning** | Learning cycle signals | `ai_learning_events` | API `source: learning` | retrieve | TTL | idem | audit |
| **Legacy** | Coach UI context | `coach_memories` | `upsertCoachMemory` **LEGACY** | `loadCoachMemory` | cap por kind | service_role + eq user_id | coach logs |

**SoT Decision** permanece ledger (`recommendation_decisions`), não Decision Memory.  
**Legacy não é SoT** de AI Memory — sem dual-write automático do Decision Engine. Product wire mínimo: `askAiCoach` espelha `coach_notes` via `createMemory` quando o store está disponível; legacy permanece para o prompt do Coach até migração futura.

## Versioning

- Coluna `version INTEGER NOT NULL DEFAULT 1` nas 4 tabelas `ai_*`
- `createMemory` → `version = 1`
- `updateMemory` / invalidate / supersede invalidate → `version = prev + 1`

## Health & readiness

```ts
const health = await checkMemoryHealth();
// database | tables | store_mode | validate_write | feature_flag

const persist = await checkMemoryPersistence({ simulateRestart: true });
const { MEMORY_READY, reasons } = await getMemoryReadiness();
```

`MEMORY_READY` is true only when required checks pass. In production, store must be `supabase_memory_v1`.

Certification checklist item **Memory** is **critical** and defaults to `pending` until probed (`getMemoryReadiness` / overrides).

## Failure codes

| Code | Meaning |
|------|---------|
| `MEMORY_UNAVAILABLE` | Store/DB down; production misconfig; store not initialized |
| `store_error` | Persistência falhou com erro explícito |
| `anonymous_denied` / `user_mismatch` | AuthZ fail-closed |
| `forbidden_source` | LLM / agent_raw blocked |
| `sensitive_key_denied` | Keys sensíveis rejeitadas |
| `conflicting_memory` | Active key conflict (use `supersede`) |

Specialists **só** fazem `retrieveMemory`. Em falha: warning tipado `MEMORY_UNAVAILABLE` — **não** inventam records. Nenhum agent chama `createMemory` diretamente.

## Privacy

- Isolamento por `user_id` em list/update
- Tabelas `ai_*`: service_role only
- Denylist de keys sensíveis
- Sem dumps de chat / PII desnecessária

## Env vars

- `AI_MEMORY_ENV` — `development` \| `test` \| `production`
- `AI_MEMORY_STORE` — `memory` \| `supabase`
- Feature flag Memory (runtime) — skip retrieve when off
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — required for supabase store

## Critério PASS / BLOCKED

| Item | PASS | BLOCKED |
|------|------|---------|
| Código + testes locais | Hardening completo, no-fallback, isolation, restart Map-backed | — |
| Persistência remota Fit Companion | Tabelas + coluna `version` + `checkMemoryPersistence` verde | Projeto/credenciais indisponíveis ou probe falhou |

**Nunca** declarar produção pronta sem evidência remota de persistência.

### Evidência remota (FASE 22.3)

| Probe | Resultado |
|-------|-----------|
| MCP `list_projects` | Único projeto visível: **Igreja** (`sjzgapqnoccwpwhongpl`) — status **INACTIVE** |
| MCP `list_tables` no Fit Companion (`zphtvrsxlhfgltwgbreu` / `supabase/config.toml`) | **Permission denied** — projeto fora do escopo da conta MCP |
| `list_tables` em Igreja | Connection timeout (INACTIVE) |

**Veredicto remoto: BLOCKED** — código e testes locais PASS; persistência remota Fit Companion não verificável nesta sessão.

Ver também [`MEMORY_ARCHITECTURE.md`](./MEMORY_ARCHITECTURE.md).
