/** Bottom-nav tab matching — kept pure for tests. */

export function resolveTabKey(pathname: string): string {
  if (pathname === "/" || pathname === "") return "/";
  // Coach is a Hoje satellite — keep "Hoje" highlighted to avoid nav limbo.
  if (pathname.startsWith("/coach")) return "/";
  if (pathname.startsWith("/social") || pathname.startsWith("/desafios") || pathname.startsWith("/hubs")) {
    return "/social";
  }
  if (pathname.startsWith("/progresso")) return "/progresso";
  if (pathname.startsWith("/nutricao") || pathname.startsWith("/suplementos")) return "/nutricao";
  if (pathname.startsWith("/treino")) return "/treino";
  return "";
}
