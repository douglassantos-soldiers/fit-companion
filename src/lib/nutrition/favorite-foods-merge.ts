/** Favorite food id list merge (P1 polish). */
export function mergeFavoriteFoodIds(local?: string[], remote?: string[], cap = 60): string[] {
  return [...new Set([...(remote ?? []), ...(local ?? [])])].slice(0, cap);
}
