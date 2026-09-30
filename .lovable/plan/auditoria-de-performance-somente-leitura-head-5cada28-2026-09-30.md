# Auditoria de performance (somente leitura) — HEAD 5cada28

Nenhum arquivo, migration ou dado foi alterado. No banco rodei só SELECTs e a leitura das estatísticas de consultas lentas. Legenda: [código] confirmado pelo código · [query] confirmado por query no banco · [medido] medido com Playwright no site publicado (headless, desktop, sessão deslogada, 1 execução) · [inferido] deduzido, não medido · [NM] não mensurável sem profiling com usuário logado.

## A. Resumo executivo
A lentidão e o "efeito cascata" vêm da arquitetura de inicialização, não do banco.
- **Rotas vazias** [código]: 0 rotas têm loader e 0 componentes usam TanStack Query. A tela chega do servidor vazia e só começa a buscar dados depois de montar no navegador.
- **Duas travas em cadeia** [código]: `StoreProvider` e `AccessGate` envolvem o app inteiro. Os dados de cada tela só aparecem depois de uma sequência de chamadas.
- **Chamadas sequenciais** [código]: cada chamada ao servidor refaz identidade e status da conta.
- **Bibliotecas pesadas** [código]: MUI, Mantine e HeroUI entram no layout principal.
- **Banco** [query]: está saudável e bem indexado. A consulta mais chamada (status do usuário) soma 585 mil chamadas para 217 usuários, o que indica chamadas repetidas demais.

Veredito: NÃO pronto para produção em performance.

## B. TOP 20 gargalos
| # | Sev | Gargalo | Evidência |
|---|---|---|---|
| 1 | P0 | O `AccessGate` roda `getAuthSession` + `checkAccessSession` (+ `grantAdmin` + outro check) **a cada troca de página** (useEffect com dependência em `pathname`) e mostra a tela de abertura enquanto isso | [código] access-gate.tsx:43-108 |
| 2 | P0 | O bootstrap do store é sequencial: `ensureIdentityForDevice` → `pullState` → `refreshDecisionContext` → `persistUserPatterns` | [código] store.tsx:619-802 |
| 3 | P0 | `pullStateServer`: `resolveTrustedIdentity` → `listDeviceIdsForUser` → `pullForUserId` (8+ consultas com `select('*')`, sem limite) | [código] sync.server.ts:637-653, hydrate.server.ts:232-242 |
| 4 | P0 | Status da conta consultado em toda identidade confiável (41 pontos de chamada); 585.352 chamadas, 21 s no total | [query] slow_queries #1; [código] session-identity.server.ts:190,222 |
| 5 | P1 | Nenhum loader/Query: as páginas renderizam vazias e preenchem em cascata | [código] |
| 6 | P1 | MUI + Mantine providers no root (ui-providers.tsx) + HeroUI/Headless: 3 bibliotecas de UI além do Radix/shadcn | [código] |
| 7 | P1 | CSS de 808 KB (94 KB transferidos) no carregamento inicial | [medido] |
| 8 | P1 | 64 arquivos JS no /welcome: 1,49 MB decodificados, 470 KB transferidos | [medido] |
| 9 | P1 | `getPublicCatalog` devolve JSON de 415 KB como string (parse duplo) em toda abertura | [medido] fetch 415.659 B; [código] admin.functions.ts:127 |
| 10 | P1 | Todo `setState` dispara `localStorage.setItem(JSON.stringify(state inteiro))` e um push de 700 ms com o estado inteiro | [código] store.tsx:805-816 |
| 11 | P1 | Store monolítico de 2.241 linhas num único contexto: qualquer mudança re-renderiza o app inteiro | [código]; [NM] contagem de renders |
| 12 | P1 | Vídeos com autoplay e sem `preload`: o /welcome baixa 2 webm (~460 KB) já na primeira tela | [medido]; [código] soldiers-media-frame.tsx:27 |
| 13 | P1 | `motion` AnimatePresence com `key={pathname}` desmonta e anima cada tela (troca em "fluxo") | [código] __root.tsx:139-149 |
| 14 | P2 | TTFB de 1.142 ms e FCP de 1.840 ms no /welcome deslogado | [medido], 1 amostra |
| 15 | P2 | Na abertura rodam em paralelo: CMS, catálogo, mídia, identidade e ensureSocialProfile; depois de 15 s, recompute Customer360 | [código] store.tsx:583-848 |
| 16 | P2 | Consulta de soldiers_media repete 23 colunas (incluindo prompt/spec/qa_notes) para o app | [query] slow_queries #2 |
| 17 | P2 | `catalog_exercises select *` em toda abertura (100 linhas, 50 kB) | [query] |
| 18 | P2 | Catálogos estáticos grandes em src/data (~370 KB fonte), provavelmente no bundle inicial | [código]; [inferido] |
| 19 | P2 | Só 4 de 17 `<img>` com `loading="lazy"` | [código] |
| 20 | P3 | "Falha parcial ao sincronizar" gera repush a cada mudança sem backoff | [medido] console; [código] sync.ts |

## C. Mapa rota → dados
Nenhuma rota tem loader. Todas passam por: `StoreProvider` (bootstrap, item 2) → `AccessGate` (item 1) → componente. Os componentes leem o `useStore` e fazem fetch próprio em useEffect: index 8 effects, social.index 3, nutricao/perfil/desafios 2 cada [código]. As telas maiores: index 1.189 linhas, treino.sessao 1.166, nutricao 1.134, social.index 802. O mapeamento fino componente → server fn de cada tela fica para a Fase 1 do plano (N).

## D. Waterfall provável (usuário logado) [inferido pelo código]
```text
HTML (TTFB ~1,1s) -> JS/CSS -> hidratação
 -> StoreProvider: load local -> hydrated=true
     -> ensureIdentityForDevice -> pullState(identidade -> devices -> 8 selects) -> setState
         -> refreshDecisionContext -> setState ; persistUserPatterns
     || CMS || catálogo (415KB) || mídia || ensureSocialProfile
 -> AccessGate: getAuthSession -> checkAccessSession(identidade+status) [-> grantAdmin -> check]
 -> tela: useEffects próprios -> server fns -> render final
Trocar de página: AccessGate repete tudo + animação de saída/entrada
```

## E. Duplicadas / N+1
- Status da conta em toda chamada [query/código].
- `getAuthSession` chamado duas vezes por ciclo do gate [código].
- `pullForUserId` com vários deviceIds; sem N+1 real nas 8 consultas, que já rodam em Promise.all [código].
- `select('*')` em profiles, sessions, weights, daily_metrics, supplement_logs, app_state, meal_entries e day_checkins, sem limite nem paginação [código].

## F. Fetch redundante
AccessGate (a cada rota); useEffects nas telas sem cache compartilhado; ensureSocialProfile a cada mudança de nome; push do estado inteiro a cada mudança.

## G. Bundle
- @mui/material e @mantine/core no root: bundle inicial [código].
- @heroui/react no app-shell (inicial) [código].
- Dependências declaradas e sem uso: @emotion, daisyui e embla têm 0 imports diretos (@emotion é peer do MUI) [código].
- recharts só em progresso (verificar se é carregado sob demanda) [inferido].
- O chunk "social" (281 KB) carrega já no /welcome [medido].

## H. Mídia
Autoplay em todo SoldiersMediaFrame, sem `preload="none"`/`metadata`, sem IntersectionObserver e sem pausa fora da tela. O poster vem primeiro (bom). Os vídeos baixam no load [medido].

## I. Rendering
Contexto único com o estado inteiro; `setCmsRevision` força 3 re-renders globais na abertura; AnimatePresence em cada rota [código]. Contagem real de renders: [NM].

## J. Cache / prefetch
QueryClient existe, mas não é usado; `defaultPreloadStaleTime: 0` sem Query; sem prefetch de links; CMS/catálogo/mídia sem cache HTTP nem cache local [código].

## K. Banco
Índices por user_id existem em todas as tabelas quentes [query]. Tabelas pequenas (sessions 0, users 217). O custo é de número de chamadas, não de consultas lentas. soldiers_media tem 5 índices [query].

## L. Auth bootstrap
Três fontes de identidade: sessão Supabase, cookie de acesso, deviceId. O gate espera todas antes de liberar a tela; ainda há o caminho de admin com chamadas extras [código].

## M. Impede Production Ready
Itens 1–4 (P0); ausência de medição com usuário logado; mais o que já estava em aberto das auditorias anteriores (identidade por deviceId, policies abertas).

## N. Plano de correção (ordem)
Quick wins:
1. AccessGate: checar uma vez por sessão (cache em memória + revalidação em segundo plano), sem re-check por `pathname`.
2. Cache de status da conta por requisição/usuário (ex.: 60 s) ou embutir o status no cookie assinado.
3. Remover MUI/Mantine providers do root; carregar só nas telas que usam (ou migrar para shadcn).
4. Vídeos: `preload="none"` + tocar só quando visíveis; `loading="lazy"` em todas as imagens abaixo da dobra.
5. Catálogo: devolver objeto (sem stringify), só colunas usadas, cache HTTP/local com versão.
6. Tirar AnimatePresence por rota (ou usar só fade curto sem `mode="wait"`).
7. localStorage/push: salvar só o que mudou, com debounce e backoff.

Estruturais:
8. Paralelizar bootstrap: identidade + pull num único server fn; decision context depois da primeira pintura.
9. Adotar loaders + `ensureQueryData`/`useSuspenseQuery` por rota; cache compartilhado.
10. Dividir o store em fatias/seletores (ex.: contextos por domínio).
11. Paginação/limite em histórico, sessões, refeições e social.
12. Mover catálogos estáticos de src/data para carregamento sob demanda.

## O. Métricas antes/depois
TTFB, FCP, LCP, INP e CLS (mobile 4G, logado e deslogado); número de server fns na abertura e na troca de rota; tempo até a tela útil do Hoje; JS/CSS inicial (KB transferido/decodificado); bytes de mídia na primeira tela; renders por ação (React Profiler); chamadas/min em `users.status` (pg_stat_statements).

Medido agora (base, deslogado, desktop, 1 amostra): TTFB 1.142 ms, FCP 1.840 ms, load 1.837 ms, 225 recursos, JS 470 KB transferidos/1,49 MB decodificados, CSS 808 KB decodificados.
