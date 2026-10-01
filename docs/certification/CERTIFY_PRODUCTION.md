# Certificação production (pós gate:operator)

Só rode isto **depois** de `npm run gate:operator` com exit **0** e o site republicado no mesmo SHA.

## Pré-condições

1. `docs/certification/operator-gate-evidence.json` → todos os checks blocking em `pass` (wearables pode ser `deferred_beta`).
2. `head` no evidence === `git rev-parse HEAD` === SHA do deploy publicado.
3. `docs/certification/operator-live-proofs.json` preenchido para wipe, backup, shopify/cron, leaked-password (e overrides opcionais).
4. Cache de `users.status` (TTL 60s) já no código publicado — medir chamadas/dia no painel Supabase antes/depois.

## Comandos

```bash
# Confirmar gate
npm run gate:operator
# expect: ALL PASS / exit 0

# Pré-check: evidence head === git HEAD e todos os checks blocking em pass
npm run cert:assert-ready

# Certificação AI / production (usa environment do runner)
npm run ai:certification:final
```

## Critério de pronto

| Campo em `docs/certification/latest.json` | Valor esperado |
|------------------------------------------|----------------|
| `production_ready` | `true` |
| `environment` | `production` |
| `commit_sha` | igual ao SHA publicado |

Se qualquer prova live faltar, **não** force `production_ready: true` — o gate deve continuar exit 3.
