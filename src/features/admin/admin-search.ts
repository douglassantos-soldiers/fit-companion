import {
  ADMIN_CATALOG_TABS,
  ADMIN_OPS_TABS,
  type AdminTabId,
} from "@/features/admin/nav";

const TAB_IDS = new Set<string>([
  ...ADMIN_OPS_TABS.map((t) => t.id),
  ...ADMIN_CATALOG_TABS.map((t) => t.id),
]);

export function parseAdminTab(raw: unknown): AdminTabId | undefined {
  if (typeof raw !== "string") return undefined;
  return TAB_IDS.has(raw) ? (raw as AdminTabId) : undefined;
}

export function parseAdminEmail(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const e = raw.trim().toLowerCase();
  if (!e.includes("@") || e.length > 160) return undefined;
  return e;
}

export type AdminSearch = {
  tab?: AdminTabId;
  email?: string;
};

export function parseAdminSearch(search: Record<string, unknown>): AdminSearch {
  const out: AdminSearch = {};
  const tab = parseAdminTab(search["tab"]);
  const email = parseAdminEmail(search["email"]);
  if (tab) out.tab = tab;
  if (email) out.email = email;
  return out;
}

export function buildAdminSearch(opts: {
  tab?: AdminTabId;
  email?: string | null;
}): AdminSearch {
  const out: AdminSearch = {};
  if (opts.tab) out.tab = opts.tab;
  const e = opts.email?.trim().toLowerCase();
  if (e?.includes("@")) out.email = e;
  return out;
}
