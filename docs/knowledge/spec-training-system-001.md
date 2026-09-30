---
doc_id: spec-training-system-001
titulo: Fit Companion — Especificação do Sistema de Treino
versao: 1.0.0
data: 2026-09-29
idioma: pt-BR
base_de_conhecimento: TKD tkd-resistido-adultos-001 v1.1.0
substitui: rascunho "TKD v1.2" (arquitetura)
repositorio_auditado: Lovable 47f1291e (HEAD d81143e)
status: base para implementação — revisão técnica (CREF) e jurídica pendentes
indexar_no_rag: false
---

# Fit Companion — Especificação do Sistema de Treino v1.0

## 0. Como usar este documento

### 0.1 O que ele é
- É a **especificação de engenharia** do sistema de decisão de treino do Fit Companion.
- Traduz a TKD v1.1 (conhecimento) em regras executáveis, contratos e plano de implementação, **ancorados no código que já existe**.
- Substitui o rascunho "TKD v1.2". Aquele conteúdo era arquitetura, não conhecimento, e duplicava módulos já existentes.

### 0.2 O que ele NÃO é
- **Não deve ser indexado no RAG** (`indexar_no_rag: false`). O RAG indexa apenas a TKD.
- Não é fonte de evidência científica. Números aqui são parâmetros de produto, cada um com tipo e confiança declarados.
- Não autoriza criar um segundo Decision Engine, novas tabelas paralelas ou agentes LLM que decidam.

### 0.3 Convenções
| Marcação | Significado |
|---|---|
| **DEVE** / **NÃO DEVE** | Obrigatório. Violação bloqueia release. |
| **DEVERIA** | Recomendado; desvio precisa de justificativa registrada. |
| `[EXISTE]` | Já implementado no repositório; manter. |
| `[AJUSTAR]` | Existe, mas diverge desta especificação; corrigir. |
| `[NOVO]` | Não existe; implementar. |
| `[ADIADO]` | Fora do MVP; não implementar agora. |
| `(confirmar)` | Não verificado linha a linha nesta auditoria. |

**IDs:** regras usam o padrão da TKD v1.1 (`DEC-020`, `APP-04`, `REG-01`, `S1`). Regras novas criadas aqui usam `APP-08` em diante e **DEVEM** ser copiadas para a Seção 17 da TKD na versão 1.2.0, para que RAG, logs e código citem os mesmos IDs. Divergências código × TKD usam `D-01`… Parâmetros numéricos usam `PARAM-01`….

---

## 1. Princípios invioláveis

1. **Só o Decision Engine emite `Decision`.** Agentes e o Coach emitem no máximo `DecisionProposal`, que passa por `parse → validateContext → validateSafety → resolveAgainstEngine` `[EXISTE]`.
2. **O LLM explica; não decide.** Carga, séries, deload, retorno, bloqueio e encaminhamento são calculados em código. O Coach narra a decisão e não altera parâmetros.
3. **Segurança roda antes de tudo** e seu resultado é estruturado, nunca só texto.
4. **Dados comerciais nunca entram no cálculo de treino.** O Decision Engine não lê compras, estoque ou catálogo.
5. **Um número só entra no motor com tipo e confiança declarados** (`evidencia` | `heuristica` | `produto`; A | B | C). Heurística e parâmetro de produto nunca são apresentados ao usuário como "comprovado".
6. **Sem dado crítico, não improvisar:** perguntar (`DEC-003`) ou aplicar o cenário conservador declarado.
7. **Uma fonte de verdade por conceito:** limiares em `decision-thresholds.ts`, reason codes em `reason-codes.ts`, regras em `decision.ts` e `training/progression.ts`. Nada de redeclarar `6`, `40` ou `2,5` em outros módulos.

---

## 2. Hierarquia única de decisão

Esta é a **única** ordem válida. Ela substitui as três hierarquias divergentes do rascunho v1.2 e estende a TKD v1.1 (Seção 2) sem contradizê-la.

| Nível | Critério | Exemplos |
|---|---|---|
| 1 | **Segurança** | Sinais de alerta, emergência, dor articular aguda |
| 2 | **Escopo** | Idade < 18, gestação sem liberação, substâncias, diagnóstico |
| 3 | **Restrição dura** | Restrições declaradas, readiness `RED`, equipamento ausente, tempo disponível |
| 4 | **Aderência** | Taxa de conclusão, fricção, duração tolerada |
| 5 | **Objetivo** | Hipertrofia, força, recomposição, saúde |
| 6 | **Eficiência** | Ordem, supersets, densidade |
| 7 | **Preferência** | Exercícios preferidos ou evitados |

Regras de aplicação:
- Um nível superior **sempre** vence um inferior. Exemplo: preferência por agachamento (7) + dor aguda no joelho (1) → o exercício sai.
- Readiness `RED` é **restrição dura** (3): bloqueia progressão (5) mesmo que o critério de progressão tenha sido atingido.
- **Contexto comercial não é critério de decisão** e não aparece nesta tabela.
- Todo conflito resolvido **DEVE** gerar registro em log com `rule_a`, `rule_b`, `vencedora` e `nivel` (Seção 11.3).

---

## 3. Mapa de componentes (proposta v1.2 → código real)

| Componente | Módulo no repositório | Status | Observação |
|---|---|---|---|
| Estado do usuário (User State) | `src/lib/engine/context-snapshot.ts` (Context Engine) | `[EXISTE]` (confirmar) | Não criar `user_training_states`; estender o snapshot existente |
| Safety Engine | `src/lib/engine/safety.ts` (`evaluateSafetyForDate`) | `[AJUSTAR]` | Ver D-09 a D-13 e Seção 5 |
| Decision Engine | `src/lib/engine/decision.ts` (`computeDecisions`) | `[EXISTE]` | Autoridade única |
| Contrato de decisão | `src/lib/engine/decision-contract.ts` | `[AJUSTAR]` | Adicionar campos da Seção 9.1 |
| Proveniência | `src/lib/engine/decision-evidence.ts` | `[EXISTE]` | `metrics` + `items` |
| Proposta de agente | `src/lib/engine/decision-proposal.ts` | `[EXISTE]` | Manter pipeline |
| Limiares | `src/lib/engine/decision-thresholds.ts` | `[AJUSTAR]` | Ver Seção 6.1 |
| Reason codes | `src/lib/engine/reason-codes.ts` | `[AJUSTAR]` | Ver D-12 |
| Progressão | `src/lib/training/progression.ts` (`decideProgression`, `weekModifier`) | `[AJUSTAR]` | Ver D-01 a D-07 |
| Readiness / recuperação | `src/lib/engine/recovery.ts` (`computeRecoverySnapshot`) | `[EXISTE]` (confirmar) | Alinhar com `APP-04` |
| Plateau | `src/lib/training/plateau.ts` | `[EXISTE]` (confirmar) | Alinhar com `DEC-022`/`DEC-023` |
| Base de exercícios | `src/data/exercises` + `content/exercise-catalog/` | `[EXISTE]` | Adicionar campos da Seção 8.3 |
| Coach | `src/lib/coach.functions.ts` (`askAiCoach` → `runCoachAgent`) | `[EXISTE]` | Contrato da Seção 10 |
| Auditoria de decisões | `logAuthoritativeDecisions`, `recommendation_decisions`, `decision_actions`, `decision_outcomes` | `[EXISTE]` (confirmar) | Não criar tabela `decisions` nova |
| Auditoria de IA | `ai_audit_events` | `[EXISTE]` | 0 linhas no remoto; exercitar |
| RAG | `ai_knowledge_sources/documents/chunks` | `[EXISTE]` (vazio) | Semear só com a TKD |
| Commercial Guard | — | `[NOVO]` | Seção 7 |
| Roteamento por idade/população | — | `[NOVO]` | Seção 5.3 |
| Learning Engine | `docs/LEARNING_ENGINE.md` | `[ADIADO]` | Só sinais; não altera decisão no MVP |
| Agentes especialistas LLM, orquestrador, MCP externo | `docs/AGENTS_ARCHITECTURE.md`, `ORCHESTRATOR.md` | `[ADIADO]` | Seção 13 |

**Regra de implementação:** nenhuma tarefa derivada desta especificação **DEVE** criar tabela, pasta ou módulo novo sem antes justificar por que o equivalente listado acima não pode ser estendido.

---

## 4. Divergências entre código e TKD (corrigir)

Estas são as diferenças encontradas entre o comportamento atual do código e as regras da TKD v1.1. Elas têm prioridade sobre qualquer funcionalidade nova, porque afetam o treino que o usuário recebe hoje.

| ID | Onde | O código faz hoje | A TKD diz | Correção | Prioridade |
|---|---|---|---|---|---|
| **D-01** | `progression.ts` — `topOfRepRange = avgReps >= minReps` | Sobe a carga quando a média de repetições atinge o **mínimo** do objetivo (`GOAL_MIN_REPS`: massa 8, gordura 12, performance 5, saúde 10). Em uma faixa 8–10, sobe ao fazer 8 | `PROG-01`/`DEC-020`/`APP-02`: subir só no **topo** da faixa | Comparar com o **máximo** da faixa prescrita (`rep_max` parseado de `baseReps`), em **todas** as séries de trabalho, não pela média | **Alta** |
| **D-02** | `progression.ts` — ramo `rpe === "facil" \|\| "ok" \|\| !rpe` | Sobe a carga mesmo **sem RPE registrado** | `APP-02` exige sessão `facil`/`ok` (ou RIR ≥ alvo) | Sem RPE e sem RIR → **manter carga** e pedir o registro | **Alta** |
| **D-03** | `progression.ts` — `+2.5` fixo e `roundLoad` | Incremento de 2,5 kg em qualquer exercício; `roundLoad` arredonda para múltiplos de 2,5 com mínimo de 2,5 kg. Um halter de 4 kg vira 5 kg só pelo arredondamento e 7,5 kg após o incremento (+87%) | `PROG-02`: 2–5% ou o menor incremento disponível | Aplicar `APP-08` (incremento por equipamento e teto percentual) | **Alta** |
| **D-04** | `progression.ts` — `HARD_STREAK_DELOAD` + `WEEK_DELOAD` | As reduções **se somam**: −10% (2 sessões difíceis) × −15% (semana de deload) = **−23,5%** de carga | Regressão de carga 5–15% (Seção 8.2); deload reduz **volume** | Nunca aplicar as duas; ver `APP-09` | **Alta** |
| **D-05** | `progression.ts` — modo `deload` | Deload = −15% de carga e −1 série | `FAD-01`: volume −40 a 60%, RIR mais alto; carga pode ser mantida | Implementar `APP-09` (deload por volume e RIR) | Média |
| **D-06** | `progression.ts` — `weekModifier` | 2 sessões `dificil` em 7 dias → semana de deload inteira | Semáforo vermelho exige queda de desempenho **e** sinais de recuperação (`APP-04`, `DEC-031`) | 2 difíceis → manter carga; deload só pelo gatilho de `APP-09` | Média |
| **D-07** | `progression.ts` — `GOAL_MIN_REPS.gordura = 12` | Objetivo "gordura" força faixas de 12+ repetições | `DEC-051`, `CTX-14`: em déficit, **manter intensidade** | Usar a faixa de hipertrofia (`APP-11`) | Média |
| **D-08** | `decision-thresholds.ts` — `TIME_LIMITED_MIN = 40` | Tempo limitado abaixo de 40 min | TKD 1.4.1 e `DEC-013`: ≤ 45 min | Decisão: **45 min** (`PARAM-02`); atualizar a constante | Baixa |
| **D-09** | `safety.ts` — `soreness >= 4 && stress >= 4` | Marca `escalate_care` e `pain_signal` (`ok: false`) | Dor muscular + estresse é **fadiga** (semáforo), não sinal médico | Tratar como readiness `RED` (Seção 6.4); `escalate_care` só para os gatilhos da Seção 5.2 | Média |
| **D-10** | `safety.ts` — `soreness >= 5` | Escala direto para cuidado profissional | `APP-05`: `soreness` mede dor muscular; primeiro perguntar tipo, local e sinais | `soreness = 5` → nível `YELLOW` + perguntas de `APP-05`; escalar conforme a resposta | Média |
| **D-11** | `safety.ts` — `ESCALATE_NOTE_RE` | Cobre dor no peito, falta de ar, desmaio, tontura forte, sangramento, convulsão | Seção 12.4 também inclui palpitação irregular, dormência progressiva, dor articular aguda com inchaço, cefaleia súbita intensa e **dor extrema com urina escura** (rabdomiólise) | Completar os padrões (Seção 5.2) | **Alta** |
| **D-12** | `reason-codes.ts` — `restock_risk` | Sinal de estoque de suplemento dentro dos reason codes do motor de performance | `COM-01`, `COM-06`; princípio 4 desta especificação | Remover dos reason codes do motor e levar para o Commercial Guard (Seção 7) | **Alta** |
| **D-13** | `safety.ts` — entrada | Avalia só check-in (`notes`, `soreness`, `stress`, `sleep`) e RPE de sessões | `DEC-002` vale para qualquer relato do usuário | Aplicar a mesma varredura às mensagens enviadas ao Coach antes da geração (confirmar se já ocorre em `runCoachAgent`) | **Alta** |
| **D-14** | Roteamento | Não há checagem de idade nem de gestação antes de gerar treino | `DEC-004`, `DEC-005`, `CTX-19` | Implementar a Seção 5.3 | **Alta** |
| **D-15** | Registro de RIR | `progression.ts` já lê `avgRir` por exercício | A TKD v1.1 (17.4) afirma que o app não coleta RIR | Confirmar se a UI coleta RIR; se sim, **RIR tem precedência sobre RPE de sessão** (`APP-02`) e a TKD 17.4 deve ser corrigida | Média |
| **D-16** | Objetivo `performance` | Mapeado para 5+ repetições; semântica ambígua | TKD diferencia força máxima e potência | Definir `performance` = **força** (`APP-11`); potência fica `[ADIADO]` | Baixa |

**Testes obrigatórios:** cada correção D-01 a D-14 **DEVE** vir com um teste unitário que falha no comportamento atual e passa no corrigido (Seção 12.2).

---
## 5. Safety Engine

### 5.1 Níveis de segurança
O `SafetyVerdict` atual tem só `ok` e `escalateCare`. Ele passa a ter um campo `level` com quatro valores. O nível intermediário "ORANGE" do rascunho v1.2 foi descartado: não havia regra que o distinguisse de `RED`.

| Nível | Quando | Ações permitidas | Ações bloqueadas |
|---|---|---|---|
| **GREEN** | Nenhum gatilho abaixo | Todas | — |
| **YELLOW** | Dor articular leve (≤ 3/10) sem piora em 24 h (`DEC-040`); `soreness = 5` com perguntas de `APP-05` pendentes; tontura leve relatada sem outros sinais | Modificar, regredir, substituir, reduzir volume | Progredir carga no padrão afetado; sugerir produto (`COM-06`) |
| **RED** | Dor articular moderada/intensa, piora progressiva ou dor noturna (`DEC-041`); dor articular aguda com inchaço; dormência ou formigamento progressivos; palpitações irregulares; dor que persiste > 1–2 semanas (`DEC-042`) | Interromper o exercício ou a sessão; substituir por movimento sem dor; recomendar avaliação profissional | Continuar o exercício doloroso; aumentar carga ou volume; diagnosticar; sugerir produto |
| **EMERGENCY** | Dor torácica; falta de ar desproporcional; desmaio ou síncope; convulsão; cefaleia súbita intensa com esforço; **dor muscular extrema com urina escura** | Interromper tudo; orientar atendimento de emergência | Qualquer geração de treino; qualquer outra mensagem do Coach; produto |

Regras:
- **APP-12 · Nível de segurança.** O Safety Engine **DEVE** retornar `level` conforme a tabela acima, avaliando **check-in e mensagens ao Coach** (D-13). O nível mais grave encontrado prevalece. _(produto · C · base: TKD 12.4, `DEC-002`, `DEC-040` a `DEC-042`)_
- Em `EMERGENCY`, a mensagem ao usuário **DEVE** ser um **texto fixo pré-aprovado**, não gerado pelo LLM.
- O Safety Engine não diagnostica. Os gatilhos são padrões de texto e respostas estruturadas, não inferência clínica.
- Fadiga (sono, estresse, dor muscular) **não** gera `RED` nem `EMERGENCY`. Ela vai para readiness (Seção 6.4). Isso corrige D-09.

### 5.2 Padrões de texto obrigatórios (D-11)
Somar aos padrões atuais de `ESCALATE_NOTE_RE`, com um nível atribuído a cada grupo:

| Grupo | Exemplos de expressões a detectar | Nível |
|---|---|---|
| Cardiorrespiratório | dor no peito, peito apertando, falta de ar, não consigo respirar | EMERGENCY |
| Neurológico agudo | desmaio, desmaiei, apaguei, convulsão, dor de cabeça súbita/muito forte no esforço | EMERGENCY |
| Rabdomiólise | urina escura, urina cor de coca/café + dor muscular forte | EMERGENCY |
| Cardíaco não agudo | palpitação, coração disparado, batimento irregular | RED |
| Neurológico progressivo | dormência, formigamento que piora, perdi força no braço/perna | RED |
| Articular agudo | estalo + dor forte, inchou, inchaço, travou, não consigo apoiar | RED |
| Sangramento | sangramento | RED |

- A lista **DEVE** viver em um único módulo versionado, com testes positivos e negativos por grupo. Exemplo de negativo: "falta de ar de tanto rir" não deveria disparar; na dúvida, o padrão dispara e o sistema pergunta.
- A varredura usa normalização de acentos e minúsculas. Não confiar apenas em `\b` com caracteres acentuados.

### 5.3 Roteamento de população e escopo (D-14)
Roda depois do nível de segurança e antes de qualquer template.

- **APP-13 · Roteamento por idade e condição.** _(produto · C · base: `DEC-001`, `DEC-004`, `DEC-005`, `CTX-17` a `CTX-19`, `APP-07`)_

| Condição | Resultado |
|---|---|
| Idade desconhecida | Perguntar (`DEC-003`). Até responder: nenhum template; apenas conteúdo educativo geral |
| Idade < 18 | `DEC-004`: sem templates adultos e sem metas corporais; orientação para treino supervisionado; sem sugestão de suplemento (`COM-05`) |
| Idade ≥ 65 | `DEC-005`: parâmetros conservadores (tratar como iniciante, RIR 3–4, progressão por reps antes de carga) |
| Gestação declarada sem liberação | Sem prescrição de intensidade; orientar liberação obstétrica (`CTX-19`) |
| Triagem de saúde positiva | `DEC-001`: encaminhar antes de prescrever intensidade |
| Pedido fora do escopo (substâncias, dieta, diagnóstico) | `DEC-060` a `DEC-063` |

### 5.4 Contrato de saída

```ts
type SafetyLevel = "GREEN" | "YELLOW" | "RED" | "EMERGENCY";

type SafetyVerdict = {
  // campos existentes — manter
  ok: boolean;                 // passa a ser: level === "GREEN" || level === "YELLOW"
  flags: SafetyFlag[];
  reasons: string[];
  blockStims: boolean;
  preferLightTraining: boolean;
  requireMedicalDisclaimer: boolean;
  escalateCare: boolean;       // passa a ser: level === "RED" || level === "EMERGENCY"
  date: string;
  // novos
  level: SafetyLevel;
  population: "adult" | "minor" | "older_adult" | "pregnant_unclear" | "unknown_age";
  allowed_actions: string[];
  blocked_actions: string[];
  required_followup: string[]; // ids de perguntas, ex.: "pain_joint_scale", "age"
  rule_ids: string[];          // ex.: ["APP-12", "DEC-041"]
  safety_rules_version: string;
};
```

---

## 6. Regras executáveis do Decision Engine

### 6.1 Parâmetros (fonte única: `decision-thresholds.ts`)
Todo número usado pelo motor **DEVE** estar nesta tabela e na constante correspondente, com o tipo declarado.

| ID | Constante | Valor | Tipo | Confiança | Base |
|---|---|---|---|---|---|
| PARAM-01 | `SLEEP_LOW_HOURS` | 6 h | produto | C | TKD `REC-05` (referência ≥ 7 h) |
| PARAM-02 | `TIME_LIMITED_MIN` | **45 min** (hoje 40 — D-08) | produto | C | TKD 1.4.1, `DEC-013` |
| PARAM-03 | `SLEEP_GOOD_HOURS` | 7 h | evidência | A | S22 |
| PARAM-04 | `SLEEP_VERY_LOW_HOURS` | 5,5 h | produto | C | — |
| PARAM-05 | `STRESS_HIGH` | ≥ 4 (escala 1–5) | produto | C | `APP-04` |
| PARAM-06 | `SORENESS_HIGH` | ≥ 4 (escala 1–5) | produto | C | `APP-04` |
| PARAM-07 | `LOAD_STEP_PCT` | 2,5% | heurística | B | `PROG-02`, S1 |
| PARAM-08 | `MAX_SINGLE_STEP_PCT` | 10% | heurística | B | `PROG-02` (ACSM 2–10%), S1 |
| PARAM-09 | `LOAD_INCREMENT_BY_EQUIPMENT` | barra 2,5 kg · halter 2 kg · máquina/cabo 2,5 kg · kettlebell 4 kg · peso corporal → repetições | produto | C | Ajustável por exercício (Seção 8.3) |
| PARAM-10 | `LOAD_REDUCTION_PCT` | 5% (arredondar para baixo no incremento do equipamento) | heurística | C | `DEC-021` (5–10%) |
| PARAM-11 | `DELOAD_VOLUME_CUT` | 40% das séries | heurística | C | `FAD-01` (40–60%), S16 |
| PARAM-12 | `DELOAD_RIR_MIN` | 3 | heurística | C | `FAD-01` |
| PARAM-13 | `DELOAD_DAYS` | 7 | heurística | C | `FAD-01`, S16 |
| PARAM-14 | `PLANNED_DELOAD_WEEKS` | 6 semanas de bloco | heurística | C | `FAD-01` (4–8), S16 |
| PARAM-15 | `DELOAD_COOLDOWN_DAYS` | 21 | produto | C | — |
| PARAM-16 | `BREAK_MIN_DAYS` | 14 | produto | C | TKD 1.4.1, `REG-01` |
| PARAM-17 | `REP_EXTENSION` | +2 repetições acima do topo da faixa | produto | C | `PROG-03`, S34 |

Mudar qualquer valor desta tabela **DEVE** incrementar `PARAMS_VERSION` e rodar a suíte de testes da Seção 12.

### 6.2 Progressão por exercício (substitui a lógica atual de `decideProgression`)
Avaliar **em ordem**; a primeira condição verdadeira define a decisão.

```text
ENTRADA (por exercício, última sessão):
  series_trabalho[]: { reps, carga_kg, rir? }
  faixa: rep_min, rep_max            ← parseada de baseReps (ex.: "8-10")
  rir_alvo                           ← da prescrição (APP-11)
  rpe_sessao ∈ {facil, ok, dificil, null}
  safety_level, readiness_level, dor_no_padrao (bool)

1. safety_level ∈ {RED, EMERGENCY}            → sem decisão de progressão (Safety decide)
2. dor_no_padrao                              → REGREDIR: −1 incremento ou variação sem dor (DEC-040, EX-05)
3. readiness_level = RED                      → MANTER (ou deload se APP-09 disparar)
4. alguma série abaixo de rep_min:
     1ª ou 2ª sessão seguida                  → MANTER carga e prescrição (DEC-021)
     3ª sessão seguida                        → REDUZIR PARAM-10 (DEC-021)
5. há RIR registrado nas séries (D-15):
     todas reps ≥ rep_max E min(rir) ≥ rir_alvo → PROGREDIR (APP-08)
     caso contrário                           → MANTER, buscar +1 repetição
6. sem RIR, usar rpe_sessao:
     todas reps ≥ rep_max E rpe ∈ {facil, ok}  → PROGREDIR (APP-08)
     rpe = dificil                            → MANTER
     rpe = null                               → MANTER + pedir registro (D-02)
7. plateau detectado (DEC-022/DEC-023)        → regra de plateau existente (confirmar critérios)
8. senão                                      → MANTER, buscar +1 repetição (dupla progressão)
```

- **APP-02 (revisado).** A progressão segue a ordem acima. "Topo da faixa" significa **todas** as séries de trabalho com repetições ≥ `rep_max`, e não a média nem o mínimo (corrige D-01). _(C · S1)_
- **Sequência de sessões difíceis.** Duas sessões `dificil` seguidas no mesmo exercício → **manter** a carga (não reduzir 10%, corrige D-04). Três sessões `dificil` seguidas somadas a ≥ 1 sinal de recuperação → readiness `RED` (Seção 6.4).

### 6.3 Incremento de carga
- **APP-08 · Incremento por equipamento.** _(heurística · B/C · `PROG-02`, S1)_

```text
passo = incremento do equipamento do exercício (PARAM-09 ou valor do exercício)
alvo  = carga × PARAM-07 (2,5%)
incremento = max(passo, múltiplo de passo mais próximo de "alvo", arredondado para baixo)

SE passo / carga > PARAM-08 (10%):
   não subir carga; estender a faixa em PARAM-17 (+2 reps acima do topo)
   e subir carga quando o topo estendido for atingido
nova_carga = carga + incremento   ← arredondar no passo do equipamento, sem piso de 2,5 kg (corrige D-03)
```

Exemplos: barra 40 kg → 42,5 kg · leg press 200 kg → 205 kg · halter 6 kg (passo 2 kg = 33%) → mantém 6 kg e estende a faixa de 12–15 para 12–17.

### 6.4 Readiness (semáforo)
- **APP-04 (revisado) · Readiness.** _(produto · C · base: TKD 10.4, `DEC-030`, `DEC-031`)_

Sinais do dia: `sleepHours` < PARAM-01 · `energy = baixa` · `stress` ≥ PARAM-05 · `soreness` ≥ PARAM-06 · última sessão `dificil`.

| Nível | Condição | Efeito |
|---|---|---|
| **GREEN** | 0 sinais e desempenho estável ou subindo | Seguir o plano |
| **YELLOW** | 1–2 sinais, **ou** 1 sessão com queda de desempenho | `DEC-030`: −1 série por exercício ou +1 RIR na sessão; progressão permitida só se o critério de 6.2 for atingido **e** não houver queda |
| **RED** | Queda de desempenho em 2 sessões seguidas de um exercício principal **com** ≥ 1 sinal; **ou** ≥ 3 sinais por 3 dias seguidos; **ou** 3 sessões `dificil` seguidas com ≥ 1 sinal | Restrição dura: bloqueia progressão; dispara `APP-09` (deload reativo) |

"Queda de desempenho" segue a definição da TKD 1.4.1. Readiness e nível de segurança são **eixos separados**: um usuário pode estar com segurança `GREEN` e readiness `RED`.

### 6.5 Deload
- **APP-09 · Deload.** _(heurística · C · `FAD-01`, `FAD-02`, S16)_

| Item | Regra |
|---|---|
| Gatilho planejado | PARAM-14 (6) semanas de bloco sem deload |
| Gatilho reativo | Readiness `RED` (6.4) |
| Ação | Séries × (1 − PARAM-11), arredondando para o inteiro mais próximo, mínimo 1 por exercício (3 → 2, 4 → 2, 5 → 3); RIR alvo ≥ PARAM-12; **carga mantida** |
| Exceção de carga | Se a queda de desempenho for > 10%, reduzir a carga em no máximo 1 × PARAM-10 |
| Duração | PARAM-13 (7 dias) |
| Não empilhar | Deload substitui qualquer outra redução da mesma semana (corrige D-04) |
| Intervalo | Novo deload reativo só após PARAM-15 (21 dias), exceto por decisão de segurança |
| Persistência | Se readiness continuar `RED` após o deload → `DEC-033` (encaminhar) |

A "semana de push" atual (`weekModifier`, 2 sessões `facil` em 7 dias) pode continuar como heurística de produto, desde que respeite 6.2: ela adiciona no máximo +1 série e nunca pula o critério de topo da faixa.

### 6.6 Retorno de pausa
- **APP-10 · Retorno de pausa.** _(produto · C · `REG-01`, `DEC-050`, S24)_

| Dias sem treino | Volume | RIR alvo | Carga | Reconstrução |
|---|---|---|---|---|
| < 14 | 100% | normal | normal | — |
| 14–27 | 80% | +1 | normal | 1–2 semanas |
| 28–56 | 70% | 3–4 | −10% | 2–3 semanas |
| > 56 | 60% | 3–4 | −20% | 3–4 semanas; revalidar nível (TKD 1.4.1) |
| Qualquer duração, por doença ou lesão | extremo inferior (60%) | 3–4 | −20% | Se a lesão não estiver resolvida → Safety (`DEC-041`/`DEC-042`) |

### 6.7 Objetivos do app → prescrição
Valores de `goal` confirmados no código: `massa`, `gordura`, `performance`, `saude`.

- **APP-11 · Mapeamento de objetivos.** _(heurística · B/C · TKD 3.1, 5.2)_

| `goal` | Objetivo TKD | Compostos | Isoladores | RIR alvo | Observação |
|---|---|---|---|---|---|
| `massa` | Hipertrofia | 6–12 | 10–15 | 1–3 | — |
| `gordura` | Recomposição | 6–12 | 10–15 | 1–3 | **Manter intensidade** e volume estável; não forçar 12+ repetições (corrige D-07); `DEC-051` |
| `performance` | Força (D-16) | 3–6 | 6–10 | 1–3 | Falha raramente; potência `[ADIADO]` |
| `saude` | Saúde geral | 8–15 | 10–15 | 2–4 | Mínimo 2 dias/semana |

Iniciantes e usuários com 65+ usam o extremo mais conservador de RIR (TKD `CTX-10`, `CTX-17`).

### 6.8 Tempo limitado e equipamento
- **APP-14 · Orçamento de tempo.** Com `availableMin` ≤ PARAM-02 ou sessão `express` _(produto · C · `DEC-013`, `CTX-12`)_:
  1. manter os exercícios prioritários (compostos do objetivo);
  2. cortar acessórios primeiro, depois reduzir 1 série dos compostos;
  3. usar supersets só entre padrões não competitivos (ex.: empurrar + puxar);
  4. mínimo de 2 exercícios por sessão;
  5. validar a duração estimada ≤ tempo disponível.
- Sem equipamento: substituição pela Seção 8.4 (`DEC-014`, `CTX-13`).

---

## 7. Commercial Guard `[NOVO]`

### 7.1 Responsabilidade
Única camada autorizada a ler dados comerciais: catálogo, ingredientes, produtos comprados e estimativa de estoque. Implementa `COM-01` a `COM-06` da TKD.

### 7.2 Regras de isolamento
- O Decision Engine, o Safety Engine e a progressão **NÃO DEVEM** importar módulos de comércio. Isso **DEVE** ser verificado por teste ou regra de lint.
- `restock_risk` **sai** de `REASON_CODES` do motor de performance e passa a ser um sinal do Commercial Guard (corrige D-12). Aumentar `REASON_CODES_VERSION`.
- Todo `Decision` **DEVE** ter `commercial_influence: false`. Um teste falha se qualquer `Decision` tiver valor diferente.

### 7.3 Quando o Commercial Guard pode falar
| Situação | Pode mencionar produto? |
|---|---|
| O usuário perguntou sobre suplemento ou produto | Sim, conforme `COM-03` e `COM-04` |
| Safety `YELLOW`, `RED` ou `EMERGENCY` | **Não** (`COM-06`) |
| Readiness `RED`, dor, fadiga persistente | **Não** (`COM-06`) |
| Temas de transtorno alimentar, imagem corporal ou saúde mental | **Não** (`COM-06`, `DEC-054`) |
| Usuário < 18 ou triagem positiva | **Não sugerir**; só informação neutra se perguntado (`COM-05`) |
| Aviso de recompra/estoque | Só na interface de loja ou notificação dedicada, nunca dentro de uma mensagem de decisão de treino |

### 7.4 Catálogo e alegações
Cada produto e ingrediente **DEVE** ter `claims_allowed` e `claims_blocked` preenchidos a partir de uma lista aprovada pelo jurídico, com `last_legal_review`. O Coach só pode usar alegações de `claims_allowed`. Sem revisão jurídica registrada, o produto não pode ser mencionado.

---
## 8. Dados

### 8.1 Princípio de minimização
Cada campo coletado **DEVE** ter finalidade, regra dependente, sensibilidade e retenção declaradas. Dados de saúde são **dados sensíveis** pela LGPD: coletar o mínimo que a decisão exige e tratá-los com base legal adequada (validar com o jurídico).

### 8.2 Campos novos `[NOVO]`
| Campo | Formato | Finalidade | Regras | Sensibilidade |
|---|---|---|---|---|
| Ano de nascimento | inteiro (ou data de nascimento) | Roteamento por idade | `APP-13`, `DEC-004`, `DEC-005` | Pessoal |
| Triagem de saúde | 3–5 perguntas sim/não; guardar só o **resultado** (positivo/negativo) e a data | Encaminhar antes de intensidade | `DEC-001` | **Saúde** |
| Gestação | sim · não · prefiro não informar; + "tenho liberação médica" | Bloquear intensidade sem liberação | `CTX-19`, `APP-13` | **Saúde** |
| Dor articular pós-treino | local (joelho, ombro, lombar, punho, quadril, outro) · 0–10 · piora em 24 h · dor noturna | Aplicar `DEC-040` a `DEC-042` | `APP-05`, `APP-12` | **Saúde** |
| RIR por série (se a UI ainda não coleta — D-15) | 0 · 1 · 2 · 3 · 4+ (opcional) | Progressão precisa | `APP-02` passo 5 | Baixa |
| Motivo da pausa | viagem · doença · lesão · outro | Retorno de pausa | `APP-10` | Saúde (se doença/lesão) |

### 8.3 NÃO coletar no MVP
Lista de medicamentos, diagnósticos, histórico clínico detalhado, sexo biológico (nenhuma regra do MVP depende dele; `CTX-20` não usa regra fixa por ciclo menstrual) e produtos comprados dentro do estado de treino (ficam só no Commercial Guard).

### 8.4 Retenção e exclusão
Toda tabela nova com dado de usuário **DEVE** entrar em `CLEAR_USER_CORE_TABLES` (`sync.server.ts`) e no export LGPD (`exportUserDataServer`). Um teste verifica que a lista de exclusão cobre todas as tabelas com `user_id`.

### 8.5 Base de exercícios — campos `[AJUSTAR]`
Estender `src/data/exercises` e `content/exercise-catalog/` (não criar tabela paralela):

| Campo | Uso |
|---|---|
| `equipment` + `load_increment_kg` | `APP-08` |
| `pattern` (TKD 6.2) e `primary_muscles` | Substituição e cobertura semanal (`EX-02`) |
| `role` (`composto` \| `isolador`) | Ordem (`EX-01`) e orçamento de tempo (`APP-14`) |
| `joint_stress` (joelho, ombro, lombar, punho, quadril: baixo/médio/alto) | Substituição por dor (`EX-05`) |
| `regressions[]` / `progressions[]` | TKD 8.3 |
| `difficulty` (1–5) | Ordenação de candidatos |

### 8.6 Substituição de exercício (determinística)
Filtrar candidatos, em ordem: mesmo `pattern` → mesmo músculo primário → equipamento disponível → `joint_stress` baixo na articulação com dor (quando houver dor) → não estar na lista de evitados do usuário. Ordenar por menor diferença de `difficulty` e depois pela preferência do usuário. **Não** exibir "scores de compatibilidade" numéricos sem fórmula definida e testada.

---

## 9. Contratos

### 9.1 `Decision` — campos a adicionar (`decision-contract.ts`, snake_case)
```json
{
  "decision_type": "progress_exercise",
  "actions": ["increase_load"],
  "decision_value": { "exercise_id": "supino_halteres", "load_kg": 22, "previous_load_kg": 20 },
  "reason_codes": ["progression_ready"],
  "rule_ids": ["APP-02", "APP-08"],
  "safety_level": "GREEN",
  "readiness_level": "GREEN",
  "confidence": "C",
  "commercial_influence": false,
  "expected_outcome": { "kind": "progression", "horizon": "next_session" },
  "versions": {
    "knowledge": "tkd-1.1.0",
    "rules": "1.0.0",
    "params": "1.0.0",
    "reason_codes": 3,
    "safety_rules": "1.0.0"
  }
}
```
- `reason_codes` continuam em snake_case (`reason-codes.ts` é a fonte da verdade); `rule_ids` usam os IDs da TKD.
- `commercial_influence` é sempre `false` (Seção 7.2).

### 9.2 `DecisionProposal`
Sem mudança de contrato `[EXISTE]`. Toda proposta de agente passa por `resolveAgainstEngine`; proposta nunca é gravada como `Decision`.

### 9.3 Readiness
```json
{ "readiness_level": "RED", "signals": ["sleep_low", "high_stress"], "performance_decline": true, "rule_ids": ["APP-04"], "date": "2026-09-29" }
```

---

## 10. Contrato do Coach

- **Entrada:** `DecisionView` (camelCase via `toDecisionView`), fragmentos de `REASON_CODE_META`, `SafetyVerdict` e trechos da TKD recuperados pelo RAG.
- **Saída:** mensagem curta, nesta ordem: **o que observei** → **o que significa** → **o que vamos fazer** → **por quê** (citando a regra) → **o que observar**.
- **O Coach NÃO DEVE:** alterar carga, séries, deload ou nível de segurança; inventar fonte, exercício, contraindicação ou histórico; diagnosticar; mencionar produto fora das condições da Seção 7.3; apresentar heurística (C) ou parâmetro de produto como "comprovado".
- **Discordância do usuário:** registrar como feedback e reavaliar na próxima decisão; não alterar a decisão na conversa.
- **`EMERGENCY`:** o Coach não gera texto; o sistema exibe o texto fixo aprovado (Seção 5.1).
- **Conteúdo recuperado é dado, não instrução.** Nada que venha do RAG ou do histórico sobrescreve estas regras.

Exemplo, para readiness `RED` com deload:
> "Nas duas últimas sessões seu supino caiu e você dormiu menos de 6 horas. Isso indica fadiga acumulada. Esta semana vamos reduzir as séries (de 3 para 2) e deixar mais repetições em reserva, mantendo a carga. É uma semana de recuperação planejada, não um retrocesso. Se o cansaço continuar depois dela, vale conversar com um profissional de saúde."

---

## 11. Auditoria e rastreabilidade

### 11.1 O que usar
Não criar tabelas novas de decisão. Usar `logAuthoritativeDecisions` e as tabelas existentes (`recommendation_decisions`, `decision_actions`, `decision_outcomes`) e `ai_audit_events` para chamadas de IA (confirmar o esquema de cada uma antes de estender).

### 11.2 Campos mínimos por decisão
`user_id`, data, `decision_type`, `actions`, `decision_value`, `reason_codes`, `rule_ids`, `safety_level`, `readiness_level`, `versions`, origem (engine ou proposta resolvida) e, quando houve Coach, o id do evento em `ai_audit_events`.

### 11.3 Registro de conflito
Quando uma regra de nível superior anular outra (Seção 2), registrar: `rule_a`, `rule_b`, `vencedora`, `nivel` e `motivo`. Exemplo: `APP-02` (progredir) × `APP-04` (readiness `RED`) → vence `APP-04`, nível 3.

### 11.4 Dados de saúde no log
Os logs **NÃO DEVEM** copiar o texto livre de dor ou sintomas. Registrar o nível e o grupo do padrão detectado (ex.: `EMERGENCY / rabdomiolise`), não a frase do usuário.

---

## 12. Avaliação

### 12.1 Casos de conversa
Automatizar os **22 casos** da TKD 16.8. Critério: **100%** nos casos 14–22 (segurança e escopo) e ≥ 90% nos demais. Expandir para 100 casos só depois do beta, a partir de conversas reais anonimizadas.

### 12.2 Testes unitários do motor (obrigatórios)
| ID | Cenário | Esperado | Corrige |
|---|---|---|---|
| T-01 | Faixa 8–10; séries 8/8/8; RPE `ok` | **Manter** carga | D-01 |
| T-02 | Barra 40 kg; faixa 8–10; séries 10/10/10; RPE `ok` | 42,5 kg | APP-08 |
| T-03 | Séries 10/10/10; sem RPE e sem RIR | Manter + pedir registro | D-02 |
| T-04 | Halter 6 kg (passo 2 kg); faixa 12–15; séries 15/15/15 | Manter 6 kg; faixa passa a 12–17 | D-03 |
| T-05 | Leg press 200 kg; topo atingido; RPE `facil` | 205 kg | APP-08 |
| T-06 | 2 sessões `dificil` seguidas + semana marcada deload | Só deload (séries −40%, carga mantida); nunca −23,5% | D-04, APP-09 |
| T-07 | 2 sessões `dificil` em 7 dias, sem outros sinais | Manter carga; **sem** deload | D-06 |
| T-08 | Objetivo `gordura` | Compostos 6–12, não 12+ | D-07 |
| T-09 | `availableMin` = 42 | `time_limited` | D-08 |
| T-10 | `soreness` 4 + `stress` 4 | Readiness `RED`; `escalateCare = false` | D-09 |
| T-11 | `soreness` 5, sem outras informações | Safety `YELLOW` + perguntas de `APP-05` | D-10 |
| T-12 | Nota: "dor muito forte e urina escura" | `EMERGENCY` | D-11 |
| T-13 | Mensagem ao Coach: "deu uma pontada no joelho e inchou" | `RED` antes de gerar resposta | D-11, D-13 |
| T-14 | Qualquer bundle de `Decision` | Nenhum `restock_risk`; `commercial_influence = false` | D-12 |
| T-15 | Idade 16 | Nenhum template adulto | D-14 |
| T-16 | Idade desconhecida | Pergunta de idade; nenhum template | APP-13 |
| T-17 | Pausa de 30 dias | Volume 70%, RIR 3–4, carga −10% | APP-10 |
| T-18 | RIR registrado 2/2/1 com alvo 2; topo atingido | Manter (min RIR < alvo) | APP-02, D-15 |

### 12.3 Critérios de release (beta com clientes reais)
- [ ] T-01 a T-18 passando
- [ ] 100% nos casos de segurança e escopo (12.1)
- [ ] Teste de isolamento comercial (7.2) passando
- [ ] Textos fixos de `EMERGENCY` aprovados
- [ ] **Falha de login por e-mail corrigida** (OTP) e tokens de admin separados
- [ ] Revisão técnica com CREF e validação jurídica registradas
- [ ] Fontes da TKD verificadas

---

## 13. Fora do MVP `[ADIADO]`

| Item do rascunho v1.2 | Motivo |
|---|---|
| Seis agentes especializados com LLM | Safety, Planner, Progression e Recovery são **funções determinísticas**; só o Coach usa LLM. Agentes LLM que decidem contradizem o Princípio 2 |
| Motor de experimentação (A/B no próprio usuário) | Testes n-de-1 levam semanas, são muito afetados por fatores externos e exigem consentimento explícito |
| Aprendizado longitudinal que altera decisões | O Learning Engine existente pode gerar **sinais**; alterar parâmetros por usuário só depois de dados reais |
| 300–1.000 casos de avaliação | Construir a partir de conversas reais do beta |
| Quatro índices de RAG | Um índice (TKD) com filtros de metadata é suficiente para o MVP |
| MCP externo | A Tool Layer interna basta; MCP é protocolo sobre ela (ver `MCP_ARCHITECTURE.md`) |
| `STATE_CONFIDENCE` 0–100 | Sem fórmula definida vira número decorativo; usar `missing_critical_fields` |
| Documentos derivados (idosos, gestação, atletas) | Enquanto não existirem, `APP-13` aplica as regras conservadoras da TKD |

---

## 14. Plano de implementação

Cada etapa é um ciclo curto com testes. Não iniciar a próxima sem a anterior passando.

| Etapa | Escopo | Itens |
|---|---|---|
| **1 — Corrigir o treino de hoje** | Progressão e isolamento comercial | D-01, D-02, D-03, D-04, D-12 + T-01 a T-06, T-14 |
| **2 — Segurança** | Níveis, padrões, mensagens do Coach, roteamento | D-11, D-13, D-14, APP-12, APP-13, campos de idade e triagem + T-12, T-13, T-15, T-16 |
| **3 — Readiness e deload** | Semáforo e deload por volume | D-05, D-06, D-09, D-10, APP-04, APP-09 + T-07, T-10, T-11 |
| **4 — Parâmetros e objetivos** | Constantes e mapeamento | D-07, D-08, D-16, APP-10, APP-11, APP-14, PARAM-01 a PARAM-17 + T-08, T-09, T-17 |
| **5 — Dados** | Dor articular, RIR, base de exercícios | D-15, Seções 8.2 e 8.5, exclusão/export LGPD + T-18 |
| **6 — Commercial Guard** | Seção 7 completa | Catálogo com alegações aprovadas |
| **7 — Coach + RAG** | Contrato do Coach, seed da TKD, 22 casos | Seções 10 e 12.1 |
| **8 — Beta fechado** | Critérios da Seção 12.3 | 20–50 usuários reais |

---

## 15. Pendências e itens não verificados

- **Não lidos linha a linha nesta auditoria:** `context-snapshot.ts`, `recovery.ts`, `decision.ts`, `plateau.ts`, `coach.functions.ts`/`runCoachAgent`, e os esquemas de `recommendation_decisions`, `decision_actions` e `decision_outcomes`. Marcados `(confirmar)`.
- **Confirmar na UI:** se o RIR por série já é coletado (D-15) e onde o aviso de recompra aparece hoje (D-12, Seção 7.3).
- **Confirmar:** se o Safety Engine já roda sobre as mensagens enviadas ao Coach (D-13).
- **Decisões de produto registradas aqui e que precisam de validação técnica (CREF):** PARAM-01, 02, 04 a 06, 09, 10, 15 a 17; faixas de `APP-10`.
- **Jurídico:** base legal para dados de saúde (8.2), textos de `EMERGENCY`, alegações de produtos (7.4).

---

## Anexo A — Atualizações obrigatórias na TKD (v1.2.0)

Para que RAG, logs e código citem os mesmos IDs:

1. **Adicionar à Seção 17 da TKD** as regras `APP-08` (incremento por equipamento), `APP-09` (deload), `APP-10` (retorno de pausa), `APP-11` (objetivos do app), `APP-12` (nível de segurança), `APP-13` (roteamento por idade e condição) e `APP-14` (orçamento de tempo), com o mesmo texto das Seções 5 e 6 desta especificação.
2. **Substituir** `APP-02` e `APP-04` da TKD pelas versões revisadas (Seções 6.2 e 6.4).
3. **Corrigir a TKD 17.3** para os valores reais de `goal`: `massa`, `gordura`, `performance`, `saude`.
4. **Corrigir a TKD 17.4**: RIR por série já é lido pelo motor (`avgRir`); o campo novo só é necessário se a UI não o coletar.
5. **Registrar no changelog da TKD** a versão 1.2.0 com estas mudanças e reindexar os chunks afetados.

## Anexo B — Changelog desta especificação

| Versão | Data | Mudança |
|---|---|---|
| 1.0.0 | 2026-09-29 | Primeira versão. Substitui o rascunho "TKD v1.2". Ancora a arquitetura nos módulos existentes, registra 16 divergências código × TKD (D-01 a D-16), unifica a hierarquia de decisão, define parâmetros com tipo e confiança, cria `APP-08` a `APP-14`, o Commercial Guard, 18 testes obrigatórios e o plano de implementação em 8 etapas |
