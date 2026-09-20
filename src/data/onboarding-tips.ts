export interface OnboardingTip {
  id: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaTo: "/" | "/treino" | "/nutricao" | "/suplementos" | "/clubes" | "/social" | "/coach" | "/progresso" | "/perfil";
  minDay: number;
}

export const ONBOARDING_TIPS: OnboardingTip[] = [
  {
    id: "tip-first-session",
    title: "Primeiro treino",
    body: "Abra Treino e complete pelo menos uma série. O streak começa hoje.",
    ctaLabel: "Ir treinar",
    ctaTo: "/treino",
    minDay: 0,
  },
  {
    id: "tip-log-meal",
    title: "Registre uma refeição",
    body: "A proteína do dia aparece no Resumo. Use Registrar refeição na Home.",
    ctaLabel: "Nutrição",
    ctaTo: "/nutricao",
    minDay: 1,
  },
  {
    id: "tip-water",
    title: "Hidratação conta",
    body: "Toque Água +500 no Status. Meta diária ajuda recuperação e score.",
    ctaLabel: "Ver Hoje",
    ctaTo: "/",
    minDay: 1,
  },
  {
    id: "tip-supplements",
    title: "Monte a rotina",
    body: "Pelo Perfil → Suplementos, marque as doses do dia.",
    ctaLabel: "Suplementos",
    ctaTo: "/suplementos",
    minDay: 2,
  },
  {
    id: "tip-coach",
    title: "Fale com o Coach",
    body: "Na aba Coach pergunte o treino de hoje ou ajuste de volume — respostas com base nos seus dados.",
    ctaLabel: "Abrir Coach",
    ctaTo: "/coach",
    minDay: 2,
  },
  {
    id: "tip-progress",
    title: "Olhe o Progresso",
    body: "Volume, heatmap e PRs ficam na aba Progresso.",
    ctaLabel: "Progresso",
    ctaTo: "/progresso",
    minDay: 3,
  },
  {
    id: "tip-club",
    title: "Entre no Social",
    body: "Desafios, clubes e feed na aba Social.",
    ctaLabel: "Social",
    ctaTo: "/social",
    minDay: 5,
  },
  {
    id: "tip-reminders",
    title: "Lembrete do dia",
    body: "Ative notificações no Perfil para não perder o horário de treino.",
    ctaLabel: "Perfil",
    ctaTo: "/perfil",
    minDay: 2,
  },
  {
    id: "tip-streak",
    title: "Proteja o streak",
    body: "Mesmo 10 minutos contam. Se o banner amarelo aparecer, treine hoje.",
    ctaLabel: "Treinar",
    ctaTo: "/treino",
    minDay: 4,
  },
];
