/**
 * Memory id helpers.
 */

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) + h + str.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16);
}

export function newMemoryId(parts?: { userId?: string; family?: string; type?: string }): string {
  const salt = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  if (!parts) return `mem_${salt}`;
  return `mem_${djb2([parts.userId ?? "", parts.family ?? "", parts.type ?? "", salt].join("|"))}`;
}
