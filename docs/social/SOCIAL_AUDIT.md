# SOCIAL_AUDIT.md — Soldiers Performance Social

Auditoria read-only (FASE 0). Sem mudança funcional nesta etapa.

Data: 2026-09-30  
Escopo: `/social` + clubes/desafios/hubs relacionados.

---

## 1. Estado atual (mapa)

| Área | Estado |
|------|--------|
| Hub `/social` | Tabs: `feed` (Para você), `clubes`, `desafios`, `hubs` |
| Feed | Sempre `fetchForYouFeed` via `useClubSocialFeed({ mode: "foryou" })` |
| Filtros Para você / Seguindo / Meu grupo | **Não existem** no feed; “Seguindo” é link para `/social/seguidores` |
| Feed de clube | Existe (`fetchClubFeed` + mode `club` na Home), não como filtro no hub Social |
| Stories | `ClubStoriesRail` no feed e na tab clubes |
| Perfil `/social/$userId` | Header com avatar, stats, tabs atividades/evolução/conquistas/desafios |
| Grafo | follow/unfollow/block/mute, reações, comentários, denúncias |
| Desafios | Cards featured/compact, wearables em accordion, convites |
| Redirects | `/clubes` → `?tab=clubes`; `/hubs` → `?tab=hubs` |

---

## 2. O que funciona

- Publicação de eventos (`session`, `proof`, challenges, etc.)
- For-you feed server-side com privacidade, blocks/mutes, dismissals, editorial
- Club feed por `device_id` dos membros
- Reações, comentários, denúncia, dismiss
- Follow graph + lista seguidores/seguindo
- Clubes (criar/entrar), liga, friend quest, stories
- Perfil social + privacy no Perfil
- Mutations via `assertDevice` → `resolveTrustedIdentity({ requireAccess: true })`

---

## 3. Incompleto / gaps

| Gap | Detalhe |
|-----|---------|
| Filtro Seguindo no feed | `fetchFollowingFeed` **não existe** |
| Filtro Meu grupo no feed | Mode `club` no hook existe, UI do hub não usa |
| `ActivityCard` tipado | Um `FeedCard` genérico; métricas via `metricsFromEvent` (polish recente) |
| Empty states por filtro | Empty genérico + “Quem seguir”; sem CTA específico por chip |
| `social.index.tsx` | Ainda monolítico (~740 linhas) |
| Following feed | Precisa server path dedicado (sem tabela nova) |

---

## 4. UX e arquitetura

- Identidade visual Soldiers aplicada (dark + amarelo, Anton/Barlow, glass).
- Feed ainda mistura descoberta (PRs, editorial) com grafo — ok para “Para você”, inadequado para “Seguindo”.
- Clubes e Hubs separados (correto para FASE 1; unificação fora de escopo).
- Polish recente reutilizável: `SocialAvatar`, `ClubStoriesRail`, `ChallengeCard`, `ProofStatusBadge`.

---

## 5. Segurança

- Mutations: **não** autorizam só com `deviceId`; exigem sessão (`soldiers_access`).
- `deviceId` = provenance/device; `userId` da sessão.
- Ranking/desafios: progresso calculado server/client com regras existentes; FASE 1 não mexe.
- RLS: migrations `phase5_social`, `fase8_social_performance`, `fase12_social_graph`, `social_feed_rls_harden`, `fase16_feed_signals`.
- Dívida conhecida (fora FASE 1): rate limiting de comment/follow; revisão contínua de RLS.

---

## 6. Componentes

**Reutilizar:** `activity-feed`, `social-avatar`, `club-stories-rail`, `challenge-card`, `follow-actions`, `proof-*`, `invite-friends`, `wearable-providers`.

**Refatorar na FASE 1:** extrair `ActivityCard` de `FeedCard`; adicionar `FeedFilterChips`; estender hook.

---

## 7. Tabelas existentes (não duplicar)

`social_profiles`, `social_follows`, `social_blocks`, `social_mutes`, `activity_events`, `activity_reactions`, `activity_comments`, `activity_kudos`, `clubs`, `club_members`, `club_stories`, `club_league_weeks`, `friend_quests`, `challenge_entries`, `challenge_progress`, `challenge_invites`, `hubs`, `hub_members`, `hub_challenges`, `feed_impressions`, `feed_dismissals`, `content_*` (editorial).

**FASE 1:** nenhuma tabela/migration nova. Following = filtrar `activity_events` por `social_follows`.

---

## 8. Riscos

| Risco | Mitigação |
|-------|-----------|
| `fetchClubFeed` client-side vs for-you server | Manter paths existentes; club mode no hook inalterado |
| Following vazio = tela morta | Empty state + CTA seguidores / Quem seguir |
| Monólito `social.index` cresce | Chips e empty extraídos; cards em arquivo próprio |
| Quebrar Home que usa mode `club` | Estender union de modes sem mudar default |

---

## 9. Arquivos FASE 1

| Ação | Arquivo |
|------|---------|
| Create | `docs/social/SOCIAL_AUDIT.md` (este) |
| Create | `src/components/social/feed-filter-chips.tsx` |
| Create | `src/components/social/activity-card.tsx` |
| Edit | `src/components/social/activity-feed.tsx` |
| Edit | `src/hooks/use-club-social-feed.ts` |
| Edit | `src/routes/social.index.tsx` |
| Edit | `src/lib/social.ts` — `fetchFollowingFeed` |
| Edit | `src/lib/social/graph.server.ts` — `getFollowingFeedServer` |
| Edit | `src/lib/social/graph.functions.ts` — `getFollowingFeedFn` |

---

## 10. Plano concreto FASE 1

1. `getFollowingFeedServer`: eventos 14d → privacy/blocks → **só** `author ∈ followingIds` → reactions/comments → **sem** editorial.
2. `fetchFollowingFeed` + mode `"following"` no hook; `"club"` já existe.
3. Search `feedFilter=foryou|following|club` (default `foryou`) + `FeedFilterChips` na tab feed.
4. Extrair `ActivityCard` tipado (switch por `kind`); feed lista usa o card.
5. Empty states: following sem gente → CTA seguidores; club sem clube → tab clubes; foryou vazio → Quem seguir / criar clube.
6. Preservar stories, tabs clubes/desafios/hubs, sem rotas novas.
