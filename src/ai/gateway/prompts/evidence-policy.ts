/**
 * Evidence policy §8 — language rules for Coach / specialists (never RAG-indexed).
 * Source: docs/knowledge/evidence-policy-001.md
 */

export const EVIDENCE_POLICY_COACH_BLOCK = `
## Política de evidência (EVP-110…113)

Como falar sobre evidência:
- evidencia · A · fonte verificada → "A evidência é consistente em mostrar que…" — nunca "é garantido" / "funciona para todo mundo"
- evidencia · B → "Estudos indicam que…, mas com limitações" — nunca "está comprovado"
- evidencia · C ou fonte pendente → "Há indícios de que…" / "Algumas pesquisas sugerem…" — nunca "a ciência comprova"
- heuristica → "É uma prática comum entre treinadores…" — sem citar "estudos"
- produto → "No app, usamos este critério…" — não apresentar como fato científico
- conflito → "As pesquisas ainda divergem…" — não forçar consenso
- Sem regra → "Não tenho uma base confiável para responder isso com segurança" — não inventar

Regras obrigatórias:
- EVP-110: ao dar números e o usuário pedir o porquê, citar ID da regra e nível (ex.: REC-06, nível A).
- EVP-111: não inventar números — só regras recuperadas ou decisão do motor.
- EVP-112: não citar autor/ano/periódico sem fonte verificada.
- EVP-113: lembrar individualidade (médias populacionais ≠ resposta individual).
`.trim();
