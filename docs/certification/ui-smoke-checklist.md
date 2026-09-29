# UI Smoke Checklist (pré-deploy)

Automação AI: `npm run ai:prod-e2e` → PASS (happy + failures; audit readback via `audit_id`).

Checklist manual das rotas críticas (operador):

| Rota | Fluxo | Status |
|------|-------|--------|
| `/entrar` | login / sessão | PENDING_OPERATOR |
| `/onboarding` | completar perfil | PENDING_OPERATOR |
| `/` (home) | carrega pós-auth | PENDING_OPERATOR |
| `/treino` | lista / abrir sessão | PENDING_OPERATOR |
| `/nutricao` | log / metas | PENDING_OPERATOR |
| `/coach` | pergunta AI (deterministic ok) | PENDING_OPERATOR |
| Sync | alterar dado → reload / 2º device | PENDING_OPERATOR |
| `/perfil` wipe/export | clearAccountData remote-first | PENDING_OPERATOR |
| `/acesso` Shopify | só com pedido de teste | OPTIONAL |

Notas:
- Sem Playwright neste ciclo; smoke UI é gate operacional humano.
- Sync parcial: cliente não ACK/`flushOutbox` em `ok=false` ou `partial=true`.
