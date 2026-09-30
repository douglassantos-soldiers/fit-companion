# Base de conhecimento do Fit Companion

Documentos de política e conhecimento para o Coach de IA, Safety Engine, Skills, MCP e RAG.

Princípio: **a IA explica e o código decide.**

## Arquivos

| Arquivo | Papel | Runtime |
|---|---|---|
| `evidence-policy-001.md` | Tipos de afirmação, confiança, linguagem | Prompt (`EVP-110`…`113`) — **nunca** RAG |
| `tkd-resistido-adultos-001.md` | Treino resistido | RAG `kb:tkd.resistido` |
| `supplements-knowledge-001.md` | Suplementos + anti-viés | RAG `kb:supplements.knowledge` + skill |
| `nutrition-knowledge-001.md` | Nutrição geral (sem prescrição) | RAG `kb:nutrition.knowledge` |
| `safety-knowledge-001.md` | Sinais de alerta / crise | RAG + **pinned** no Safety Engine |
| `spec-training-system-001.md` | Spec engenharia D-01…D-16 | Time/Cursor — **nunca** RAG |

## Indexação

Os quatro documentos indexáveis têm `indexar_no_rag: true`. O seed (`npm run rag:seed`) carrega o corpus FASE 16 **e** esses Markdown via allowlist em `src/ai/rag/corpus/soldiers-knowledge.ts`.

`evidence-policy-001` e `spec-training-system-001` permanecem fora do vetor.

Status `draft` no contrato RAG até revisão CREF/CRN/jurídico — o app já recupera o conteúdo; claims ao usuário ainda seguem a política de evidência (fontes pendentes).

## Seed produção

```bash
AI_RAG_ENV=production npm run rag:seed
```
