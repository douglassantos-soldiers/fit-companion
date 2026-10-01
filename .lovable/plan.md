# Auditoria técnica read-only — HEAD 8f4ff34 (1/10/2026)

Nada foi alterado: nenhum arquivo, migration, dado, secret ou config. Só leitura de código, SELECTs no banco e uma medição no site publicado.

Nota de versão: o HEAD local é `eacae62` ("Work in progress"), que difere de `8f4ff34` só em `bun.lock` (+8 linhas). O código auditado é o de 8f4ff34. Não há como confirmar que o site publicado roda esse commit.

Legenda de evidência: [código] lido no repo · [banco] SELECT no Supabase · [medido] Playwright no site publicado · [inferido] · [não verificável].

## A) Veredito

**NOT PRODUCTION READY.** O próprio projeto concorda: `docs/certification/latest.json` tem `production_ready: false` e `environment: LOCAL_TEST`, e o gate do operador (`operator-gate-evidence.json`, head 3558524) termina em PENDING OPERATOR. LLM live probe: **PENDENTE DE CONFIGURAÇÃO** (não é blocker).

## B) Achados por severidade

**P0**
1. Status da conta (`users.status`) continua sendo consultado em toda resolução de identidade, sem cache: as chamadas subiram de 585.352 para 641.463 (+56 mil em ~1 dia, para 240 usuários) [banco]; `session-identity.server.ts:134,171` sem TTL [código].
2. Ainda não há prova de RLS no remoto (gate `rls_remote_probe` = pending_operator). Pelo banco: 0 tabelas com RLS desligado, 62 tabelas com RLS ligado e nenhuma policy (deny-by-default, só service_role) e 4 policies `true` só para authenticated (food_nutrients, food_servings, recipes, recipe_items, que são catálogo) [banco]. O risco real cai, mas o gate formal continua aberto.
3. Não existe E2E autenticado (gate `e2e_authenticated` pending; `e2e/authenticated.spec.ts` é só um esqueleto) [código]. Nenhum fluxo logado foi provado em navegador.

**P1**
4. Bootstrap ainda sequencial: `ensureIdentityForDevice` → `pullState` (store.tsx:637,645) → contexto de decisão [código].
5. `pullForUserId` ainda faz 8 `select("*")` sem limite (hydrate.server.ts:231-238); são 38 `select("*")` em src/lib [código].
6. Nenhuma rota tem loader e 0 componentes usam TanStack Query [código].
7. MUI e Mantine continuam no root (ui-providers.tsx); MUI/Mantine/HeroUI ainda são importados em 9 arquivos [código]. Bundle publicado sem mudança (abaixo) [medido].
8. O store continua monolítico (store.tsx 87 KB) e grava o estado inteiro no localStorage (store.tsx:819) [código].
9. `meal-ai.functions.ts` ainda chama api.openai.com direto, fora do gateway [código]. Como as chaves estão ausentes, não quebra, mas viola a arquitetura do gateway.
10. Backup/restore drill, exclusão de conta ao vivo e Shopify/push ao vivo seguem pending_operator [código/evidência].

**P2**
11. Vídeos com `autoPlay` por padrão, sem `preload="none"` nem IntersectionObserver (soldiers-media-frame.tsx:11,30); /welcome baixa 460 KB de vídeo [código+medido].
12. `AnimatePresence mode="wait"` com key=pathname continua no __root (linha 103) [código].
13. Só 3 arquivos usam `loading="lazy"` [código].
14. Buckets `checkins` e `soldiers-media` são públicos. Para mídia está ok; para check-ins precisa justificativa [banco].
15. SQLs soltos em supabase/ (DEPLOY_*.sql) [código].

**P3**
16. CSS de 808 KB decodificado (94 KB transferido) [medido].
17. O gate do operador registra o head 3558524, não o atual.

## C) Matriz por domínio

| Domínio | Status |
|---|---|
| Rotas/layouts/loaders | PARTIAL (rotas ok, sem loaders) |
| Onboarding/auth/access/admin | PARTIAL (sem E2E logado) |
| Treino/sessão/histórico | PARTIAL (só unit) |
| Nutrição/água/suplementos | PARTIAL (meal-ai fora do gateway) |
| Progresso/medidas/fotos | PARTIAL (posse das fotos com teste unit; remoto não provado) |
| Social/clubes/desafios/hubs | PARTIAL (escrita via service_role; sem E2E) |
| Conteúdo/CMS | PARTIAL |
| Coach/AI determinística | PASS (local) |
| Decision/safety/agents/governance | PASS (local) |
| RAG/Memory/audit/rate limit | PASS no banco / PENDING no gate remoto |
| LLM live | PENDENTE DE CONFIGURAÇÃO |
| Shopify/wearables/cron/push | PENDING OPERATOR |
| Sync/local-first/multi-device | PARTIAL (repush do estado inteiro) |
| Segurança/RLS/storage | PARTIAL (deny-by-default no banco; gate pendente) |
| Banco/índices | PASS (índices) / FAIL (volume users.status) |
| Performance | FAIL (quase nada mudou no bundle e no carregamento) |
| Testes/CI | PARTIAL (product-ci.yml cobre lint, typecheck, vitest, build e smoke; sem auth E2E) |
| LGPD export/exclusão | PARTIAL (unit ok, ao vivo pendente) |
| Observabilidade/backup | PENDING OPERATOR |
| Release/certificação | FAIL (production_ready false) |

## D) Rotas (46 arquivos)

Públicas: /welcome, /entrar, /cadastro, /acesso, /termos, /privacidade, /wearables/callback, /admin, /governance/* (9). Protegidas pelo AccessGate: /, /onboarding, /treino (index, sessao.$id, exercicio.$id, historico.$sessionId), /nutricao, /suplementos, /progresso (index, corpo, resumo), /desafios, /clubes, /hubs (index, $slug), /social (index, $userId, seguidores), /conteudo (index, $id), /coach, /perfil. API: /api/shopify/webhook, /api/cron/daily-pushes. Nenhuma tem loader. Situação de todas: PARTIAL (carregam no cliente, sem E2E logado). /governance e /admin dependem de cookie de admin [código].

## E) Performance: antes e depois

| Problema anterior | Agora |
|---|---|
| AccessGate a cada troca de página | **CORRIGIDO**: bootstrap uma vez + revalidação em auth e visibilidade (access-session-provider.tsx:212-250) |
| Bootstrap sequencial | CONTINUA |
| pullState com select(*) | CONTINUA |
| users.status (585 mil) | CONTINUA E CRESCE (641 mil) |
| Sem loaders/Query | CONTINUA |
| MUI/Mantine/HeroUI | CONTINUA |
| JS 470 KB / 1,49 MB | CONTINUA (470 KB / 1,49 MB) [medido] |
| CSS 808 KB | CONTINUA (808 KB) [medido] |
| Catálogo 415 KB | CONTINUA (getPublicCatalog sem mudança) [inferido] |
| localStorage do estado inteiro | CONTINUA |
| Store monolítico | CONTINUA |
| Vídeos eager | CONTINUA (460 KB) |
| AnimatePresence por rota | CONTINUA |
| Poucas imagens lazy | CONTINUA |
| Sync repush | CONTINUA [inferido] |

Medido agora (1 amostra, desktop, deslogado): /welcome com TTFB 1.527 ms, FCP 1.972 ms, load 2.952 ms e 98 recursos; /entrar com TTFB 621 ms, FCP 932 ms, load 1.296 ms. Antes, /welcome teve TTFB 1.142 ms e FCP 1.840 ms. Com uma amostra só, essa diferença é ruído. Rotas logadas não foram medidas porque não há credencial de teste [não verificável].

## F) Segurança
- Identidade por deviceId ainda existe; o gate de identidade tem testes unit (identity-cron.test.ts), mas não há prova ao vivo.
- Admin: o papel vem de app_metadata, validado no servidor; cookies SameSite=None em https; CSRF middleware ativo (start.ts).
- Webhook Shopify e cron: com HMAC/secret, sem prova ao vivo.
- service_role usado nas escritas de domínio, como esperado.
- Leaked-password protection: pendente no painel do Supabase.

## G) Persistência e sync
Push do estado inteiro com debounce; o prioritário é o remoto ao puxar; multi-device sem resolução de conflito por campo [código/inferido]. Outbox citado no audit 9/30, sem E2E.

## H) Banco, RLS e storage
RLS ligado em todas as tabelas públicas. 62 tabelas sem policy (só servidor). 4 tabelas de catálogo com leitura aberta a authenticated. 240 usuários. Bucket progress-photos privado; checkins público [banco]. Índices por user_id saudáveis (auditoria anterior; não reavaliados).

## I) Testes e CI
`product-ci.yml` agora roda lint, typecheck, vitest, RLS scan, RAG local, build e Playwright smoke [código]. Não executei a suíte neste turno. O typecheck já não depende de @ts-nocheck (só routeTree.gen.ts) [código]. Falta: E2E autenticado e execução do CI comprovada no GitHub [não verificável].

## J) Bloqueadores absolutos
1. Prova de RLS remoto (rodar `scripts/validate-rls-remote.mjs`).
2. E2E autenticado verde (login, onboarding, treino, refeição, sync em 2 aparelhos).
3. Cache do status da conta (parar as ~56 mil chamadas por dia).
4. Exclusão de conta ao vivo e drill de backup/restore.
5. Certificação com environment=production no SHA publicado.

## K) Aceitável para beta
LLM pendente de configuração; MUI/Mantine no bundle; vídeos eager; AnimatePresence; store monolítico; ausência de loaders; wearables pendentes; meal-ai fora do gateway (com as chaves ausentes).

## L) Checklist de liberação
- [ ] validate-rls-remote PASS
- [ ] E2E auth PASS no CI
- [ ] users.status com cache/TTL; chamadas/dia medidas antes e depois
- [ ] Exclusão ao vivo com evidência antes/depois
- [ ] Restore drill datado
- [ ] Shopify webhook + cron em staging
- [ ] Leaked-password ligado
- [ ] Site republicado; SHA publicado = SHA certificado
- [ ] `gate:operator` exit 0

## M) Próximos passos (ordem)
1. Cache de 60 s para o status da conta (ou guardá-lo no cookie assinado).
2. Rodar a prova de RLS remoto e o gate do operador com credenciais.
3. Criar conta de teste + E2E autenticado no CI.
4. Bootstrap paralelo + pullState com colunas explícitas e limites.
5. Remover MUI/Mantine do root e lazy-load por tela.
6. Vídeos com preload="none" + IntersectionObserver; imagens lazy.
7. Salvar e enviar só a parte do estado que mudou; dividir o store.
8. Loaders + TanStack Query nas rotas principais.
9. Mover meal-ai para o gateway.
10. Drill de backup, exclusão ao vivo, republicar e certificar com environment=production.
