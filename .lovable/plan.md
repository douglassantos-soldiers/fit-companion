# Auditoria somente leitura — /social (estado atual e proposta futura)

Nenhum arquivo, banco ou configuração foi alterado. Evidência: leitura de rotas, lib/social*, componentes e migrations; lista de tabelas/policies do Supabase remoto (fornecida pelo ambiente). Nenhum teste executado.

## 1. O que existe hoje

Rotas:
- `/social` (layout, só `<Outlet />`) e `/social/` (social.index.tsx, 617 linhas): 3 abas via `?tab=feed|clubes|desafios` + botões "Seguindo" e "Ranking".
- `/social/$userId`: perfil com abas Atividades, Evolução, Conquistas, Desafios; seguir/silenciar/bloquear; denunciar perfil.
- `/social/seguidores`: seguidores/seguindo.
- `/desafios`: ranking de um desafio. `/hubs`, `/hubs/$slug`: hubs de criadores. `/clubes`: só redirect para `/social?tab=clubes`.

Fluxo de dados:
- Feed "Para você": `useClubSocialFeed` → `fetchForYouFeed` (fallback feed global). Ranking por regras em `feed-rank.ts` (seguindo +20, clube +10, PR de seguido +30, editorial +15, penaliza visto 2x sem interação).
- Escritas via `socialWriteFn` → `social-write.server.ts` com ops: follow, unfollow, block, unblock, mute, unmute, react, comment.
- Reações: fire, muscle, clap, trophy, heart. Comentários com exclusão e denúncia.
- Privacidade por campo em `visibility.ts`: profile/workouts/prs públicos por padrão; weight/photos/nutrition privados; peso nunca público; fotos no máximo "friends". "Amigos" = seguem-se mutuamente ou mesmo clube.
- Desafios: catálogo em `data/challenges.ts` (consistência, força, corrida, passos, futebol, massa, condicionamento), modos meta pessoal e % de evolução, sugestões por perfil e "IA" (regras), convites entre seguidores, registro manual de passos/futebol (auto-relatado, anti-fraude em `anti-fraud.ts`).
- Clubes: criar, entrar por código, feed do clube.
- Prova de performance: sempre `self_reported` (sem verificação).

Banco (remoto): social_profiles, social_follows, social_blocks, social_mutes, activity_events, activity_reactions, activity_comments, activity_kudos, clubs, club_members, club_stories, club_league_weeks, challenge_entries, challenge_progress, challenge_invites, friend_quests, hubs, hub_members, hub_challenges, content_reports, feed_impressions, feed_dismissals. Só activity_events tem policy (leitura pública endurecida em 20261015120000); o restante tem RLS sem policies — acesso só pelo servidor.

## 2. Problemas encontrados

P0
- Identidade social = `deviceId` enviado pelo cliente (todas as server fns recebem `deviceId`). Qualquer pessoa com o id de outro aparelho pode agir como ele (seguir, comentar, reagir). Precisa virar conta autenticada ou cookie assinado.
- Migration 20260913020000 criou policies `USING (true)` para anon; a harden posterior removeu, mas deve ser confirmado por consulta remota antes de liberar.

P1
- social.index.tsx concentra feed + clubes + desafios + logs manuais + convites + wearables (617 linhas, vários useEffect sem cache). Difícil evoluir e lento no celular.
- Sem notificações sociais (existe `notifications.ts`, mas não há central de "curtiram/comentaram/te seguiram/te convidaram").
- Sem busca/descoberta de pessoas, clubes ou desafios.
- Sem criação de post: o feed só mostra eventos automáticos (treino, PR, desafio). Não dá para compartilhar com legenda/foto.
- "Ranking" é por desafio; não há leaderboard semanal de clube/seguidos (tabela club_league_weeks existe sem tela clara).
- Hubs e Clubes são dois conceitos de grupo paralelos sem distinção clara na navegação.
- Perfil do usuário atual (`/perfil`) separado do perfil social; privacidade não editável de forma visível dentro do Social.

P2
- Prova sempre auto-relatada; nenhum selo verificado (wearable) ainda.
- `/clubes` é só redirect; aba de desafios duplica `/desafios`.
- Estados vazios existem (EMPTY_FEED_*, EMPTY_PROFILE_*), mas sem ação guiada ("siga 3 atletas", "entre em um clube").
- Anti-spam: sem limite de comentários/reações por minuto visível no social-write (rate limit só existe na IA).

## 3. O que não copiar das referências
- Feed infinito de fotos/selfies e likes como métrica principal.
- Stories efêmeros, DMs abertas, seguidores como vaidade.
- Comparação corporal pública (peso, medidas, fotos antes/depois públicas).
- Ranking absoluto que pune iniciante (preferir % de evolução e meta pessoal, que já existem).
- Algoritmo opaco de engajamento; manter ranking por regras explicáveis.

## 4. Proposta: Social de performance, não rede social genérica

Princípio: todo card nasce de uma ação de treino (sessão, PR, sequência, desafio, marco). Interação é "respeito" (reações de performance), não curtida.

Navegação mobile (dentro do tab Social da barra inferior):

```text
/social            -> Feed (Seguindo | Clube | Para você) em chips no topo
/social/grupos     -> Meus clubes + descobrir (hubs de criadores como "oficiais")
/social/grupos/$id -> Feed do grupo, membros, liga semanal, desafios do grupo
/social/desafios   -> Ativos, convites, descobrir; detalhe com ranking
/social/ranking    -> Liga semanal: seguidos / clube (pontos de consistência)
/social/notificacoes -> reações, comentários, seguidores, convites
/social/buscar     -> pessoas, grupos, desafios
/social/$userId    -> perfil de atleta (já existe; ajustar)
/social/eu/privacidade -> controles de visibilidade por campo
```
Botão flutuante amarelo "Compartilhar": escolhe um treino/PR recente e publica card com legenda opcional.

Componentes a criar/ajustar:
- Criar: SocialHeader (busca + sino com contador), FeedFilterChips, ActivityCard por tipo (sessão, PR, sequência, desafio concluído, marco), ReactionBar (fire/muscle/trophy), CommentSheet (bottom sheet), ShareActivitySheet, GroupCard, GroupHeader, LeagueTable, ChallengeCard com barra de progresso, ChallengeRankRow, NotificationItem, AthleteProfileHeader (streak, treinos/semana, PRs, selo de prova), PrivacyToggleRow, EmptyStateCTA.
- Ajustar: dividir social.index.tsx por rota; activity-feed.tsx em cards menores; follow-actions no header do perfil; transformar /clubes e /desafios em redirects para as novas rotas; unificar Hubs como "grupos oficiais".

Identidade visual: manter preto + grafite + amarelo, títulos condensados em caixa alta; cards densos com número grande (volume, carga, sequência) como destaque; amarelo só para ação principal e conquista.

## 5. Dados e backend

Já existe e basta usar: follows/blocks/mutes, eventos, reações, comentários, reports, clubes, liga semanal, desafios/convites, impressões/dismissals.

Necessário:
- Identidade confiável: usuário autenticado como autor (user_id), deviceId só como vínculo do aparelho.
- `social_notifications` (destinatário, tipo, ator, alvo, lida_em).
- `activity_events`: campos `visibility`, `caption`, `media_path`, `verified` e `source`.
- `club_roles` (dono, moderador, membro) e `club_join_requests` para grupos privados.
- Pontuação de liga derivada no servidor (sessões concluídas, consistência, PRs) — nunca enviada pelo cliente.
- Limite de frequência para comentar/reagir/seguir; fila de moderação para `content_reports`.
- RLS: leitura pública só de eventos `visibility=public` e perfis públicos; escrita só pelo servidor; confirmar remotamente que nenhuma policy `USING (true)` sobrou.

## 6. Gamificação ligada a performance
- Pontos de liga = consistência semanal + sessões concluídas + PRs (com teto por dia para evitar farm).
- Desafios de grupo com meta coletiva (soma do clube) e individual (% de evolução).
- Marcos automáticos no feed: 10/50/100 treinos, sequência de 4 semanas, novo PR.
- Selo "verificado" só com dado de wearable; auto-relatado continua com selo neutro.

## 7. Privacidade padrão
- Público: nome, treinos concluídos, PRs, desafios. Amigos: fotos. Privado sempre: peso, medidas, nutrição, suplementos, fotos de corpo.
- Bloqueio esconde tudo nos dois sentidos (já em `canSeeContent`); silenciar só no feed.
- Menores/sem conta: perfil "amigos" por padrão.

## 8. Fases

MUST HAVE (Fase A)
- Identidade autenticada no Social e revisão das policies remotas.
- Dividir /social em rotas: feed, grupos, desafios, perfil.
- Central de notificações.
- Estados vazios com ação guiada.
- Limite de frequência para reações/comentários/follows.
- Tela de privacidade dentro do Social.

SHOULD HAVE (Fase B)
- Compartilhar treino/PR com legenda e foto (bucket privado + link assinado).
- Liga semanal de clube e de seguidos.
- Busca de pessoas/grupos/desafios.
- Grupos com papéis e pedidos de entrada; hubs como grupos oficiais.
- Desafios coletivos de grupo.

FUTURE (Fase C)
- Selo verificado via wearables.
- Moderação no /admin para denúncias.
- Ranking "Para você" com mais sinais (ainda por regras).
- Eventos presenciais do clube e integração com loja (recompensas).

## Recomendação final
O /social do Soldiers Performance deve ser um "vestiário de performance": feed de treinos e PRs de quem você segue e do seu clube, grupos com liga semanal, desafios baseados em evolução pessoal e um perfil de atleta com consistência e conquistas — sem exposição corporal, sem vaidade de seguidores. Antes de qualquer UI nova, resolver a identidade por deviceId (P0), porque todo o resto (reações, ranking, convites) depende de saber com certeza quem está agindo.
