export interface SupplementProduct {
  id: string;
  name: string;
  category: string;
  timing: string;
  serving: string;
  use: string;
  goals: Array<"massa" | "gordura" | "performance" | "saude">;
}

export const PRODUCTS: SupplementProduct[] = [
  {
    id: "whey-protein",
    name: "Whey Protein",
    category: "Proteína",
    timing: "Pós-treino",
    serving: "30 g",
    use: "Ajuda a completar a proteína do dia depois do treino.",
    goals: ["massa", "gordura", "performance", "saude"],
  },
  {
    id: "creatina",
    name: "Creatina Monoidratada",
    category: "Performance",
    timing: "Qualquer horário",
    serving: "5 g",
    use: "Uso diário e contínuo, inclusive em dias sem treino.",
    goals: ["massa", "performance"],
  },
  {
    id: "beef-protein",
    name: "Beef Protein",
    category: "Proteína",
    timing: "Entre refeições",
    serving: "30 g",
    use: "Alternativa de proteína para quem evita lactose.",
    goals: ["massa", "gordura"],
  },
  {
    id: "pre-treino",
    name: "Pré-treino Striker",
    category: "Energia",
    timing: "30 min antes do treino",
    serving: "1 dose",
    use: "Use em treinos mais intensos e evite perto do horário de dormir.",
    goals: ["performance", "massa"],
  },
  {
    id: "multivitaminico",
    name: "Multivitamínico",
    category: "Saúde",
    timing: "Café da manhã",
    serving: "1 cápsula",
    use: "Apoio à dieta no dia a dia.",
    goals: ["saude", "gordura", "massa", "performance"],
  },
  {
    id: "omega-3",
    name: "Ômega 3",
    category: "Saúde",
    timing: "Almoço",
    serving: "2 cápsulas",
    use: "Complemento de gorduras boas na alimentação.",
    goals: ["saude", "performance"],
  },
  {
    id: "termogenico",
    name: "Termogênico",
    category: "Definição",
    timing: "Manhã",
    serving: "1 cápsula",
    use: "Combine com déficit calórico e evite doses à noite.",
    goals: ["gordura"],
  },
  {
    id: "glutamina",
    name: "Glutamina",
    category: "Recuperação",
    timing: "Antes de dormir",
    serving: "5 g",
    use: "Parte da rotina de recuperação em fases de volume alto.",
    goals: ["performance", "massa"],
  },
];

export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);
