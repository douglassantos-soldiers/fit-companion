# Auditoria técnica read-only — HEAD 087de09 (29/09/2026)

Nenhum arquivo, migration, banco, config ou secret alterado. Evidência = leitura de código e artefatos neste turno. Nenhum teste foi executado neste turno, salvo o build do ambiente (build OK às 21:47Z) — todo o resto é UNVERIFIED. Chaves OpenAI/Anthropic ausentes NÃO são tratadas como bug.

## Estado observado
- HEAD 087de09; último commit de código b28bd6c; `docs/certification/latest.json` → commit b28bd6c, `environment: "local"`, `production_ready: true`.
- 44 rotas de página + 2 rotas de API (`api/cron.daily-pushes.ts`, `api/shopify.webhook.ts`); 25 módulos de server functions.
- `src/start.ts`: middleware de erro + CSRF para server functions; **sem** middleware de token de sessão (identidade por cookie de acesso/device).
- Build do ambiente: OK. Log de build anterior mostrava `hubs.$slug.tsx:244 formatActivityEvent` e `onboarding.tsx:627 ExercisePreferenceValue` não encontrados — o build mais recente passou, mas o typecheck completo (tsgo) não terminou no tempo limite: UNVERIFIED.

## Achados

| # | Sev | Domínio | Evidência | Impacto | Ação |
|---|---|---|---|---|---|
| 1 | P0 | Certificação | `latest.json` `environment: "local"`, `production_ready: true` | "Pronto para produção" afirmado sem ambiente de produção | Rodar a certificação contra o app publicado + banco remoto; exigir `environment=production` no gate de release |
| 2 | P0 | Identidade | `session-identity.server.ts:120-129` resolve usuário via `deviceId`; `security-access-matrix.ts` exige cookie de acesso | Se um fluxo aceitar só o deviceId, quem souber o id vira o dono | Auditar cada server fn que recebe `deviceId` (`sync.functions.ts` inteiro) e exigir identidade assinada por cookie |
| 3 | P0 | Persistência/RLS | 11 migrations com `USING (true)`; migrations de hardening depois (`20260919120000_harden_domain_rls`) | Pode ter sobrado alguma policy aberta no remoto | Consultar `pg_policies` remoto e listar as que ainda usam `true` |
| 4 | P1 | IA paralela | `meal-ai.functions.ts` ainda contém `api.openai.com` | Rota fora do gateway (sem kill switch/audit/rate limit) se ativada | Levar para `invokeAI` ou remover a URL |
| 5 | P1 | Rate limit | `coach.functions.ts:40-41` lê `COACH_RPM/RPD` em runtime (sem mutação encontrada nesta leitura) | Ok se só leitura; confirmar que a escrita em `process.env` foi removida | Confirmar via busca por `process.env[...] =` |
| 6 | P1 | CI | Só existe `ai-eval.yml`; nada cobre social/nutrição/treino/sync | Regressões fora da IA passam | Workflow geral: lint + typecheck + `vitest run` + build |
| 7 | P1 | E2E | Nenhum E2E de navegador no repo; app não publicado | Fluxos de treino/nutrição/social sem prova ponta a ponta | Smoke Playwright nas rotas principais |
| 8 | P1 | Typecheck | `package.json` `typecheck: tsc --noEmit`; erros anteriores em social.ts/hubs.ts/store.tsx | Build OK não garante tipos | Rodar tsgo até terminar e zerar |
| 9 | P2 | Webhooks | `shopify.webhook.ts:17-44` HMAC verificado, rejeita sem secret — PASS; `cron.daily-pushes.ts:7-10` Bearer `CRON_SECRET` com `!==` | Comparação não constante (baixo risco) | `timingSafeEqual` |
| 10 | P2 | Migrations | SQLs soltos em `supabase/DEPLOY_*.sql` | Drift fácil entre repo e banco | Arquivar ou converter em migrations |
| 11 | P2 | Storage | Buckets `checkins` e `soldiers-media` públicos; `progress-photos` privado | Check-ins públicos podem expor fotos de usuário | Confirmar conteúdo de `checkins`; tornar privado se tiver dados pessoais |
| 12 | P3 | IA | Runtime padrão `deterministic` (`runtime-mode.ts:8`) | Esperado sem chaves | Nenhuma agora |

## Não verificado neste turno (declarado honestamente)
Rotas de conteúdo/admin/governance linha a linha, wearables callback, idempotência do sync, conflito de versão de check-in em concorrência, acessibilidade, performance, dependências vulneráveis, suíte Vitest, lint.

## Veredito
**Não pronto para produção.** Pronto para beta fechado, se os P0 2 e 3 forem confirmados como seguros.

**Bloqueios absolutos:** #1 certificação local marcada como pronta; #2 identidade por deviceId sem prova de cookie assinado; #3 policies abertas não descartadas no remoto.

**Aceitável em beta:** IA em modo determinístico, P2/P3, falta de E2E se houver smoke manual.

## Matriz por domínio
Rotas/UX UNVERIFIED · Treino/Sessão UNVERIFIED · Nutrição WARN (#4) · Social/Clubes/Hubs WARN (tipos #8) · Sync/Persistência FAIL (#2) · Auth/RLS BLOCKED (#3) · Webhooks/Cron PASS (#9 menor) · Storage WARN (#11) · IA runtime PASS-determinístico · Certificação FAIL (#1) · CI FAIL (#6) · E2E FAIL (#7) · Migrations WARN (#10) · Build PASS · Typecheck UNVERIFIED.

## Checklist para liberar produção
1. Listar policies remotas e eliminar `USING (true)` em dados de usuário.
2. Provar que toda server fn com `deviceId` exige cookie de acesso assinado.
3. Tirar `api.openai.com` direto da IA de refeições.
4. Zerar typecheck e lint; rodar `vitest run` inteiro e guardar o resultado.
5. Adicionar CI geral + smoke E2E das rotas principais.
6. Publicar e rodar a certificação com `environment=production` no HEAD.
7. Revisar o bucket `checkins` e os SQLs soltos.

Ao aprovar, eu executo as consultas de leitura pendentes (policies remotas, buckets, typecheck completo, vitest) e atualizo esta matriz, sem alterar nada.
