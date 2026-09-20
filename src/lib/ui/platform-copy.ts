/** Fase 17 — glossário PT da plataforma (sem i18n framework). */

export const MIN_PASSWORD_LENGTH = 8;

export const SHARE_KIND_LABEL = {
  treino: "Treino",
  pr: "PR",
  streak: "Sequência",
  desafio: "Desafio",
  evolucao: "Evolução",
  prova: "Prova",
} as const;

export const SHARE_CARD_EYEBROW = "Card Soldiers";
export const SHARE_STREAK_LABEL = "Sequência";
export const PROOF_CARD_EYEBROW = "Prova de desempenho";

export const MAGIC_TOKEN_INVALID_TITLE = "Link expirado";
export const MAGIC_TOKEN_INVALID_BODY = "Use o e-mail da compra para entrar ou criar a conta.";

export const EMPTY_FOLLOW_TITLE = "Ninguém aqui ainda";
export const EMPTY_FOLLOW_BODY = "Siga alguém do clube ou volte ao feed.";

export const EMPTY_PROFILE_TITLE = "Usuário indisponível";
export const EMPTY_PROFILE_BODY = "Perfil privado, bloqueado ou inexistente.";

export const EMPTY_RANKING_TITLE = "Ranking ainda vazio";
export const EMPTY_RANKING_BODY =
  "Auto-relato entra no ranking. Verificado quando conectar Strava ou Garmin.";

export const EMPTY_FEED_TITLE = "Siga alguém do clube ou publique um treino";
export const EMPTY_FEED_BODY = "O feed junta quem você segue, o clube e PRs públicos.";

export const EMPTY_PHOTOS_TITLE = "Ainda sem fotos";
export const EMPTY_PHOTOS_BODY =
  "Tire frente, lado ou costas para comparar e compartilhar a evolução.";

export const EMPTY_COMPARE_TITLE = "Sem comparação ainda";
export const EMPTY_COMPARE_BODY = "Tire a mesma pose em dois dias para ver o antes e agora.";

export const BARCODE_EMPTY_CAMERA =
  "Câmera não disponível neste navegador. Digite o código da embalagem.";
export const BARCODE_EMPTY_MISS = "Não encontrado. Digite o código de novo ou busque no catálogo.";
export const BARCODE_EMPTY_INVALID = "Digite um EAN-8 ou EAN-13 da embalagem.";

export const ACCESS_PAYWALL_TITLE_STALE = "Sua janela de 40 dias acabou";
export const ACCESS_PAYWALL_TITLE_NONE = "Libere o treino do dia";
export const ACCESS_PAYWALL_BODY_STALE =
  "Conta e progresso continuam guardados. Uma nova compra no mesmo e-mail reabre o app.";
export const ACCESS_PAYWALL_BODY_NONE =
  "Treino do dia, proteína, coach e streak — inclusos na sua compra Soldiers.";
export const ACCESS_PAYWALL_BENEFITS = [
  "Treino do dia (incluindo Express)",
  "Coach e plano vivo",
  "Streak, missões e ranking",
] as const;

export const PERFORMANCE_LOCK_TITLE = "Desafios da liga Performance";
export const PERFORMANCE_LOCK_BENEFITS = [
  "Liga e ranking exclusivo",
  "Desafios com prova de desempenho",
  "Pressão saudável do clube",
] as const;

export const EMPTY_RANKING_JOIN = "Entrar no desafio";
export const PUSH_AFTER_FIRST_TITLE = "Quer o lembrete de treinar amanhã?";
export const PUSH_AFTER_FIRST_BODY = "Um aviso no horário do treino — você desliga no Perfil.";

export const ACCESS_EMAIL_MISMATCH =
  "Não achamos compra paga neste e-mail. Use o mesmo endereço da loja Soldiers — um e-mail diferente não libera o app.";
export const CADASTRO_CONFIRM_TITLE = "Confirme o e-mail";
export const CADASTRO_CONFIRM_BODY =
  "Abra o link que enviamos. Depois entre com o mesmo endereço da compra na loja.";
export const PROOF_CARD_D1 = "Seu 1º treino destrava o card de prova — score, volume e PRs.";
export const SESSION_LEAVE_TITLE = "Sair do treino?";
export const SESSION_LEAVE_BODY =
  "As séries desta sessão ainda não foram salvas. Complete com o RPE para guardar volume e XP.";
export const SHARE_FIRST_WORKOUT = "Compartilhar meu 1º treino";
