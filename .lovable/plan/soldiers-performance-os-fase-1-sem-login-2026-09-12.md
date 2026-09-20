Soldiers App
1. Visão do produto
O Soldiers App será uma plataforma digital de fitness da Soldiers Nutrition, com acesso concedido aos clientes da marca.

O produto combinará:

Treino de musculação personalizado

Nutrição e acompanhamento alimentar

Evolução física

Gamificação

Rede social fitness

Desafios

IA/Coach personalizado

Integração com a base de clientes da Shopify

Personalização contínua baseada no comportamento do usuário

Conceito
Treine. Evolua. Compartilhe.

O objetivo não é criar apenas um aplicativo de ficha de treino.

O objetivo é criar um ecossistema de evolução física, no qual o aplicativo aprende com cada usuário e adapta sua experiência ao longo do tempo.

2. Princípios do produto
2.1 Personalização extrema
Cada usuário deve receber uma experiência diferente com base em:

objetivo

experiência

disponibilidade

equipamentos

histórico de treino

desempenho

recuperação

preferências

alimentação

peso

comportamento

interação social

aderência

2.2 Experiência altamente envolvente
O produto deve incorporar elementos de produtos altamente recorrentes, como:

feed personalizado

progresso visual

streaks

desafios

níveis

XP

conquistas

notificações contextuais

recompensas

conteúdo personalizado

A gamificação deve reforçar comportamentos reais de treino e consistência, e não apenas incentivar o usuário a abrir o aplicativo.

2.3 Fricção mínima
Registrar uma série deve ser extremamente rápido.

O usuário não deve precisar preencher formulários complexos durante o treino.

Objetivo:

Registrar uma série em 1–3 interações.

2.4 Explicabilidade
Quando o sistema fizer uma recomendação, o usuário deve poder descobrir:

Por que estou vendo isso?

Exemplo:

Aumentamos sua carga porque você completou todas as séries no topo da faixa de repetições no último treino.

3. Arquitetura geral
                         SHOPIFY
                            │
                  Clientes + Pedidos
                            │
                            ▼
                   INTEGRATION LAYER
                            │
                            ▼
                     SOLDIERS BACKEND
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
       TRAINING          NUTRITION          SOCIAL
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                            ▼
                 PERSONALIZATION ENGINE
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
             RULES          AI       ANALYTICS
                │           │           │
                └───────────┼───────────┘
                            │
                            ▼
                         USER

4. Navegação principal
A navegação mobile terá cinco áreas principais:

┌──────────────────────────────────────────┐
│                                          │
│                 CONTENT                  │
│                                          │
│              conteúdo/feed               │
│                                          │
├──────────────────────────────────────────┤
│ 🏠 Home │ 🏋️ Treino │ ➕ │ 👥 Social │ 👤 │
└──────────────────────────────────────────┘

Sugestão final:

Home

Treino

Botão central

Social

Perfil

Nutrição e progresso podem ser acessados pela Home/Perfil e posteriormente ganhar áreas próprias caso os testes indiquem necessidade.

5. Fluxo de entrada
5.1 Cliente existente
Compra na Soldiers
       ↓
Shopify
       ↓
Integração
       ↓
Cliente identificado
       ↓
Convite / acesso ao app
       ↓
Cadastro/login
       ↓
Onboarding
       ↓
Perfil personalizado

5.2 Novo cliente
Novo pedido Shopify
       ↓
Webhook
       ↓
Backend
       ↓
Customer identificado/criado
       ↓
Acesso liberado
       ↓
Convite enviado

6. Autenticação
Tela 01 — Splash
Elementos:

Logo Soldiers

Animação curta

Verificação de sessão

Verificação de acesso

Estados:

carregando

usuário autenticado

usuário não autenticado

acesso inválido

erro de conexão

Tela 02 — Login
Opções:

Continuar com Apple

Continuar com Google

E-mail

Recuperar acesso

Texto:

Entre para continuar sua evolução.

Tela 03 — Criar conta
Campos:

nome

e-mail

senha

data de nascimento, quando necessária

aceite de termos

política de privacidade

A conta do app deve ser relacionada ao identificador do cliente Shopify quando aplicável.

7. Onboarding
O onboarding deve ser curto inicialmente e aprofundar o perfil conforme o usuário utiliza o produto.

Tela 04 — Objetivo
Qual é seu objetivo?

Opções:

Ganhar massa muscular

Aumentar força

Perder gordura

Melhorar condicionamento

Manter físico

Outro

Tela 05 — Experiência
Iniciante

Intermediário

Avançado

Tela 06 — Frequência
Quantos dias por semana você consegue treinar?

2

3

4

5

6+

Tela 07 — Tempo
Quanto tempo você normalmente tem?

Até 30 min

30–45 min

45–60 min

60–90 min

Mais de 90 min

Tela 08 — Local
Academia completa

Academia básica

Casa

Outro

Tela 09 — Equipamentos
Seleção:

barra

halteres

máquinas

cabos

smith

rack

banco

acessórios

Tela 10 — Preferências
O usuário seleciona:

exercícios favoritos

exercícios que não gosta

exercícios que não pode realizar

preferências de treino

Tela 11 — Corpo
Campos opcionais:

altura

peso

sexo

idade

medidas

percentual de gordura, se souber

Dados sensíveis devem ser tratados com cuidado e com finalidade clara.

Tela 12 — Rotina
Perguntas opcionais:

horário preferido

dias preferidos

duração habitual

frequência esperada

Tela 13 — Perfil inicial
Seu perfil está pronto.

Exemplo:

OBJETIVO
Hipertrofia

FREQUÊNCIA
4x/semana

TEMPO
45–60 min

NÍVEL
Intermediário

EQUIPAMENTO
Academia completa

CTA:

Montar meu treino

8. Home
A Home será a principal tela de retorno.

Estrutura
Bom dia, João 👋

🔥 18 semanas

Seu objetivo
Hipertrofia

────────────────────

TREINO DE HOJE

Costas + Bíceps
52 min
18 séries

[ COMEÇAR TREINO ]

────────────────────

🎯 Seu progresso

+7% volume
2 PRs esta semana

────────────────────

👥 Comunidade

Maria bateu PR no agachamento

────────────────────

🍽️ Hoje

128 / 160 g proteína

────────────────────

🤖 Coach

"Tenho uma sugestão para seu próximo treino."

9. Home adaptativa
A Home deve mudar de acordo com o usuário.

Usuário novo
Priorizar:

onboarding

primeiro treino

tutorial

criação do hábito

Usuário consistente
Priorizar:

treino

progresso

PRs

desafios

Usuário inativo
Priorizar:

retorno

próximo treino

resumo da evolução

redução de fricção

Usuário avançado
Priorizar:

métricas

volume

performance

recuperação

progressão

10. Treino
Tela 14 — Plano de treino
Exemplo:

MEU PROGRAMA

SEG
Peito + Tríceps

TER
Costas + Bíceps

QUI
Pernas

SEX
Ombros + Upper

Cada treino mostra:

duração estimada

número de exercícios

séries

grupos musculares

dificuldade estimada

11. Tela 15 — Pré-treino
PEITO + TRÍCEPS

52 min
19 séries

Hoje:

1. Supino reto
2. Supino inclinado
3. Crucifixo
4. Tríceps
5. Tríceps corda

[ COMEÇAR ]

Mostrar:

histórico

carga sugerida

objetivo do treino

observações do coach

12. Tela 16 — Execução do exercício
SUPINO RETO

Meta
3 × 8–10

Último treino
80 kg × 10
80 kg × 9
80 kg × 8

────────────────

SÉRIE 1

80 kg
10 reps
RIR 2

[ REGISTRAR ]

Depois:

+18 XP

13. Registro rápido
Interface:

carga

reps

RIR

botão concluir

Atalhos:

repetir última carga

+2,5 kg

-2,5 kg

+1 rep

-1 rep

14. Descanso
Timer automático:

DESCANSO

01:42

Próxima série:
80 kg × 8–10

[ PULAR ]

Possibilidade de:

aumentar

reduzir

pausar

ajustar descanso

15. Adaptação durante treino
O sistema analisa:

performance

RIR

fadiga

histórico

duração

volume

Pode apresentar:

Ajuste sugerido

Seu desempenho caiu nesta série. Podemos reduzir a carga do próximo exercício para manter a qualidade.

Opções:

aceitar

manter

modificar

16. Substituição de exercício
Botão:

Trocar exercício

Mostrar:

Alternativas
mesmo grupo muscular

equipamento disponível

nível de dificuldade semelhante

preferência do usuário

Exemplo:

SUPINO RETO

Substituições:

Supino com halteres
Chest press
Smith

17. Tela 17 — Finalização
TREINO CONCLUÍDO 🎉

52 minutos

19 séries

6.840 kg volume

🏆 2 PRs

🔥 +420 XP

[ COMPARTILHAR ]

[ VER MEU PROGRESSO ]

18. Progressão
O motor de progressão deve considerar:

faixa de repetições

carga

RIR

histórico

volume

consistência

objetivo

resposta individual

Exemplo:

80 kg
10 / 10 / 10
RIR ≥ 2

Sugestão:

Próximo treino: 82,5 kg

19. Histórico de exercício
Tela 18
SUPINO RETO

PR
100 kg × 4

────────────────

EVOLUÇÃO

80 kg ────────────
85 kg ───────────────
90 kg ──────────────────
95 kg ─────────────────────

Últimos treinos

09/09  90 × 6
13/09  92,5 × 5
17/09  95 × 5

Gráficos:

carga

reps

volume

1RM estimado

frequência

20. Progresso geral
Tela 19
Categorias:

Força
Supino

Agachamento

Terra

outros

Volume
semanal

mensal

anual

Consistência
treinos

frequência

streak

Corpo
peso

medidas

fotos

21. Fotos de evolução
Possibilidades:

frente

costas

lateral

Comparação:

ANTES       AGORA

[foto]      [foto]

Recursos:

slider

comparação lado a lado

histórico

Privacidade deve ser prioridade.

22. Nutrição
Tela 20 — Dashboard nutricional
HOJE

Calorias
1.850 / 2.300

Proteína
142 / 160 g

Carboidratos
190 / 260 g

Gorduras
58 / 70 g

Água
1,8 / 2,5 L

23. Registro de refeição
Opções:

pesquisar alimento

alimentos recentes

favoritos

criar refeição

código de barras, em fase posterior

foto/IA, em fase posterior

24. Meta nutricional
Metas podem ser estimadas considerando:

objetivo

peso

altura

atividade

treino

histórico

preferência

As recomendações devem ser apresentadas como estimativas e, quando houver questões clínicas ou dietas terapêuticas, direcionar para profissional habilitado.

25. Suplementação
O app pode permitir registrar:

suplemento

quantidade

horário

frequência

Exemplo:

ROTINA

07:00
Creatina

Pós-treino
Whey


A integração com os produtos da Soldiers pode inicialmente ser apenas informacional, sem transformar a área em e-commerce.

26. Social
Tela 26 — Feed
Feed personalizado:

amigos

PRs

treinos

conquistas

desafios

grupos

conteúdo educativo

Exemplo:

João
🏆 Novo PR

Supino
100 kg × 5

❤️ 23   💬 4

27. Feed "For You"
O algoritmo considera:

pessoas seguidas

grupos

exercícios favoritos

objetivos

desafios

interações

conteúdo visto

conteúdo ignorado

Controles:

Não tenho interesse

Mostrar menos

Seguir

Silenciar

28. Perfil
Tela 27
JOÃO

Nível 27
🔥 18 semanas

126 treinos
42 PRs

────────────

Força
████████░░

Consistência
█████████░

────────────

PRs
🏆 Supino
🏆 Agachamento
🏆 Remada

Abas:

atividades

evolução

conquistas

desafios

29. Seguidores
Funcionalidades:

seguir

deixar de seguir

bloquear

silenciar

seguidores

seguindo

30. Kudos / Reações
Reações rápidas:

🔥

💪

👏

🏆

❤️

Comentários opcionais.

31. Desafios
Tela 28
Categorias:

consistência

força

volume

frequência

comunidade

Exemplos:

Soldiers 30
20 treinos em 30 dias.

100K
100.000 kg de volume.

4x4
4 treinos por semana durante 4 semanas.

32. Desafio individual
SOLDIERS 30

17 / 20 treinos

█████████████████░░░

Você
17

João
15

Maria
14

[ CONVIDAR AMIGOS ]

33. Grupos
Tipos:

públicos

privados

por convite

Exemplos:

Hipertrofia

Powerlifting

Iniciantes

Academia

Grupo de amigos

34. Comunidade da academia
Opcional para fase posterior.

Usuários podem selecionar:

Minha academia

E acessar:

membros

desafios

atividades

eventos

grupos

Evitar rankings baseados exclusivamente em carga absoluta.

35. Gamificação
XP
Ganhar XP por:

completar treino

completar séries

cumprir meta

registrar alimentação

completar desafio

bater PR

manter consistência

Evitar recompensar excessivamente simples abertura do aplicativo.

36. Níveis
Exemplo:

Nível 1
Recruta

Nível 5
Soldier

Nível 10
Warrior

Nível 20
Elite

Nível 50
Legend

Os nomes podem ser definidos posteriormente com a identidade da marca.

37. Streak
Streaks possíveis:

semanas treinando

meta semanal

desafios

consistência

Não usar apenas:

"abriu o app"

38. Conquistas
Exemplos:

🏆 Primeiro treino

🏆 Primeiro PR

🔥 7 dias

🔥 30 dias

💯 100 treinos

🏋️ 100.000 kg

🎯 Primeiro desafio

🤝 Primeiro amigo

39. Coach / IA
A IA não deve ser um chatbot isolado.

Ela deve acessar dados estruturados do usuário.

Exemplos de perguntas
Por que minha carga mudou?

Como estou evoluindo?

Por que meu treino foi alterado?

Quantos treinos fiz este mês?

Onde estou evoluindo mais?

O que mudou nas últimas 8 semanas?

40. Coach proativo
A IA pode aparecer quando detectar algo relevante.

Exemplo:

Percebemos uma mudança

Seu volume aumentou 21% nas últimas três semanas.

Você também registrou recuperação menor nos últimos dias.

Ver análise

41. Explicação das recomendações
Toda recomendação relevante deve permitir:

Por quê?

Exemplo:

Reduzimos o volume de pernas porque seu desempenho caiu nas últimas duas sessões e você registrou recuperação abaixo do habitual.

42. Motor de hiperpersonalização
O coração do produto.

USER PROFILE
      ↓
GOAL
      ↓
TRAINING HISTORY
      ↓
PERFORMANCE
      ↓
RECOVERY
      ↓
ADHERENCE
      ↓
PREFERENCES
      ↓
BEHAVIOR
      ↓
PERSONALIZATION ENGINE
      ↓
RECOMMENDATION

43. Perfil vivo
O perfil deve evoluir automaticamente.

Training Profile
├── força
├── volume tolerado
├── frequência
├── recuperação
├── resposta por exercício
└── preferências

Behavior Profile
├── horário
├── duração
├── aderência
├── conteúdo
└── social

Nutrition Profile
├── calorias
├── proteína
├── refeições
└── aderência

44. Personalização de treino
O sistema pode adaptar:

exercícios

ordem

volume

repetições

carga

descanso

frequência

dificuldade

Sempre com regras claras e possibilidade de ajuste manual.

45. Personalização da Home
Exemplo:

Usuário consistente:

Próximo treino + PRs + progresso

Usuário retornando:

Retomar treino + evolução

Usuário avançado:

métricas + performance

Usuário social:

feed + desafios

46. Personalização do feed
O sistema aprende:

quem o usuário acompanha

quais posts visualiza

quais ignora

quais conteúdos compartilha

quais grupos frequenta

quais desafios participa

47. Personalização de desafios
Exemplo:

Usuário iniciante:

Complete 8 treinos este mês.

Usuário avançado:

Aumente seu volume de puxada em 5%.

Usuário social:

Convide 3 amigos para um desafio.

48. Notifications
Categorias:

Treino
Seu treino está programado para hoje.

Progresso
Você está perto de bater seu PR.

Social
João reagiu ao seu treino.

Desafio
Você está a 2 treinos de completar o desafio.

Coach
Detectamos uma mudança no seu desempenho.

Evitar notificações excessivas.

49. Resumo semanal
Tela 30
SEU RESUMO

4 treinos
19 séries médias
3 PRs

Volume
+8%

Consistência
100%

────────────────

MELHOR EVOLUÇÃO

Supino
+5 kg

────────────────

COACH

"Seu desempenho melhorou..."

50. Resumo mensal
SETEMBRO

16 treinos

43.280 kg

7 PRs

+12% volume

4 semanas consistentes

Pode gerar card compartilhável.

51. Compartilhamento
Após o treino:

Criar card

Formatos:

story

feed

imagem

link

Cards:

treino

PR

streak

desafio

evolução

52. Shopify / Integração
A Shopify será a fonte comercial dos clientes.

Dados necessários
shopify_customer_id
email
nome
created_at
first_purchase_at
last_purchase_at
orders_count

Evitar copiar dados desnecessários.

53. Webhooks
Eventos relevantes:

customer/create
customer/update

order/create
order/paid

customer/delete

Os eventos exatos devem ser definidos conforme a configuração da loja e a versão das APIs utilizada.

54. Entitlements
Tabela conceitual:

user_entitlements

user_id
entitlement
status
source
granted_at
expires_at

Exemplo:

user_id: 123

entitlement:
soldiers_app

status:
active

source:
shopify_purchase

55. Separação de dados
Comercial
Shopify:

cliente

pedidos

compras

Fitness
App:

treino

peso

performance

nutrição

Social
App:

posts

seguidores

comentários

desafios

56. Backend
Sugestão inicial:

Mobile
   ↓
API
   ↓
Backend
   ├── Auth
   ├── Users
   ├── Training
   ├── Nutrition
   ├── Social
   ├── Gamification
   ├── Personalization
   ├── AI
   ├── Notifications
   └── Shopify Integration

57. Banco de dados
Entidades principais:

users
profiles
goals
preferences

workout_plans
workouts
workout_exercises
exercises
sets
exercise_history

body_metrics
body_measurements
progress_photos

foods
meals
meal_items
nutrition_goals

supplements

posts
comments
reactions
follows
groups
group_members

challenges
challenge_members
challenge_progress

achievements
user_achievements
xp_events
levels

notifications

shopify_customers
user_entitlements
integration_events

personalization_profiles
recommendations
recommendation_feedback

ai_conversations
ai_messages

58. Event tracking
Registrar eventos como:

app_opened
onboarding_completed

workout_started
set_completed
workout_completed

pr_created
exercise_replaced

meal_logged
weight_updated

challenge_joined
challenge_completed

post_created
post_liked
user_followed

recommendation_seen
recommendation_accepted
recommendation_rejected

Isso alimentará o sistema de personalização.

59. Sistema de feedback
Toda recomendação pode ter:

👍 Faz sentido

👎 Não faz sentido

Por quê?

Motivos:

muito difícil

muito fácil

não gosto

não tenho equipamento

estou sem tempo

outro

Isso permite que o algoritmo aprenda rapidamente.

60. Segurança
Prioridades:

autenticação segura

autorização por usuário

criptografia

logs

rate limiting

proteção de APIs

segregação de dados

backups

controle de acesso administrativo

61. LGPD
O projeto deve ser desenvolvido considerando:

consentimento quando necessário

finalidade de tratamento

minimização de dados

transparência

exclusão

correção

portabilidade quando aplicável

segurança

política de privacidade

controle de dados sensíveis

Especialmente importante para:

peso

medidas

fotos corporais

alimentação

dados relacionados à saúde

62. Admin Dashboard
Criar um painel administrativo separado.

Dashboard
Métricas:

usuários

usuários ativos

novos usuários

treinos

retenção

PRs

desafios

posts

63. Gestão de usuários
Admin pode:

pesquisar usuário

visualizar status

bloquear

suspender

conceder acesso

remover acesso

visualizar histórico de integração

Não permitir acesso indiscriminado a dados pessoais sensíveis.

64. Gestão de exercícios
Admin:

criar

editar

desativar

categorizar

adicionar vídeo

adicionar músculos

definir alternativas

65. Gestão de treinos
Possibilidade de criar:

programas

templates

exercícios

regras

níveis

66. Gestão de desafios
Admin pode:

criar desafio

definir duração

definir objetivo

definir regras

definir recompensa

acompanhar participantes

67. Gestão social
Moderadores podem:

denunciar conteúdo

remover conteúdo

suspender usuário

bloquear termos

revisar denúncias

68. CMS de conteúdo
Criar conteúdo:

artigos

vídeos

dicas

educação nutricional

técnica de exercícios

recuperação

motivação

O conteúdo pode ser direcionado por perfil.

69. Feed de conteúdo
O sistema pode recomendar:

objetivo
+
nível
+
interesse
+
comportamento

Exemplo:

Usuário iniciante interessado em hipertrofia:

Como progredir carga

Usuário avançado:

Controle de volume

70. Sistema de moderação
Necessário desde o lançamento social.

Recursos:

denunciar

bloquear

silenciar

remover

revisão administrativa

histórico de moderação

71. Privacidade social
Configurações:

Perfil
público

privado

Treinos
público

amigos

privado

Peso
sempre privado por padrão

Fotos
privado por padrão

Nutrição
privado por padrão

PRs
público/amigos/privado

72. MVP
Não construir tudo inicialmente.

MVP 1
Obrigatório
login

integração Shopify

onboarding

perfil

treino

exercícios

séries

carga

reps

RIR

histórico

progressão

PRs

gamificação básica

Home

notificações

analytics

73. MVP 2
Adicionar:

feed

seguidores

perfil social

reações

desafios

conquistas

compartilhamento

grupos

74. MVP 3
Adicionar:

nutrição

refeições

macros

água

peso

suplementação

gráficos

75. MVP 4
Adicionar:

IA Coach

personalização avançada

recomendações

feed inteligente

desafios personalizados

adaptação avançada do treino

76. Roadmap
Fase 1 — Fundação
arquitetura

autenticação

Shopify

banco

backend

analytics

Fase 2 — Treino
exercícios

programas

execução

progressão

histórico

Fase 3 — Gamificação
XP

níveis

streak

PRs

conquistas

Fase 4 — Social
feed

seguidores

desafios

grupos

Fase 5 — Nutrição
refeições

macros

peso

água

Fase 6 — Personalização
motor de regras

perfil vivo

recomendações

feedback

Fase 7 — IA
Coach

análise

explicações

interação natural

77. Métricas principais
Ativação
cadastro → onboarding completo

onboarding → primeiro treino

primeiro treino → segundo treino

Retenção
D1

D7

D30

D90

Treino
treinos por usuário

séries registradas

PRs

frequência

Social
posts

reações

comentários

seguidores

desafios

Nutrição
refeições registradas

dias completos

aderência

Personalização
recomendações aceitas

recomendações rejeitadas

feedback

melhora de aderência

78. North Star Metric
Uma métrica possível:

Usuários que completam pelo menos 3 sessões significativas de evolução por semana.

Uma sessão significativa pode incluir:

treino registrado

progresso atualizado

desafio

acompanhamento nutricional

O objetivo é medir valor real, não simplesmente abertura do aplicativo.

79. Loop principal do produto
                 OBJETIVO
                    ↓
                 TREINO
                    ↓
                REGISTRO
                    ↓
                PROGRESSO
                    ↓
              RECOMPENSA
                    ↓
                 SOCIAL
                    ↓
                DESAFIO
                    ↓
              MOTIVAÇÃO
                    ↓
              NOVO TREINO
                    ↓
            MAIS DADOS
                    ↓
           PERSONALIZAÇÃO
                    ↓
          EXPERIÊNCIA MELHOR
                    ↓
                RETORNO

80. Visão final do produto
O Soldiers App deve evoluir de:

App de treino

para:

Plataforma social personalizada de evolução física.

O diferencial não será ter simplesmente mais exercícios, mais macros ou mais funcionalidades.

Será a combinação:

                 SOLDIERS
                     │
        ┌────────────┼────────────┐
        │            │            │
      TREINO      NUTRIÇÃO      SOCIAL
        │            │            │
        └────────────┼────────────┘
                     ↓
              DADOS DO USUÁRIO
                     ↓
           PERSONALIZAÇÃO CONTÍNUA
                     ↓
                 COACH IA
                     ↓
              EXPERIÊNCIA ÚNICA
                     ↓
                MAIS ADERÊNCIA
                     ↓
               MAIS EVOLUÇÃO

Posicionamento
Soldiers — seu treino, sua evolução, sua comunidade.

Loop emocional
“Eu estou evoluindo.”

Essa deve ser a sensação que o aplicativo entrega toda vez que o usuário abre o produto.