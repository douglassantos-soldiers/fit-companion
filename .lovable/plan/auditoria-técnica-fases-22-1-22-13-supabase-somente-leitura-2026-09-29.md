# Auditoria técnica — FASES 22.1–22.13 + Supabase (somente leitura)

Nenhum arquivo, migration, configuração ou dado foi alterado. Consultas no banco remoto `zphtvrsxlhfgltwgbreu` foram feitas só com SELECT, e todas funcionaram.

## 1. Commit vs relatórios — FAIL
- HEAD = `5ae6e72` ("Work in progress"), e o commit anterior é `88d237f` ("Ship AI FASE 22.1-22.13").
- `docs/certification/latest.json` e `AI_PRODUCTION_READINESS_REPORT.md` apontam para `07b42504…`, que não aparece nos 3 últimos commits. O relatório é de outro commit e de `environment: local`, rodado numa máquina Windows (`C:\Users\Douglas…`).

## 2. Canonical runtime — WARN
- `askAiCoach` (`src/lib/coach.functions.ts:224`) passa por `runCoachAgent → runProductionAiRuntime`. Isso é PASS.
- Existem caminhos paralelos que chamam LLM direto, fora do runtime:
  - `src/lib/meal-ai.functions.ts` (fetch direto, `gpt-4o`, linhas 61/102);
  - `src/lib/coach/provider.ts` (`callCoachProvider`, fetch direto para OpenAI/Anthropic, exportado em `src/lib/coach/index.ts`).
- `runAiE2EPipeline` (harness de teste) também é exportado por `src/ai/index.ts`.

## 3. Decision Engine como única autoridade — BLOCKED/UNVERIFIED
- Não foi revisto linha a linha nesta rodada.
- `meal-ai` produz saída de IA sem passar pelo Decision Engine. Isso é WARN para esse fluxo.

## 4. Identity / authz / RLS — WARN
- `askAiCoach` exige `readAccessSession()` e `assertSecurityConfiguration()`. PASS.
- Remoto: as 9 tabelas `ai_*` têm RLS ligada, **0 policies** e nenhum SELECT para anon/authenticated. Isso é deny-by-default, correto para acesso só via service_role.
- `profiles`, `app_state` e `sessions` têm 4 policies e SELECT só para authenticated. Não há mais acesso anon, o que diverge do modo "device_id sem login" criado antes: é preciso confirmar se o app ainda consegue sincronizar.

## 5. Agents / Skills / Tools / MCP — BLOCKED/UNVERIFIED
- Só há evidência de testes locais (probes `tools`/`authorization` PASS em ambiente local).
- Não há prova de produção.

## 6. RAG — FAIL
- Remoto: extensão `vector` instalada. As tabelas `ai_knowledge_sources`, `ai_knowledge_documents` e `ai_knowledge_chunks` existem, mas as contagens são **0 / 0 / 0**, com **0 embeddings**.
- O corpus nunca foi semeado (`scripts/seed-rag-corpus.ts` não rodou contra o remoto).
- O relatório já marca DEGRADED, o que é consistente.

## 7. Memory — WARN
- As tabelas existem com RLS. `ai_user_memory` tem 0 linhas.
- A persistência após restart não pode ser provada: não há nenhuma escrita real.
- `registerMemoryInfrastructure` em produção faz o bootstrap assíncrono sem `await`. Uma primeira requisição pode chegar antes do store estar pronto.

## 8. LLM Gateway — WARN
- `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` existem, mas já foram recusadas antes (valores inválidos). Status atual não verificado.
- `AI_RUNTIME_MODE` não está definido em lugar nenhum. O padrão é `deterministic`, então em produção o LLM fica desligado.
- Mock é proibido em produção (`registry.ts`, `env.ts`). PASS.
- Existe timeout (`gateway.ts:237`). Retry e custo têm limites em `cost-bounds.ts`.
- Os modelos estão fixos (`gpt-4o-mini`, `claude-sonnet-4-20250514`).

## 9. Audit crítico — WARN
- `persist.server.ts` trata `critical` e não considera "DB indisponível" como sucesso. PASS no código.
- Remoto: `ai_audit_events` tem **0 linhas**. Nunca houve auditoria real gravada.

## 10. Rate limit distribuído — WARN
- A RPC `ai_rate_limit_consume` existe no remoto, é SECURITY DEFINER e anon não pode executá-la. PASS.
- `ai_rate_limit_buckets` tem 0 linhas, então nunca foi exercitada.
- `askAiCoach` muda `process.env` em runtime (`AI_RL_API_RPM`) para passar parâmetros. Com requisições simultâneas, uma pode sobrescrever a outra (condição de corrida).

## 11. Kill switch / rollback — PASS (local) / UNVERIFIED (produção)
- Os probes passam localmente. Não há flag real configurada no ambiente publicado.

## 12. Certification runner — PASS com ressalva
- UNTESTED, BLOCKED e DEGRADED não viram PASS (`certification-integrity.test.ts`). `production_ready: false` está correto.
- Ressalva: o relatório não é do HEAD atual (ver item 1).

## 13. CI/CD gate — WARN
- `ai-ci-gate-verdict.mjs`: um BLOCKED remoto sem service role sai com **exit 0** (linhas 7, 32–33, 149). O resultado é marcado "BLOCKED", mas o job não falha.
- Um release que dependa apenas do exit code pode ser liberado com o banco não verificado.

## 14. Production E2E — BLOCKED
- O relatório mostra `PRODUCTION_E2E_BLOCKED`. Não há evidência de execução em produção.
- O app não está publicado.

## 15. Migrations local vs remoto — PASS
- Local: 54 arquivos, sendo o último `20261101120000_fase22_10_ai_rate_limits`.
- Remoto: 54 versões aplicadas, máximo `20261101120000`. Os números batem.
- O relatório diz "MIGRATION_VERIFICATION_BLOCKED" só porque rodou sem acesso ao banco. Divergência documental.
- Existem arquivos SQL soltos fora das migrations (`supabase/DEPLOY_PENDING_FASE22.sql`, `DEPLOY_PENDING_HUBS.sql`, `DEPLOY_HARDEN_20260919.sql`). Não foi verificado se já estão cobertos pelas migrations.

## 16. Documentação vs código vs banco — WARN
- Docs citam o commit `07b4250`, mas o HEAD é `5ae6e72`.
- O relatório diz que as migrations estão BLOCKED, mas no remoto estão aplicadas.
- Docs dão o RAG como pronto após o seed, mas o banco está vazio.
- A doc da FASE 1 fala em "sem auth/device_id", mas as policies atuais exigem authenticated.

---

## A) Matriz de readiness
```text
Item                 Status
Commit/relatórios    FAIL
Canonical runtime    WARN (caminhos paralelos)
Decision authority   UNVERIFIED
Identity/RLS         WARN
Agents/Tools/MCP     UNVERIFIED
RAG                  FAIL (corpus 0)
Memory               WARN (0 escritas)
LLM Gateway          WARN (modo deterministic, chaves duvidosas)
Audit                WARN (0 eventos)
Rate limit           WARN (corrida em process.env)
Kill switch          PASS local
Certification        PASS lógica / relatório desatualizado
CI gate              WARN (BLOCKED = exit 0)
Production E2E       BLOCKED
Migrations           PASS (54 = 54)
Docs x banco         WARN
```

## B) Prioridades
- **P0:** semear o RAG no remoto. Validar as chaves de LLM e definir `AI_RUNTIME_MODE`. Fazer o CI falhar com BLOCKED crítico em branches de release. Rodar a certificação no HEAD com acesso ao banco.
- **P1:** levar `meal-ai` e `callCoachProvider` para o runtime canônico, ou remover. Tirar a mutação de `process.env` do `askAiCoach`. Fazer `await` no bootstrap da Memory. Rodar o E2E de produção após publicar.
- **P2:** reconciliar os `.sql` soltos. Atualizar os docs. Remover a exportação do harness E2E no barrel público. Revisar o conflito entre sync por device_id e as policies só-authenticated.

## C) O que corrigir (lista exata)
1. `scripts/seed-rag-corpus.ts` contra o remoto: meta de ≥20 docs com embeddings.
2. Definir `AI_RUNTIME_MODE` e revalidar `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`.
3. `scripts/ai-ci-gate-verdict.mjs`: BLOCKED crítico deve dar exit ≠ 0 em release.
4. `src/lib/meal-ai.functions.ts` e `src/lib/coach/provider.ts`: passar pelo gateway/runtime.
5. `src/lib/coach.functions.ts`: passar os limites como parâmetro, sem mexer em `process.env`.
6. `src/ai/memory/register.ts`: garantir que o store esteja pronto antes de usar.
7. Regenerar `docs/certification/*` no HEAD com acesso remoto.
8. Conferir o sync do app contra as policies atuais de `profiles`, `app_state` e `sessions`.

## D) Já pode ser considerado encerrado
- Migrations aplicadas no remoto (54/54).
- pgvector instalado.
- Tabelas `ai_*` com RLS deny-by-default.
- RPC de rate limit protegida.
- Mock proibido em produção.
- Lógica do runner (UNTESTED ≠ PASS).
- Audit crítico sem falso sucesso no código.

## E) Veredito
**Não está production-ready.** A arquitetura está bem desenhada e o banco está provisionado. Mas não há nenhum dado operacional: RAG, audit, memory e rate limit estão todos vazios. O LLM está desligado por padrão, existem caminhos de IA paralelos e o CI deixa passar um BLOCKED. Por fim, a certificação não corresponde ao commit atual.
