# Identity + Customer 360 — Soldiers Training

## Visão geral

O Soldiers Training evoluiu de identidade baseada em `device_id` (localStorage) para:

```
SHOPIFY → Identity Engine → User → Customer 360 → Engines → Context → Learning → Coach → Hoje → Events → …
```

Shopify é **uma fonte** de dados (commerce), não o centro da aplicação.

## Identidade

| Entidade | Tabela | Papel |
|----------|--------|--------|
| User | `public.users` | Identidade canônica do app (≠ `auth.users`) |
| Device | `public.devices` | Aparelho vinculado a um user |
| Customer Identity | `public.customer_identities` | Providers externos (`shopify`, futuro: Apple, Strava…) |

- `device_id` continua existindo nas tabelas legadas para compatibilidade.
- Colunas `user_id` foram adicionadas e backfilladas.
- Ao verificar e-mail Shopify, o device é re-linkado ao user do e-mail (`linkDeviceToShopifyUser`).

## Segurança de acesso

`establishAccessSession` **não confia** em `accessTier` / `orderCount` / `productIds` do client.

Fluxo:

1. Client envia `email` + `deviceId`
2. Servidor chama `resolveAccessProfileForEmail` (entitlement row + Admin API paginada)
3. Cookie e `app_entitlements` usam o tier recalculado no servidor

## Commerce

- `orders` + `order_items` — entidades transacionais (`UNIQUE shopify_order_id`)
- Webhooks: `customers/*`, `orders/*`, `refunds/create` com HMAC + idempotência (`shopify_webhook_events`)
- Paginação Admin API via `Link: rel="next"` — **até 20 páginas / 1000 pedidos por run**; sync completo = loops até `hasMore=false` (cursor em `shopify_sync_cursors`)
- `orders.raw_snapshot` = único raw Shopify; restock derivado vive em `customer_profiles.restock_estimates` (não re-gravar no entitlement snapshot)

## Customer 360

Camada de agregação em `src/lib/customer360/` + tabela derivada `customer_profiles`.

**Recompute é DB-first:** `hydrateAppStateFromDb(userId)` monta `AppState` a partir de `profiles`, `sessions`, `meal_entries`, `weights`, `daily_metrics`, `supplement_logs`, `app_state` — **sem** fallback `emptyState` que zerava performance/nutrition.

Callers (webhook, access, refund, store) podem chamar `recomputeCustomerProfile(userId)` sem enviar AppState.

| Campo | Origem |
|-------|--------|
| commerce | `orders` / `order_items` (`loadCommerce360`) |
| performance / nutrition / recovery / behavior | aggregators sobre state hidratado |
| `shopifyCustomerId` | `customer_identities` (provider `shopify`) |
| `lineage` + `estimates` | gravados em `metrics` JSON; LTV/next purchase/restock têm `kind: "estimate"` |

**Objetivos NÃO vêm de produtos Shopify.** Produtos são sinal commerce; goal vem de onboarding/perfil.

## Events

`user_events` é a tabela canônica. `trackUserEvent` / `trackAppUserEvent` / `emitUserEvent` gravam ali (+ espelho legado em `engagement_events`).

### FASE 3 — Event Layer + Multi-Device Sync

Pipeline:

```
USER ACTION → EVENT (outbox) → DATABASE (user_events) → CUSTOMER 360 (domain) → CONTEXT → LEARNING
```

**Contrato do evento:** `id` (`event_id`), `user_id`, `device_id?`, `event_type`, `occurred_at`, `source`, `entity_type`, `entity_id`, `metadata` (+ `payload` espelho legado), `created_at`.

**Regras:**

1. `user_id` obrigatório quando autenticado/resolvido — nunca confiar no client.
2. `device_id` é canal/metadata.
3. Ingestão via `trackAppUserEvent` → `resolveTrustedIdentity`.
4. Idempotência via `idempotency_key` (workouts, meals, check-ins, purchase/refund).
5. Metadata sanitizada (sem e-mail/token/secrets).
6. `occurred_at` = quando a ação aconteceu.

**Eventos canônicos:**

| Evento | Entity |
|--------|--------|
| `workout_started` / `completed` / `skipped` / `modified` | workout |
| `meal_logged` / `updated` / `deleted` | meal |
| `weight_logged` | weight |
| `checkin_completed` | day_checkin |
| `supplement_taken` / `skipped` | supplement |
| `challenge_joined` / `completed` | challenge |
| `coach_interaction` | coach |
| `plan_viewed` / `plan_modified` | plan |
| `product_viewed` / `clicked` | product |
| `restock_shown` / `restock_clicked` | product |
| `purchase` / `refund` | order |

Aliases legados normalizados: `restock_cta_click`→`restock_clicked`, `checkin_sleep`→`checkin_completed`, `challenge_join`/`challenge_started`→`challenge_joined`.

### Offline outbox

Device = cache + queue (`localStorage` `soldiers-outbox-v1`).

```
offline → enqueue → online/visibility → flush → trackAppUserEvent / upsertDayCheckIn → ack
```

Flush no boot do `StoreProvider`, `window.online`, após `pushState`.

### Sync multi-device

- Snapshot `pushState` permanece (compat).
- Dual-write `day_checkins` + version em `sessions` / `meal_entries` / `profiles` / `day_checkins`.
- Conflitos: `version` + `updated_at` (sem LWW cego); rejeita write mais antigo.

### Day check-in estruturado

Tabela `day_checkins`: sleep, energy, soreness, stress, available_time, equipment, notes, version.

Histórico ordenado alimenta Learning (`recentDayCheckIns`) e Customer 360 recovery.

Migração: `supabase/migrations/20260920150000_fase3_events_sync.sql`.

## Context / Learning / Score

- **Context Engine** (`src/lib/engine/context.ts`): sinais do dia + `why[]` (também mesclado no Living Plan)
- **Learning**: regras + `extractUserPatterns` → persistido em `user_patterns` no boot (best-effort)
- **Performance score** = média(força, resistência, consistência, recuperação, sono) — **sem** suplementação
- **Adherence score** = média(nutrição, suplementação, hábitos)
- Suplementação sem piso artificial `|| 40`
- Restock `confidence` sobe com dias de log de consumo (`enrichRestockConfidence`)

### FASE 4 — Context Engine + Decision Engine

Pipeline:

```
CUSTOMER 360 + HISTORY + CHECK-IN + GOAL + ENVIRONMENT + COMMERCE
  → ContextSnapshot (reasonSeeds)
  → Safety
  → Decision Engine (structured decisions)
  → Living Plan / Recommendation
  → AI Coach (explica) / UI (executa)
```

**Regra:** Engines calculam → Decision Engine decide → AI explica → UI executa. Sem LLM em regras determinísticas (volume, kcal, mode, stims).

**Context Snapshot** (`src/lib/engine/context-snapshot.ts`): goal, training, nutrition, recovery, sleep, energy, adherence, workload, time, equipment, patterns, supplements, commerce, travel, reasonSeeds, confidenceBase.

**Reason codes** (`src/lib/engine/reason-codes.ts`): `sleep_low`, `sleep_good`, `energy_low`, `energy_high`, `rpe_high`, `recovery_low`, `protein_low`, `weight_trend_down`, `time_limited`, `travel`, `equipment_limited`, `adherence_drop`, `stim_restriction`, `deload_week`, `restock_risk`.

**Decision types:** `training_mode`, `training_volume`, `session_duration`, `nutrition_calorie_delta`, `nutrition_protein_bias`, `meal_distribution`, `block_stims`, `primary_action` — cada uma com `reason_codes`, `confidence`, `explanation` (via `explainWhy`, sem LLM).

**Decision log:** tabela `recommendation_decisions` (`user_id`, `date`, `engine`, `decision_type`, `decision_value`, `reason_codes`, `input_snapshot`, `confidence`, `outcome`, `outcome_metrics`, `created_at`). Escrita best-effort após check-in/refresh; outcome via `living_plan_followed` / `skipped` / `session_completed`. Rewrite diário **preserva** `outcome` + `outcome_metrics`.

Arquivos: `context-snapshot.ts`, `reason-codes.ts`, `decision.ts`, `explain.ts`, `decision-log.server.ts`, `decision.functions.ts`.

### FASE 5 — Recovery Engine v2 + Learning Loop

Ciclo: **observation → decision → action → outcome → learning** (sem ML, sem wearables inventados).

```
Check-in + Sessions
  → RecoveryV2 (recovered | moderate | low)
  → LearnedPatterns (candidate → active)
  → ContextSnapshot (recovery.level + activePatterns)
  → Safety / Decision
  → Ação (treino / skip)
  → Outcome (session_completed + metrics; check-in D+1)
  → Pattern success/fail (volume_reduction_helps, prefers_short_sessions, …)
```

**Recovery v2** (`src/lib/engine/recovery-v2.ts`):

- Sinais **manuais** only: sono, consistência de sono (stddev 7d), energia, dor, estresse, carga RPE, frequência, frescor muscular.
- `wearable.hrv` / `restingHr` / `source` = **sempre null** nesta fase; explanation deixa isso explícito.
- Levels: `recovered` (score≥70 sem fadiga), `moderate` (50–69), `low` (<50 ou sleep&lt;6 / energia baixa / soreness≥4 / hard streak≥2).
- Wire: C360 `Recovery360.level`, Context Snapshot, Safety `under_recovery`, Decision bias deload.

**Learned patterns** (`src/lib/engine/learned-patterns.ts`):

- Kinds allowlisted: `weekday_skip`, `avoids_long_workouts`, `weekend_protein_drop`, `sunday_meal_gap`, `prefers_short_sessions`, `poor_sleep_after_late_train`, `volume_reduction_helps`.
- Status `candidate` até `evidenceCount >= minObservations` e confidence≥0.55 → `active`; decay 30d.
- Blob `user_patterns.patterns`: `{ version: 2, legacy: UserPatterns, patterns: LearnedPattern[] }` (load legado migra no read).
- Guardrails (`learning-guardrails.ts`): deny clínico; Learning **não** sobrescreve Safety (`blockStims`, volume↑ com recovery low).

**Outcome loop:**

| Evento | Efeito |
|--------|--------|
| `addSession` | `session_completed` + `outcome_metrics` (rpe, duration, volumeFactor); bump `prefers_short` se &lt;45min |
| Check-in D+1 | anexa `nextDayEnergy`/`nextDaySleep` às decisões de ontem; avalia `volume_reduction_helps` |
| Rewrite diário | re-lê outcomes antes do delete+insert |

**Exemplos:**

1. Sono baixo → Recovery `low` → volume 0.7 → treino ok → energia D+1 alta → `volume_reduction_helps` success++
2. Muitas sessões &lt;45min → `prefers_short_sessions` active → Decision express (bias leve; Safety manda)
3. Quinta fraca → `weekday_skip` candidate→active após evidências suficientes

Arquivos: `recovery-v2.ts`, `learned-patterns.ts`, `learning-guardrails.ts`, `outcome-learning.ts`, migração `20260920170000_fase5_learning_outcomes.sql`.

## Sync

- Domain sync is **server-authoritative** (`sync.functions.ts` → service_role).
- Ownership key = **`user_id`**. `device_id` is canal (last writer provenance).
- Push requires access cookie (`requireAccess`).
- Pull prefers `.eq("user_id")` with legacy device merge fallback.
- Multi-device: all devices of a user share the same domain rows.

## Session

- Cookie `soldiers_access` always includes `userId` after `establishAccessSession`.
- `resolveTrustedIdentity` is session-first; never trusts client `userId`.

## Safety / Recommendation

- **Safety Engine** (`engine/safety.ts`): sleep/energy/RPE guards → Living Plan + stim filter; FASE 6 adiciona `escalateCare` para sinais potencialmente graves (notas/keywords, dor/estresse extremos) — **não** tratar como adaptação de volume e **não** diagnosticar.
- **Recommendation Engine** (`engine/recommendation.ts`): ranks next actions for Hoje.
- **Outcome helpers** (`outcome.ts`): learning-loop event names.

### FASE 6 — Living Plan + AI Coach 2.0

Experiência diária centrada em **HOJE** (“O que eu faço hoje?”). Engines continuam determinísticos; a IA só explica.

```
request → authenticated user → hydrate DB / Customer 360
  → Context Engine → Safety Engine → Decision → Living Plan
  → Coach context (server) → LLM
```

**HOJE / Living Plan**

- Estado: performance + semáforos training / nutrition / recovery / **consistency**
- Ações: treino, alimentação, suplementação, recuperação, **hábitos**
- Why: `why[]` + `whyByChange[]` (treino, kcal, proteína, stims, recuperação)
- Uma ação primária no hero (Recommendation top-1), sem CTA duplicado
- Plano reativo a check-in, RPE, tempo, equipamento, recovery, padrões

**AI Coach 2.0**

- `askAiCoach` **não** aceita contexto crítico do client (`context` ignorado)
- Monta prompt no servidor: `resolveTrustedIdentity` → `hydrateAppStateFromDb` → Safety/Decision/Living Plan → `buildCoachContextFromState`
- Respostas podem incluir `structured` (`why` | `today` | `general`) com decisões + safetyNotice
- Fallback local: `coachReply` / `coachFreeform` (inclui Why de treino/kcal/descanso/proteína)

Arquivos: `coach.functions.ts`, `coach-contract.ts`, `engine/coach-context.ts`, `engine/coach.ts`, `components/today/living-plan-hero.tsx`.

### FASE 7 — Nutrition Intelligence + Supplement Intelligence

Alimentação e suplementação contextuais; compra ≠ consumo.

**Nutrition Intelligence**

- `Profile.nutritionProfile` + `skipBreakfast` / `lunchOutOften` persistidos em `profiles.prefs` JSONB
- Slots ativos flexíveis (`activeMealSlots`) — não força café da manhã
- `buildDailyMealPlan` omite slots desabilitados e **redistribui** porções sugeridas
- Meal AI (texto / foto / voz) com provenance: `sourceKind` informed|estimated + `confidence` + correção do usuário
- Sync: campos no `meal_entries.payload`

**Supplement Intelligence**

```
purchase (orders) → product map → package size → dose log → frequency → consumption → estimated inventory → soft replenishment
```

- Tabela `supplement_dose_logs` (product, dose, unit, frequency, taken_at)
- Inventário estimado: depleção por doses (`engine/supplement-inventory.ts`); confidence sobe com logs
- Commerce: “Seu estoque estimado está chegando ao fim.” + confiança — sem “COMPRE AGORA”
- Recs de produto só para itens já comprados / na rotina, com reasons transparentes

Arquivos: `engine/nutrition.ts`, `engine/nutrition-profile.ts`, `engine/supplement-inventory.ts`, `meal-picker-sheet.tsx`, `suplementos.tsx`, migration `20260920180000_fase7_nutrition_supplement_intelligence.sql`.

## Migration

`supabase/migrations/20260919000000_identity_customer360.sql` — não destrutiva.
`supabase/migrations/20260919120000_harden_domain_rls.sql` — domain/social writes service_role only.
`supabase/migrations/20260919120100_session_rpe_express.sql` — rpe/express on sessions.
`supabase/migrations/20260919130000_user_owned_domain.sql` — UNIQUE por user_id + RLS authenticated ownership.
`supabase/migrations/20260919140000_customer360_lineage.sql` — `shopify_customer_id` + `supplement_adherence` em `customer_profiles` (métricas/lineage também em `metrics` JSON).
`supabase/migrations/20260920150000_fase3_events_sync.sql` — Event Layer (`entity_type`/`metadata`), `day_checkins`, `version` em entidades.
`supabase/migrations/20260920160000_fase4_recommendation_decisions.sql` — Decision log (`recommendation_decisions`).
`supabase/migrations/20260920170000_fase5_learning_outcomes.sql` — `outcome_metrics` JSONB no decision log.
`supabase/migrations/20260920180000_fase7_nutrition_supplement_intelligence.sql` — `profiles.prefs`, `supplement_dose_logs`.

Aplicar com `supabase db push` (conta com privilégio no projeto `zphtvrsxlhfgltwgbreu`) ou SQL Editor no dashboard.


## Arquivos-chave

- `src/lib/identity/` — Identity Engine
- `src/lib/customer360/` — aggregators + hydrate + recompute
- `src/lib/customer360/hydrate.server.ts` — AppState from DB
- `src/lib/events/` — types, normalize, track, emit
- `src/lib/engine/context-snapshot.ts` — Context Snapshot
- `src/lib/engine/decision.ts` — Decision Engine
- `src/lib/engine/reason-codes.ts` — reason codes
- `src/lib/engine/explain.ts` — WHY determinístico
- `src/lib/engine/recovery-v2.ts` — Recovery Engine v2
- `src/lib/engine/learned-patterns.ts` — Learning patterns tipados
- `src/lib/engine/learning-guardrails.ts` — guardrails de learning
- `src/lib/engine/outcome-learning.ts` — avaliação success/fail
- `src/lib/sync/outbox.ts` — fila offline
- `src/lib/sync/conflict.ts` — versionamento
- `src/lib/sync/day-checkin.ts` — mapeamento day_checkins
- `src/lib/shopify-orders.server.ts` — paginação
- `src/lib/orders.server.ts` — persistência de pedidos
- `src/lib/engine/context.ts` — Context Engine
- `src/lib/engine/safety.ts` — Safety Engine (+ escalateCare FASE 6)
- `src/lib/engine/living-plan.ts` — Living Plan
- `src/lib/engine/nutrition.ts` — Nutrition Intelligence (FASE 7)
- `src/lib/engine/supplement-inventory.ts` — inventário estimado (FASE 7)
- `src/lib/coach.functions.ts` — AI Coach 2.0 (server context)
- `src/routes/api/shopify.webhook.ts` — webhooks multi-topic
