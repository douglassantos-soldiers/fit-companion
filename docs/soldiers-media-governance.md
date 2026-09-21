# Soldiers Media Governance

A Fase 6 fecha o contrato de produção de mídia: **catalog → media package → QA → published**. Não gera 800 assets.

Learning e Coach **não** são fonte de mídia. O resolver é determinístico.

## Pipeline

```
EXERCISE.catalog.mediaId
        ↓
MediaPackage (soldiers_media + manifesto)
        ↓
QA (draft → generated → qa → approved)
        ↓
published Soldiers media
        ↓
APP (Today / Treino / Session / Coach tools)
```

Lacunas de produção:

1. Package Soldiers `published` (variant `default`, region `global`)
2. CMS override **autorizado** e **Soldiers-owned** — só se o package published não existir
3. Legacy (`catalog.media_url` / `video_url`) **somente** com `VITE_MEDIA_LEGACY_FALLBACK=1`
4. Senão `source: none` (UI cai no MuscleArt)

Uma URL externa **nunca** vira `source: "soldiers"` nem `ownership: "owned"`.

## Package

Campos canónicos em `soldiers_media` / `SoldiersMediaAsset`:

- `kind` (alias `entityType`), `entityId`, `version`, `style`
- `variant` (A/B, default `default`), `region` (default `global`)
- `ownership`, `license` (`soldiers-owned`)
- `status`: draft | generated | qa | approved | published | rejected | archived
- poster / thumbnail / webm / mp4 / gif / duration / animationSpec / prompt / qaNotes
- `checksums` sha256 por asset
- `pending` no parser e na migration vira `draft`

Publicar exige poster, thumb, motion se `needsMotion`, license Soldiers, zero URLs externas.

## Fontes

| Fonte                            | Papel                                                                  |
| -------------------------------- | ---------------------------------------------------------------------- |
| `soldiers_media`                 | Autoridade persistida                                                  |
| manifesto + `/soldiers-media/v1` | Pacotes locais / piloto                                                |
| `cms_overrides.authorized`       | Exceção explícita, nunca vence published                               |
| `catalog_exercises.media_id`     | Vínculo com o package (`kind=exercise`)                                |
| `catalog.media_status`           | Projeção (`missing\|poster\|motion\|published`) — o resolve **não** lê |

## Admin

A aba Mídia opera o workflow de status e o toggle de autorização CMS. Deploy (`media:deploy`) grava `generated` e **não** faz downgrade de `published`.

## Scripts

- `npm run media:validate` — contrato + relatório (exit 1 se falhar)
- `npm run media:coverage` — total exercises, complete, poster/thumb/motion missing, qa pending, published, rejected, legacy, external URLs
- `npm run media:queue` — gera `content/soldiers-media-v1/queues/motion-backlog-v1.json` (240 ids − piloto, 6 batches × ~40)
- `npm run media:prompts -- --batch N` — prompts do lote N (ou piloto sem flag)
- `npm run media:compress` — poster/thumb webp sob budget
- `npm run media:motion -- --batch N` — xfade/hold a partir de stills Soldiers (requer `poster` + `pose-end`, ou só poster se hold)
- `npm run media:promote -- --batch N` — promove a published só se o pacote estiver completo; atualiza `published-exercises.json` + `soldiers-media-published-ids.ts`
- `npm run media:deploy` — sobe packages gerados (não faz downgrade de published)

### Operação dos 240 (lotes 1–6)

1. `npm run media:queue` (uma vez / quando a library mudar)
2. `npm run media:prompts -- --batch N`
3. Depositar stills owned em `public/soldiers-media/v1/exercise/{id}/` (`poster` + `pose-end`; hold só `poster`)
4. `npm run media:compress`
5. `npm run media:motion -- --batch N`
6. `npm run media:validate` && `npm run media:coverage`
7. `npm run media:promote -- --batch N` (+ `media:deploy` se remoto)

Sem stills Soldiers não há motion válido. Sem OpenGym / Ken Burns / Unsplash.

## Compatibility

- 10 exercícios piloto começam em `PUBLISHED_EXERCISE_IDS`; promote amplia a lista sem hardcode só do piloto
- CMS drafts não autorizados permanecem no Admin e saem da produção
- RLS: SELECT público só `published`; writes `service_role`
