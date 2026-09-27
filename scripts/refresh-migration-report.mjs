/**
 * Probe AI tables via service_role and refresh readiness report.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function loadEnv(path = ".env") {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const TABLES = [
  "ai_audit_events",
  "ai_user_memory",
  "ai_decision_memory",
  "ai_outcome_memory",
  "ai_learning_events",
  "ai_knowledge_sources",
  "ai_knowledge_documents",
  "ai_knowledge_chunks",
];

const env = loadEnv();
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

const tables = [];
for (const table of TABLES) {
  const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const status = r.status === 200 ? "applied" : r.status === 404 ? "missing" : "unavailable";
  tables.push({ table, status, detail: r.status === 200 ? undefined : `HTTP ${r.status}` });
  console.log(`${table}: ${status}`);
}

const all_applied = tables.every((t) => t.status === "applied");
const any_unavailable = tables.some((t) => t.status === "unavailable");
const migrations = {
  checked_at: new Date().toISOString(),
  tables,
  all_applied,
  any_unavailable,
};

const md = `# AI Production Readiness Report

Generated: ${migrations.checked_at}
Report version: fase21_v1
**production_ready: ${all_applied ? "true (migrations verified)" : "false"}**

## Migrations probe (remote Fit Companion \`zphtvrsxlhfgltwgbreu\`)

| Table | Status |
|-------|--------|
${tables.map((t) => `| \`${t.table}\` | **${t.status}** |`).join("\n")}

\`\`\`json
${JSON.stringify(migrations, null, 2)}
\`\`\`

## Deploy notes (2026-09-27)

- FASE 9 memory + FASE 11 \`ai_audit_events\` — already present
- FASE 16 \`ai_knowledge_*\` + \`vector\` — **applied** via SQL Editor
- FASE 19 \`ai_audit_events_kind_check\` (+ \`ai_gateway\`, \`proposal_merge\`) — **applied** via SQL Editor

## Checklist (code certification)

Run \`npm run cert:ai\` for local suites. Critical security/authz/integrity suites remain in \`src/ai/certification/\`.

> Migrations remotas verificadas via service_role REST probe (HTTP 200 = applied).
`;

writeFileSync(join("docs", "AI_PRODUCTION_READINESS_REPORT.md"), md, "utf8");
console.log("wrote docs/AI_PRODUCTION_READINESS_REPORT.md");
console.log("all_applied=", all_applied);
