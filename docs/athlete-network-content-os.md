# Athlete Network + Content OS

A Fase 8 adiciona **identidade esportiva persistida** e um **Content OS** editorial. Decision Engine, Living Plan, planner e o grafo social **não** são reescritos.

## Dois conceitos de “activity”

| Conceito | Tabela / tipo | Papel |
| -------- | ------------- | ----- |
| Atividade física | `public.activities` (`Activity`) | Source of truth: Strava, Garmin, app session, wearable, manual |
| Post do feed | `activity_events` | Timeline social (kudos, comentários, For You) |
| Cache / desafios | `AppState.activityLogs` | Projeção `steps` / `football` / `run_km` para desafios e offline |

Dedup físico: unique parcial `(user_id, source, external_id)`. Adapter `activityToLogEntry()` mantém `challengeRawValue`.

Tokens OAuth continuam só em `wearable_connections` (service_role). Sync wearable faz upsert em `activities` e ainda devolve `ActivityLogEntry[]`.

## Athlete profile

`buildAthleteProfile` é puro: C360 performance + activities + streak + challenge_progress + counts do grafo.

`getAthleteProfileServer` aplica `canOpenProfile` / blocks / mutes. Payload público: sessões, streak, PRs (count), sports, consistência, proof summary. **Sem** nutrição, peso ou fotos.

C360 ganha bloco opcional `athlete?: Athlete360`. Steps **não** entram no fingerprint de decisão.

Sem activities: o perfil ainda sai de sessions + C360.

## Content OS

Programas de conteúdo **≠** `training_rules` (aba admin agora **Regras de treino**). Trilha editorial: semanas/sessões com training/nutrition/recovery **como conteúdo**, não como workout autoritativo. Sem `user_program_enrollments` nesta fase.

Extensão de `content_items` (kinds `video` / `education`, expert, collection, media, publish window, `visible`) + tabelas `experts`, `content_collections`, `programs`, `program_sessions`, `content_progress`. CMS service_role only.

Seed Soldiers-authored em `src/data/content-os-seed.ts`. Mídia expert/program no manifesto como **draft** (sem assets de terceiros).

## Recommendation de conteúdo

`src/lib/content/recommend.ts` lê `DecisionContextSnapshot` (ou um recorte) + catálogo + progress (dismissed/saved) **e** `content_dismissals` (For You). Responde só: “qual conteúdo agora?”.

Não chama `computeDecisions`. Não grava `recommendation_decisions`.

Preferências: REST / recovery low → recovery; FULL → technique; meal → nutrition; trigger de comportamento → education/motivation; senão goal/level (`matchesTarget`).

Consumidores: `habits.contentId` no Living Plan e For You (limite 2). Sem snapshot, `pickEditorialItems` continua goal/level.

## Admin

- Programas → **Regras de treino** (mesmo JSON de splits)
- Novas abas: Experts, Trilhas, Coleções
- Conteúdo: kinds novos + visibilidade / publish_at

Today / Coach sem redesign; o hábito do dia pode apontar `/conteudo/:id` como já existia.
