# Soldiers Training — Fase 1 (sem login)

App mobile-first de performance com a identidade Soldiers (preto + amarelo, tipografia condensada em caixa alta), inspirado em MyFitnessPal, Strava, Noom, Freeletics, Fitbod e Nike Training Club.

Nesta fase tudo funciona sem cadastro: os dados ficam salvos no próprio aparelho do usuário. Nada de banco de dados, Shopify ou membership por enquanto.

## Telas

1. **Onboarding (primeira abertura)**
   Objetivo (ganhar massa, perder gordura, performance, saúde), nível, dias disponíveis por semana, peso/altura/idade, equipamento (casa ou academia), restrições. No fim, gera o "Perfil de Performance" com pontuação por dimensão (força, resistência, consistência, recuperação, nutrição).

2. **Hoje**
   Cartão do próximo passo (treino do dia ou descanso ativo), anéis de progresso do dia, sugestão de suplemento no horário certo, streak, atalhos rápidos (registrar peso, água, refeição).

3. **Treino**
   Plano semanal gerado a partir do perfil. Tela de execução: lista de exercícios, séries/reps/carga, cronômetro de descanso, marcar série concluída, sugestão automática de carga na próxima sessão (estilo Fitbod). Histórico de sessões.

4. **Progresso**
   Gráficos de peso, volume de treino por semana, consistência (calendário de treinos), recordes pessoais por exercício, evolução das dimensões do perfil.

5. **Desafios**
   Lista de desafios (ex.: 21 dias de consistência, 100 km, volume total), barra de progresso, ranking simulado, entrar/sair, badge ao concluir.

6. **Suplementação**
   Rotina diária com horários, marcar como tomado, aderência do mês, catálogo dos produtos Soldiers com uso recomendado. Sem alegações de saúde não comprovadas.

7. **Coach**
   Coach em formato de conversa com respostas baseadas em regras: lê os dados do usuário (treinos, peso, aderência, streak) e responde com o próximo passo, ajustes de plano e perguntas rápidas em botões. Ainda não é IA generativa — isso entra quando o backend for ligado.

8. **Perfil**
   Dados pessoais, metas, preferências, tema, reiniciar dados.

## Navegação

Barra inferior fixa: Hoje · Treino · Progresso · Desafios · Coach. Suplementos e Perfil acessíveis pelo topo.

## Identidade visual

Fundo preto profundo, cartões grafite, amarelo Soldiers como cor de ação e destaque, títulos condensados em caixa alta, texto de apoio em cinza claro. Logo Soldiers no topo. Transições curtas e táteis, sensação de "app de treino", não de painel corporativo.

## Detalhes técnicos

- Rotas TanStack Start: `/` (Hoje, com redirecionamento para onboarding se não houver perfil), `/onboarding`, `/treino`, `/treino/sessao/$id`, `/progresso`, `/desafios`, `/suplementos`, `/coach`, `/perfil`. Cada rota com `head()` própio.
- Estado em store local (`localStorage`) com hooks tipados; catálogo de exercícios, produtos e desafios como dados estáticos em `src/data/`.
- Motor de personalização puro em TypeScript (`src/lib/engine/`): perfil → plano semanal → progressão de carga → dimensões de performance. Espelha as regras do documento para migrar fácil para o backend depois.
- Tokens de cor/tipografia em `src/styles.css`; gráficos com Recharts; logo Soldiers publicada como asset.

## Fora desta fase

Login, banco de dados, Shopify, membership PRO, IA generativa, ranking real entre usuários, notificações push. Todas essas partes exigem backend e entram numa fase seguinte.
