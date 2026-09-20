# Checklist de cobertura (catálogo)

Só **nomes, grupo muscular e equipamento**. Sem GIFs, stills, instruções ou URLs de terceiros.

Permitido (ver `content/soldiers-media-v1/legal-policy.json`):
- nomes de exercícios e cobertura de catálogo
- rótulos de equipamento e grupo

Proibido:
- OpenGym / Gym Visual / Unsplash como frame ou mídia
- copiar `exercises-data.js` ou o git AGPL para dentro do app
- inflar o planner com ~1324 linhas

Arquivos:
- `soldiers-lote1.json` — snapshot da library Soldiers (lote 1)
- `taxonomy-gaps-v1.json` — backlog autoral de famílias para lotes 2+
- `import/` — dump local opcional (gitignored). Use `--from` no script.

```
npm run catalog:coverage
node scripts/exercise-catalog/coverage-diff.mjs --from content/exercise-catalog/import/names.json
```
