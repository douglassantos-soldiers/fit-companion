# PHASE 8.5 — Core Integrity + Test Readiness

## 1. O que foi alterado

Consolidação do “cérebro” do Soldiers Performance OS para testes reais: identidade server-side, secrets fail-closed, Customer360 DB-first, Safety date-aware, timezone do usuário, sync honesto, Decision→Outcome→Learning, Coach protegido, sem redesign de UI.

## 2. Migrations criadas

- [`supabase/migrations/20260922100000_phase85_core_integrity.sql`](../supabase/migrations/20260922100000_phase85_core_integrity.sql)
  - `customer_profiles.last_recomputed_at`, `data_version`
  - `users.timezone`, `profiles.timezone` (default `America/Sao_Paulo`)
  - `app_state.version`
  - tabela `decision_outcomes` + RLS service_role
  - `user_id` em `club_members`, `hub_members`, `activity_events`; `user_id_a/b` em `friend_quests` + backfill

## 3. Arquitetura final

```
Trusted Access Session → Domain Tables → Customer360 → Context → Safety(date)
  → Decision/Recommendation → Decision Log → Living Plan → Today
  → Action → Outcome Log → Learning → User Patterns → Next Decision
```

AppState = cache / UI / offline / drafts (não autoridade de negócio quando existe tabela de domínio).

## 4. Security changes

- `ACCESS_SESSION_SECRET` obrigatório em produção (`assertSecurityConfiguration` / `resolveAccessSessionSecret`)
- Removidos fallbacks `SHOPIFY_WEBHOOK_SECRET` e `"dev-only-change-me"` em produção
- Dev: `ALLOW_INSECURE_DEV_SECRETS=true` ou Vitest/test
- Entitlements client: `fetchEntitlement` / `upsertEntitlement` neutralizados
- Leituras sensíveis: `requireAccessIfLinked` em pull/C360/patterns/decisions/events

## 5. Identity changes

- `trackUserEvent`: `userId` do client ignorado; usar `resolvedUserId`
- Taxonomia em `src/lib/events/taxonomy.ts`
- Device = provenance; User = identidade canônica

## 6. Customer360 changes

- Persistência **sem** override de AppState do client
- `previewCustomer360FromState()` puro (não persiste)
- Freshness: `last_recomputed_at` / `data_version` / `isCustomer360Stale`
- Nutrição: logging completeness ≠ adherence + confidence

## 7. Recommendation changes

- `decisionsFromBundle` + `AuthoritativeDecisionType` (REST, REDUCE_VOLUME, EXPRESS, FULL, DELOAD, …)
- Living Plan continua consumindo `computeDecisions` (volume/mode alinhados)
- `rankRecommendations` anexa `decisionType`

## 8. Decision / Outcome

- Mantém `recommendation_decisions`
- Dual-write para `decision_outcomes`
- Learning: `patternKeyFromEvaluation` com chaves estáveis

## 9. Coach changes

- `buildCoachContext(userId)` server-side
- Rate limit configurável `COACH_RPM` / `COACH_RPD` + 429
- Usage log estruturado; system prompt só no server
- Client context ignorado

## 10. Sync changes

- Push: `ok: false` + `errors[]` se writes críticos falham
- `app_state.version` com conflito
- `clearRemoteState` = noop semântico (não wipe parcial sob rótulo “aparelho”)
- `clearUserDataServer` / UI “Apagar dados da conta no servidor”
- Reset do aparelho = só local

## 11. Timezone

- `getUserTodayKey` / default `America/Sao_Paulo`
- `todayKey()` usa timezone BR (não UTC raw)
- `Profile.timezone` opcional

## 12. Social changes

- Escritas stampam `user_id`
- Migration progressive + policies públicas revisadas (feed)

## 13. Test scenarios

- `src/lib/qa/scenarios.ts` + `ENABLE_QA_MODE`
- Cenários: healthy, low sleep, RPE, short time, no equipment, load, nutrition incomplete/strong, rest, deload

## 14. Tests executados

- `npm test` → **154 passed** (incl. `phase85-integrity.test.ts`)

## 15. Build / typecheck / lint

- Script `typecheck` adicionado (`tsc --noEmit`)
- `npm test` → 154 passed
- `npm run build` → **sucesso** (Vite client + server)
- Projeto já tinha erros `exactOptionalPropertyTypes` pré-existentes; corrigidos os introduzidos nesta fase
- Lint: executar `npm run lint` localmente; avisos deprecados `inputValidator` do TanStack não bloqueiam

## 16. Known limitations

- Rate limit coach é in-memory (por processo)
- `decision_outcomes` exige migration aplicada no remoto
- Social SELECT público ainda transitional até clientes usarem views restritas
- Timezone real do usuário ainda depende de gravar `profile.timezone` (default BR)

## 17. Remaining technical debt

- Unificar mais callers UI para `buildServerDecisionContext`
- Rate limit distribuído (Redis/Upstash)
- Tightening final de RLS de feed social
- Reduzir erros TS legado `exactOptionalPropertyTypes` no restante do app

## 18. Próximos passos

1. Aplicar migration `20260922100000_phase85_core_integrity.sql` no Supabase
2. Definir `ACCESS_SESSION_SECRET` em produção
3. Smoke manual: onboarding → Today → treino → meal → coach → reset local vs clear conta
4. Testes reais de produto com QA mode em staging (`ENABLE_QA_MODE=true`)
