# Auditoria técnica — Fases 15–21 (somente leitura)

O HEAD atual é `01f52bb "Work in progress"`, que vem depois de `07b42504` (esse commit existe no histórico). Nenhum arquivo do projeto foi alterado. Esta é uma auditoria por amostragem das partes críticas, não uma leitura linha a linha.

## Veredito geral
A arquitetura está bem desenhada e tem contratos claros, mas boa parte dela só funciona dentro dos testes. No produto, o único caminho vivo é **Coach → runCoachAgent → authoritative bridge**. O fluxo Specialists → merge → Decision Engine, o RAG persistente e a Memory persistente não estão ligados a nenhuma rota. O relatório de certificação marca "pass" por padrão.

## Achados por fase

### FASE 15 — E2E
- **ALTO**: `runAiE2EPipeline` (`src/ai/e2e/run-pipeline.ts`, 737 linhas) só é importado por `src/ai/index.ts`, `src/ai/e2e/*` e testes. Nenhuma rota, `lib/*.functions.ts` ou página o chama. A cadeia completa fecha no harness, não em produção.
- **MÉDIO**: no produto, o Coach (`src/lib/coach.functions.ts`) passa por identity → context → runCoachAgent → bridge. Tracking, `touchCoachSession` e `upsertCoachMemory` rodam como `void` (best-effort), então Memory/Outcome não são garantidos por requisição.

### FASE 16 — RAG
- **CRÍTICO**: `resolveVectorStoreFromEnv()` (`src/ai/rag/core/vector-store.ts:52-70`) usa `memory` por padrão. Com `AI_RAG_STORE=supabase`, qualquer exceção ou `store == null` cai **silenciosamente** para `InMemoryVectorStore`, sem log nem audit.
- **ALTO**: `getVectorStore()` cria um store em memória vazio quando nada foi registrado. `register.ts` / `resolveVectorStoreFromEnv` não são chamados fora de `src/ai/rag/*`, então o seed do corpus não acontece no runtime do produto. Em Worker, a memória também não sobrevive entre instâncias.
- **MÉDIO**: `src/ai/memory/register.ts` registra só `InMemoryMemoryStore`. O adapter Supabase existe (`store/supabase.ts`), mas não é selecionado.

### FASE 17 — Gateway
- **POSITIVO**: não achei chamada direta a `api.openai.com` / `api.anthropic.com` em `src/`; o `askAiCoach` legado com fetch direto foi removido.
- **ALTO**: `run-specialist.ts:369-413` chama `invokeAI` só se `AI_RUNTIME_MODE` for `hybrid` ou `llm`. O padrão é `deterministic` (`runtime-mode.ts`). Os Specialists não rodam no produto, então o LLM real não é exercido de ponta a ponta.
- **MÉDIO**: token e custo são registrados como estimativa (o próprio relatório diz "LLM cost is proxy/estimated"). O Coach registra `provider:"coach_agent", model:"runCoachAgent"`, não o modelo/request_id real (`coach.functions.ts:331-335`).
- **MÉDIO**: `dependencies` pede `OPENAI_API_KEY`. As chaves configuradas antes foram recusadas pelos provedores. Não há verificação de chave válida na certificação.

### FASE 18 — Specialists → Proposal → Decision
- **ALTO**: `runSpecialistsDecisionPipeline` não aparece em `src/lib`, `src/routes` nem `src/features`. A integração só existe no harness e nos testes (`decision-pipeline.test.ts`).

### FASE 19 — Governance Console
- **POSITIVO**: o acesso passa por `requireAdminSession(GOV_CONSOLE_ROLES)` (`governance-console-auth.ts`). A paginação usa cursor quando a fonte é o banco.
- **MÉDIO**: no fallback em memória, `next_cursor` é sempre `null` e o limite é 200 (`governance-console.functions.ts:84-89`). Algumas consultas pedem `limit: 500`, o que é inconsistente com esse teto. O console pode mostrar dados parciais sem avisar.
- **BAIXO**: o gate do console roda no cliente, com `useEffect`. Os dados são protegidos no servidor, mas o shell aparece antes da checagem.

### FASE 20 — Evaluation / CI
- **ALTO**: `.github/workflows/ai-eval.yml` roda só `test:eval` (2 arquivos). Não roda `cert:ai`, typecheck, lint, a suíte completa nem build. O próprio audit registra typecheck quebrado desde antes.
- **MÉDIO**: o gatilho só dispara com mudanças em `src/ai/**`. Mudanças em `src/lib/engine/*` (Decision Engine / Living Plan) ou em `coach.functions.ts` não acionam o gate.
- **MÉDIO**: o golden dataset é pequeno (o teste exige `>= 9` casos) e roda em modo determinístico. Ele não mede regressão de saída do LLM.

### FASE 21 — Certificação
- **CRÍTICO**: em `readiness.ts:75-120`, 19 dos 20 itens do checklist usam `o[id] ?? "pass"`. Eles não sondam nada: identity, safety, tools, audit e rollback aparecem como aprovados por padrão.
- **CRÍTICO**: `run-certification.ts:13` fixa `test_suite_ok: true`. A falha de testes nunca rebaixa o relatório.
- **ALTO**: se as tabelas remotas existirem, `production_ready` fica `true`, mesmo com RAG em memória, Specialists desligados, rate limit em processo único e sem outbox. Esses pontos aparecem em `risks`, mas não bloqueiam.
- **ALTO**: o audit crítico é `void persistCriticalAiAudit(event)` (`persist.server.ts:253`). O comentário diz "critical awaits", mas o código não aguarda. Não há outbox durável e o evento pode se perder quando o Worker termina.
- **MÉDIO**: o rate limit é em memória por instância (reconhecido no próprio relatório). O kill-switch `AI_FORCE_DETERMINISTIC` depende de env e não foi testado em deploy.

### Item 8 — Inconsistências documentais
- Alguns docs descrevem RAG, Memory e Specialists como camadas de produção, mas o runtime usa memória ou harness.
- `docs/security-audit-identity-ai.md` diz que o projeto "não estava no MCP" e que as migrations devem ser aplicadas via CLI. Não há prova de que foram aplicadas.
- `supabase/DEPLOY_*.sql` ainda reabrem `USING(true)`. Rodar esses arquivos por engano desfaz o hardening.

### Item 9 — Data integrity
- **POSITIVO**: `data-integrity.test.ts` bloqueia nomes proibidos em `agents/gateway/skills`. Memory bloqueia `source=llm`.
- **MÉDIO**: a checagem é por string (`src.includes`). Um alias, um import indireto ou escrita via `supabase.from("...")` passam sem ser pegos. O teste não cobre `src/ai/mcp`, `src/ai/orchestrator` nem `src/lib/coach/tools.ts`.

### Item 10 — Falso positivo de production_ready
Sim, é possível: migrations aplicadas + `cost.ok` já dão `production_ready: true`, com RAG vazio, Specialists desligados, audit não durável e CI parcial.

## O que está realmente pronto
- A identidade confiável (`resolveTrustedIdentity`) e a autorização por `user_id`.
- O Coach passando pelo agent + bridge, sem fetch direto a provedores.
- Os contratos, as proposals, o merge e a safety, validados em testes.
- O gate admin do Governance Console no servidor.
- O kill-switch por env e o modo determinístico como padrão.

## O que está apenas arquitetado
- O pipeline E2E completo.
- Specialists → Decision no produto.
- O RAG pgvector com seed.
- A Memory persistente.
- O LLM real nos Specialists.
- O audit crítico durável.
- O rate limit distribuído.
- Uma certificação que sonde de verdade.

## 5 principais riscos
1. A certificação dá `production_ready: true` por padrão (`"pass"` + `test_suite_ok: true`).
2. O fallback silencioso de Supabase para memória no RAG, sem corpus semeado em produção.
3. O audit crítico é fire-and-forget e não tem outbox.
4. O CI parcial não cobre o Decision Engine, o Coach nem a certificação.
5. Specialists → Decision e o LLM real não estão ligados no produto; os testes validam um caminho que o usuário não percorre.

## Ordem técnica recomendada
1. Certificação honesta: trocar os padrões `"pass"` por sondas reais (ou `"pending"`) e passar o `test_suite_ok` real.
2. RAG: tornar o fallback explícito (erro em produção + audit), chamar o register/seed no boot do servidor e sondar o tamanho do corpus na certificação.
3. Audit crítico: aguardar de fato (`await`) e criar uma tabela outbox com reprocessamento.
4. CI: incluir `cert:ai`, a suíte completa, typecheck dos módulos AI e os paths `src/lib/engine/**` e `src/lib/coach*`.
5. Ampliar o teste de data integrity (AST/imports, mais diretórios, `supabase.from` em tabelas de Decision/Living Plan).
6. Ligar Specialists → Decision atrás de feature flag, com LLM real e registro de token/request_id do provedor.
7. Rate limit distribuído (banco ou KV) e Memory Supabase selecionada por env com fallback explícito.
8. Alinhar os docs ao runtime real e aposentar os `DEPLOY_*.sql`.

Se aprovar, a implementação segue esta ordem.
