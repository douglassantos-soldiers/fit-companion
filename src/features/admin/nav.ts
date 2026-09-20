export const ADMIN_OPS_TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "usuarios", label: "Usuários" },
  { id: "moderacao", label: "Moderação" },
  { id: "sistema", label: "Sistema" },
] as const;

export const ADMIN_CATALOG_TABS = [
  { id: "exercicios", label: "Exercícios" },
  { id: "programas", label: "Programas" },
  { id: "desafios", label: "Desafios" },
  { id: "conteudo", label: "Conteúdo" },
  { id: "midia", label: "Mídia" },
] as const;

export type AdminTabId =
  | (typeof ADMIN_OPS_TABS)[number]["id"]
  | (typeof ADMIN_CATALOG_TABS)[number]["id"];

export const ALL_ADMIN_TABS = [...ADMIN_OPS_TABS, ...ADMIN_CATALOG_TABS];
