import { readFileSync } from "node:fs";

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

const env = loadEnv();
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const tables = [
  "ai_audit_events",
  "ai_user_memory",
  "ai_decision_memory",
  "ai_outcome_memory",
  "ai_learning_events",
  "ai_knowledge_sources",
  "ai_knowledge_documents",
  "ai_knowledge_chunks",
];

for (const t of tables) {
  const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = r.status >= 400 ? (await r.text()).slice(0, 200) : "ok";
  console.log(`${t}: HTTP ${r.status} ${body}`);
}
