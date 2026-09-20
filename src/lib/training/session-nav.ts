/**
 * Session deep-link helpers — home CTA and living-plan recommendations.
 */

export function sessionHref(dayId: string, express = false): string {
  const id = dayId.replace(/-express$/, "");
  return express ? `/treino/sessao/${id}?express=true` : `/treino/sessao/${id}`;
}

export function parseSessionHref(href?: string | null): { id: string; express: boolean } | null {
  if (!href) return null;
  const match = href.match(/^\/treino\/sessao\/([^/?#]+)(?:\?(.*))?$/);
  if (!match?.[1]) return null;
  const id = decodeURIComponent(match[1]).replace(/-express$/, "");
  const query = match[2] ?? "";
  const express = /(?:^|&)express=(true|1)/i.test(query);
  return { id, express };
}

export const APP_PATHS = [
  "/",
  "/treino",
  "/nutricao",
  "/suplementos",
  "/coach",
  "/progresso",
  "/social",
  "/perfil",
  "/desafios",
  "/hubs",
  "/conteudo",
] as const;

export function isAppPath(href?: string | null): href is (typeof APP_PATHS)[number] {
  return Boolean(href && (APP_PATHS as readonly string[]).includes(href));
}
