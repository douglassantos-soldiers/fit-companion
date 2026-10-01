/**
 * Shopify webhook HMAC reject + cron unauthorized smoke against published APP_ORIGIN.
 * Full authorized cron requires CRON_SECRET; invalid HMAC proves webhook gate is live.
 */
import { createHmac } from "node:crypto";
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const origin = (
  process.env["APP_ORIGIN"]?.trim() ||
  "https://soldiers-performance.lovable.app"
).replace(/\/$/, "");
const shopifySecret = process.env["SHOPIFY_WEBHOOK_SECRET"]?.trim() ?? "";
const cronSecret = process.env["CRON_SECRET"]?.trim() ?? "";

const body = JSON.stringify({
  id: 9000000001,
  email: "shopify-smoke@soldiers-test.invalid",
  financial_status: "paid",
  created_at: new Date().toISOString(),
  line_items: [],
});

const badRes = await fetch(`${origin}/api/shopify/webhook`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Shopify-Hmac-Sha256": "invalid",
    "X-Shopify-Topic": "orders/paid",
  },
  body,
});

let goodStatus = null;
if (shopifySecret) {
  const hmac = createHmac("sha256", shopifySecret).update(body, "utf8").digest("base64");
  const goodRes = await fetch(`${origin}/api/shopify/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Hmac-Sha256": hmac,
      "X-Shopify-Topic": "orders/paid",
      "X-Shopify-Webhook-Id": `smoke-${Date.now()}`,
      "X-Shopify-Shop-Domain": "soldiers-smoke.myshopify.com",
    },
    body,
  });
  goodStatus = goodRes.status;
}

const unauthCron = await fetch(`${origin}/api/cron/daily-pushes`, { method: "POST" });
let authCron = null;
if (cronSecret) {
  const cronRes = await fetch(`${origin}/api/cron/daily-pushes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  authCron = cronRes.status;
}

// PASS criteria for beta: invalid HMAC rejected + cron rejects missing auth.
const rejectOk = badRes.status === 401 || badRes.status === 503;
const cronOk = unauthCron.status === 401;
const ok = rejectOk && cronOk;

const at = new Date().toISOString();
const detail = `origin=${origin} bad_hmac=${badRes.status} good_hmac=${goodStatus ?? "skipped_no_local_secret"} cron_unauth=${unauthCron.status} cron_auth=${authCron ?? "skipped_no_cron_secret"}`;

const proofsPath = join(process.cwd(), "docs", "certification", "operator-live-proofs.json");
let proofs = existsSync(proofsPath) ? JSON.parse(readFileSync(proofsPath, "utf8")) : {};
proofs.shopify_cron_staging = {
  status: ok ? "pass" : "fail",
  at,
  detail,
};
mkdirSync(join(process.cwd(), "docs", "certification"), { recursive: true });
writeFileSync(proofsPath, `${JSON.stringify(proofs, null, 2)}\n`);
console.log(JSON.stringify({ ok, bad: badRes.status, goodStatus, unauthCron: unauthCron.status, authCron, detail }, null, 2));
process.exit(ok ? 0 : 1);
