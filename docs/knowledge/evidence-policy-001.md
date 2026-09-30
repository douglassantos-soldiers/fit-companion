---
doc_id: evidence-policy-001
titulo: Política de Evidência — Base de Conhecimento do Fit Companion
versao: 1.0.0
data: 2026-09-29
idioma: pt-BR
aplica_se_a: todos os documentos de conhecimento (TKD, segurança, suplementos, nutrição e futuros)
documentos_relacionados: [tkd-resistido-adultos-001 v1.1.0, spec-training-system-001 v1.0.0]
status: aprovado_para_uso_interno (revisão jurídica da Seção 7 pendente)
indexar_no_rag: false   # a Seção 8 é carregada no prompt do Coach, não recuperada por busca
---

# Política de Evidência v1.0

## 0. Propósito e alcance

Esta política define **como qualquer afirmação entra, é classificada, é verificada, é identificada e é apresentada ao usuário** na base de conhecimento do Fit Companion.

Ela vale para todos os documentos de conhecimento, atuais e futuros. Nenhum documento pode ser indexado no RAG se violar uma regra marcada como **DEVE**.

Termos: **DEVE / NÃO DEVE** = obrigatório; **DEVERIA** = recomendado, desvio exige justificativa registrada; **PODE** = opcional.

As regras desta política usam o prefixo `EVP-`.

---

## 1. Tipos de afirmação

Toda regra, número ou afirmação **DEVE** ter exatamente um tipo.

| Tipo | O que é | Exemplo | Pode ter nível A/B? |
|---|---|---|---|
| `evidencia` | Sustentada por literatura científica | "Creatina monoidratada aumenta força associada ao treino" | Sim |
| `heuristica` | Prática consolidada de profissionais, sem validação experimental formal | "Deload a cada 4–8 semanas" | Não — sempre **C** |
| `produto` | Decisão de design do Fit Companion | "Tempo limitado = ≤ 45 min" | Não — sempre **C** |
| `regulatorio` | Exigência legal ou normativa | "Alegações de suplementos seguem a regulação da ANVISA" | Não se aplica — usa `norma` em vez de nível |

- **EVP-001 · Tipo obrigatório.** Toda regra e todo número **DEVE** declarar `tipo`. Regra sem tipo não é indexada. _(regulatorio interno)_
- **EVP-002 · Heurística e produto não viram evidência.** Uma heurística repetida por muitos treinadores continua sendo heurística. Um parâmetro de produto que "funciona bem" continua sendo parâmetro de produto até existir fonte que o sustente.
- **EVP-003 · Regulatório é separado de científico.** Uma alegação pode ser verdadeira na literatura e **não permitida** pela regulação, ou permitida e com evidência fraca. As duas checagens são independentes e ambas precisam passar (Seção 7).

---

## 2. Níveis de confiança (somente para `tipo: evidencia`)

| Nível | Critério mínimo |
|---|---|
| **A** | Meta-análise ou revisão sistemática de boa qualidade **com resultados consistentes**, ou posicionamento de entidade reconhecida que se apoie em revisão sistemática e seja coerente com outras entidades. População e desfecho compatíveis com o uso no app. |
| **B** | Meta-análise com limitações relevantes (heterogeneidade alta, poucos estudos, populações restritas), ou ao menos um ensaio controlado bem conduzido, ou consenso parcial entre entidades. |
| **C** | Estudos observacionais isolados, mecanismo plausível, extrapolação de outra população, opinião de especialistas. Também é o nível automático de `heuristica` e `produto`. |

### 2.1 Regras de rebaixamento
Aplicar a partir do nível que o desenho do estudo sugere. Cada fator rebaixa **um nível** (A → B → C). O nível mínimo é C.

- **EVP-010 · População diferente.** A evidência vem de uma população diferente daquela a quem a regra se aplica (ex.: homens jovens treinados → idosos, mulheres, iniciantes).
- **EVP-011 · Desfecho substituto.** O estudo mediu um marcador intermediário, não o desfecho que a regra afirma (ex.: sinalização anabólica aguda → hipertrofia de longo prazo).
- **EVP-012 · Duração insuficiente.** Estudos de 8–16 semanas sustentando afirmação sobre meses ou anos.
- **EVP-013 · Conflito de interesse sem replicação.** Resultado financiado pela indústria interessada e não replicado de forma independente. Crítico para suplementos (Seção 7).
- **EVP-014 · Inconsistência.** Fontes de qualidade semelhante apontam em direções diferentes sem explicação.

O motivo do rebaixamento **DEVE** ser registrado no campo `rebaixamento` da regra (ex.: `["EVP-010"]`).

### 2.2 Regras gerais de nível
- **EVP-020 · A ou B exige fonte.** Regra `evidencia` com nível A ou B **DEVE** citar ao menos uma fonte do registro (Seção 4). Sem fonte → nível C com a marca `fonte pendente`.
- **EVP-021 · O nível vale para a afirmação, não para o tema.** "Proteína ajuda hipertrofia" pode ser A, enquanto "2,2 g/kg é melhor que 1,6 g/kg" é C. Cada afirmação recebe o próprio nível.
- **EVP-022 · Fonte pendente não sustenta A/B na conversa.** Enquanto a fonte estiver com `status_verificacao` diferente de `verificada`, o nível pode ser mantido no documento, mas o Coach **NÃO DEVE** apresentá-la como comprovada (Seção 8).

---

## 3. Números

- **EVP-030 · Todo número tem ficha.** Número usado em regra **DEVE** declarar:

```yaml
valor: { min: 1.6, max: 2.2 }   # preferir faixa a valor pontual
unidade: g/kg/dia
significado: ingestao_proteica_para_maximizar_hipertrofia
tipo: evidencia
confianca: A
fontes: [SRC-0019, SRC-0020]
populacao: adultos_saudaveis_treinando
contexto: hipertrofia
requer_calibracao: false
```

- **EVP-031 · Faixa antes de ponto.** Usar faixas quando a literatura dá faixas. Um valor pontual só quando a fonte o sustenta ou quando é parâmetro de produto declarado.
- **EVP-032 · Precisão honesta.** Não apresentar mais casas decimais ou mais precisão do que a fonte oferece. "~1,6 g/kg" em vez de "1,62 g/kg".
- **EVP-033 · Parâmetros de produto vivem no código.** Números `tipo: produto` usados pelo motor ficam em `decision-thresholds.ts`, com o ID `PARAM-` da especificação. O documento de conhecimento cita o parâmetro; não o redeclara com outro valor.
- **EVP-034 · `requer_calibracao: true`** para todo número `heuristica` ou `produto` que o motor usa para decidir. Esses números **DEVEM** ser revisados depois do beta com dados reais.

---

## 4. Registro central de fontes

### 4.1 ID global
- **EVP-040 · ID único.** Toda fonte recebe um ID global `SRC-NNNN` no registro central (`sources-registry-001.yaml`), independente do documento que a usa pela primeira vez. O ID nunca é reutilizado.
- **EVP-041 · Migração da TKD.** Os IDs locais `S1`–`S41` da TKD v1.1 correspondem a `SRC-0001`–`SRC-0041`, na mesma ordem (`S1` → `SRC-0001`, `S41` → `SRC-0041`). Até a TKD 1.2 migrar, `S1`–`S41` são aceitos como aliases.

### 4.2 Ficha da fonte

```yaml
- id: SRC-0021
  alias: [S21]                     # aliases legados
  tipo_estudo: posicionamento      # meta_analise | revisao_sistematica | posicionamento | ecr | coorte | observacional | mecanistico | livro_pratica | diretriz | norma
  citacao: "Kreider et al. ISSN position stand: safety and efficacy of creatine supplementation. J Int Soc Sports Nutr 2017;14:18"
  doi: null                        # preencher na verificação
  pmid: null
  ano: 2017
  populacao: adultos, atletas e praticantes
  conflito_de_interesse: a_avaliar # nenhum | declarado | industria | a_avaliar
  status_verificacao: pendente     # ver 4.3
  verificado_por: null
  verificado_em: null
  afirmacoes_suportadas: [tkd-resistido-adultos-001#REC-08]
  observacoes: ""
```

### 4.3 Status de verificação

| Status | Significado | Efeito nas regras |
|---|---|---|
| `pendente` | Nunca verificada (padrão para fontes compiladas por IA) | Pode ser usada; Coach não diz "comprovado" (`EVP-022`) |
| `verificada` | Existe, metadados conferem **e** a afirmação é sustentada pelo conteúdo | Uso pleno |
| `divergente` | Existe, mas título/ano/periódico não conferem, ou a fonte não sustenta exatamente a afirmação | Corrigir a citação ou a afirmação antes do próximo release |
| `nao_encontrada` | Não localizada | Regras que dependem só dela caem para C `sem_fonte` imediatamente |
| `retratada` | Artigo retratado ou com expressão de preocupação | Remover como suporte imediatamente; revisar as regras afetadas |

### 4.4 Processo de verificação
- **EVP-050 · Verificar a afirmação, não só a citação.** Uma fonte só é `verificada` quando o revisor conferiu que o conteúdo sustenta a afirmação **no sentido e na população** em que ela é usada. Achar o DOI não basta.
- **EVP-051 · Checklist mínimo:** (1) localizar em PubMed, DOI ou editora; (2) conferir autores, ano, periódico, volume e páginas; (3) ler resumo e resultados relevantes; (4) conferir se a afirmação da regra corresponde ao achado; (5) checar retratação; (6) registrar `verificado_por` e `verificado_em`.
- **EVP-052 · IA não é fonte.** Nenhum modelo de linguagem, incluindo o que redigiu os documentos, pode ser citado como fonte. Referências compiladas por IA entram obrigatoriamente como `pendente`.
- **EVP-053 · Preprints e livros de prática** podem ser citados, mas a afirmação fica no máximo em **C**.

---

## 5. Conflito entre fontes

- **EVP-060 · Ordem de precedência** quando fontes discordam:
  1. revisão sistemática / meta-análise de melhor qualidade e mais recente;
  2. posicionamento de entidade que se apoie em revisão sistemática;
  3. ensaios controlados;
  4. estudos observacionais;
  5. estudos mecanísticos ou em animais;
  6. opinião de especialistas e heurística.
- **EVP-061 · Qualidade antes de data.** Uma revisão mais recente só prevalece se tiver qualidade semelhante ou maior.
- **EVP-062 · Não inventar consenso.** Se o conflito não se resolve pela ordem acima, a regra **DEVE** registrar a incerteza (`conflito: true`, com as fontes de cada lado) e o Coach **DEVE** comunicá-la ao usuário.
- **EVP-063 · Segurança resolve para o lado conservador.** Em conflito sobre risco, adotar a posição mais conservadora até a revisão profissional decidir.
- **EVP-064 · Conflito entre regras** (não entre fontes) segue a hierarquia de decisão da especificação (`spec-training-system-001`, Seção 2), não esta política.

---

## 6. Identificação de regras

### 6.1 Prefixos por domínio
- **EVP-070 · Uma regra, um documento.** Cada regra é definida em **exatamente um** documento. Outros documentos a referenciam pelo ID; não a redeclaram.
- **EVP-071 · Prefixos reservados.** Nenhum documento pode usar prefixo reservado a outro.

| Prefixo(s) | Documento dono | Situação |
|---|---|---|
| `PRIN` `OBJ` `VAR` `PRES` `EX` `PROG` `REG` `REC` `FAD` `CTX` `COM` `DEC` `APP` | `tkd-resistido-adultos-001` (treino) | Em uso (legado, formato `XXX-NN` ou `DEC-NNN`) |
| `EVP` | `evidence-policy-001` | Em uso |
| `SAF` | `safety-knowledge-001` | Reservado |
| `SUP` | `supplements-knowledge-001` | Reservado |
| `NUT` | `nutrition-knowledge-001` | Reservado |
| `BEH` | `behavior-adherence-knowledge-001` | Reservado |
| `PRD` | `coach-product-knowledge` | Reservado |
| `RUN` `CND` `MOB` | Corrida, condicionamento, mobilidade | Reservados (documentos adiados) |
| `D` `T` `PARAM` | `spec-training-system-001` | Só engenharia; **não** entram no RAG |

Observação: `COM-01` a `COM-06` continuam definidas na TKD. O documento de suplementos as referencia e cria regras novas com `SUP-`.

### 6.2 Formato para documentos novos
- **EVP-072 · Formato `PREFIXO-NNN`** (três dígitos), com faixas por tipo:

| Faixa | Tipo de regra |
|---|---|
| 001–099 | Princípios e definições |
| 100–199 | Regras de conhecimento (evidência, heurística) |
| 200–299 | Regras de decisão (SE → ENTÃO) |
| 300–399 | Contexto e populações |
| 400–499 | Segurança e escopo |
| 500–599 | Exemplos e casos |

- **EVP-073 · ID qualificado nos logs.** Logs, proveniência e metadados de chunk **DEVEM** usar a forma `doc_id#ID` (ex.: `supplements-knowledge-001#SUP-210`).
- **EVP-074 · IDs nunca são reutilizados.** Regra removida recebe `status: obsoleta` e, se houver, `substituida_por`.

### 6.3 Ficha mínima de regra

```yaml
id: SUP-210
doc_id: supplements-knowledge-001
texto: "SE ... ENTÃO ..."
tipo: evidencia | heuristica | produto | regulatorio
confianca: A | B | C          # omitir se regulatorio
fontes: [SRC-0021]
norma: null                   # obrigatório se regulatorio
rebaixamento: []
populacao: [adulto_saudavel]
risco: baixo | medio | alto
conflito: false
executar_no_motor: false
status: ativa | obsoleta
versao_introduzida: 1.0.0
```

---

## 7. Regras específicas por domínio

### 7.1 Suplementos
- **EVP-080 · Evidência é sobre o ingrediente, não sobre a marca.** O nível de confiança se refere ao ingrediente, na dose e forma estudadas. Nenhuma regra afirma superioridade de um produto sobre outro sem fonte comparativa.
- **EVP-081 · Alegação precisa passar em dois filtros:** (1) sustentada pela evidência no nível declarado; (2) presente em `claims_allowed` aprovado pelo jurídico conforme a regulação sanitária de suplementos alimentares. Falhou em qualquer um → não pode ser dita. _(regulatorio · revisão jurídica pendente)_
- **EVP-082 · Estudos financiados pela indústria** aplicam `EVP-013` quando não houver replicação independente.
- **EVP-083 · Dose de referência ≠ recomendação individual.** O documento informa a faixa estudada; orientar dose individual para quem tem condição de saúde é fora do escopo (`COM-05`).

### 7.2 Nutrição
- **EVP-090 · Referências populacionais, não prescrição.** Números nutricionais são referências para adultos saudáveis. Plano alimentar e prescrição de dieta são atribuição do nutricionista.
- **EVP-091 · Tabelas de composição de alimentos** (ex.: TACO) são `tipo: evidencia`, fonte própria no registro, e valem para o alimento descrito, não para preparações diferentes.

### 7.3 Segurança
- **EVP-100 · Regra de segurança pode ser conservadora sem evidência forte.** Uma regra de segurança `tipo: produto` com nível C é válida se a justificativa for prudência, e **NÃO DEVE** ser removida ou relaxada por falta de evidência sem revisão profissional registrada.
- **EVP-101 · Sinais de alerta** devem citar diretriz de triagem ou posicionamento clínico quando existir; na ausência, `tipo: produto` com `justificativa: prudencia`.

### 7.4 Treino
- A TKD segue esta política integralmente. Os níveis A/B/C da TKD v1.1 são compatíveis com a Seção 2; a TKD 1.2 **DEVERIA** adicionar os campos `tipo` e `rebaixamento` às regras.

---

## 8. Como o Coach fala sobre evidência

Esta seção **DEVE** ser carregada no prompt do Coach.

| Situação da regra | Como dizer | Nunca dizer |
|---|---|---|
| `evidencia` · A · fonte `verificada` | "A evidência é consistente em mostrar que…" | "É garantido", "funciona para todo mundo" |
| `evidencia` · B | "Estudos indicam que…, mas com limitações" | "Está comprovado" |
| `evidencia` · C, ou fonte `pendente` | "Há indícios de que…" / "Algumas pesquisas sugerem…" | "A ciência comprova", "estudos mostram" |
| `heuristica` | "É uma prática comum entre treinadores…" | Qualquer referência a "estudos" |
| `produto` | "No app, usamos este critério…" | Apresentar como fato científico |
| `conflito: true` | "As pesquisas ainda divergem sobre isso…" | Escolher um lado como se fosse consenso |
| Sem regra que cubra a pergunta | "Não tenho uma base confiável para responder isso com segurança" | Inventar resposta, fonte ou número |

- **EVP-110 · Citar o ID e o nível ao dar números** quando o usuário pedir o porquê (ex.: "regra REC-06, nível A").
- **EVP-111 · Não inventar números.** O Coach só apresenta números que existem em uma regra recuperada ou em uma decisão do motor.
- **EVP-112 · Não citar fonte ao usuário sem `verificada`.** O Coach pode mencionar que há estudos, mas só cita autor, ano ou periódico de fontes `verificada`.
- **EVP-113 · Individualidade.** Ao apresentar médias populacionais, lembrar que a resposta individual varia (TKD `PRIN-06`).

---

## 9. Ciclo de vida dos documentos

### 9.1 Status

| Status | Significado | Indexação no RAG |
|---|---|---|
| `rascunho` | Em redação | Não |
| `em_revisao` | Com revisor técnico/jurídico | Só em ambiente de teste, com `ambiente: teste` nos metadados |
| `aprovado` | Revisões concluídas e registradas | Sim |
| `obsoleto` | Substituído por nova versão | Não; manter para auditoria |

- **EVP-120 · Revisor por domínio.** Um documento só passa a `aprovado` com o revisor registrado nos metadados:

| Domínio | Revisor obrigatório |
|---|---|
| Treino, corrida, condicionamento, mobilidade | Profissional de Educação Física (CREF ativo) |
| Nutrição e suplementos | Nutricionista (CRN ativo) |
| Segurança e sinais de alerta | Médico (CRM ativo) **recomendado**; CREF obrigatório |
| Alegações de produto, dados de saúde, enquadramento | Jurídico |
| Esta política | Responsável técnico do produto + jurídico (Seção 7) |

### 9.2 Versionamento
- **EVP-130 · Semântico.** Maior: mudança de regra de segurança, faixa numérica ou nível de confiança. Menor: regra ou seção nova. Patch: correção de texto sem mudança de sentido.
- **EVP-131 · Revisão periódica** a cada 6 meses (`proxima_revisao` no frontmatter).
- **EVP-132 · Revisão extraordinária** em até 30 dias após: retratação de fonte usada; novo posicionamento de entidade relevante; incidente de segurança relacionado a uma regra; mudança regulatória.
- **EVP-133 · Reindexação.** Toda mudança de versão reindexa os chunks afetados e atualiza `versao_doc`.

---

## 10. Verificações automáticas (CI)

Um script de validação **DEVE** rodar antes de qualquer indexação e bloquear se falhar:

| Check | Regra |
|---|---|
| Toda regra tem `tipo` | `EVP-001` |
| Regra A/B cita fonte existente no registro | `EVP-020`, `EVP-040` |
| `heuristica` e `produto` com nível C | `EVP-002` |
| `regulatorio` tem `norma` preenchida | `EVP-003` |
| Nenhum ID duplicado entre documentos | `EVP-070` |
| Nenhum prefixo usado fora do documento dono | `EVP-071` |
| Toda fonte citada tem `status_verificacao` | `EVP-040` |
| Nenhuma regra ativa depende só de fonte `retratada` ou `nao_encontrada` | `EVP-050` |
| Documento indexado tem status `aprovado` (ou `em_revisao` em teste) | `EVP-120` |
| Números usados pelo motor têm `requer_calibracao` | `EVP-034` |

Relatório de saída sugerido: total de regras por nível, percentual de fontes verificadas, regras com `fonte pendente` e regras com `conflito: true`.

---

## 11. Pendências

1. Criar `sources-registry-001.yaml` com as 41 fontes da TKD v1.1 (`SRC-0001`–`SRC-0041`), todas `pendente`.
2. Iniciar a verificação das fontes de maior impacto: as que sustentam regras nível A e as usadas pelo motor.
3. Validação jurídica da Seção 7.1 (`EVP-081`) e da lista de revisores (9.1).
4. Implementar os checks da Seção 10.
5. TKD 1.2.0: adicionar `tipo` e `rebaixamento` às regras e migrar `S1`–`S41` para `SRC-`.

## 12. Changelog

| Versão | Data | Mudança |
|---|---|---|
| 1.0.0 | 2026-09-29 | Primeira versão. Tipos de afirmação, níveis A/B/C com rebaixamento, fichas de número e fonte, registro central `SRC-`, status de verificação, precedência entre fontes, prefixos de ID por domínio, regras de suplementos/nutrição/segurança, linguagem do Coach, ciclo de vida e checks de CI |
