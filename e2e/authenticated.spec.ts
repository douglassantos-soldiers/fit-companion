import { test, expect } from "@playwright/test";

/**
 * Authenticated E2E scaffold.
 * Requires E2E_ACCESS_EMAIL (+ live entitlement / magic access path).
 * Until wired end-to-end, stays skipped — never fake PASS.
 */

const email = process.env["E2E_ACCESS_EMAIL"]?.trim();

test.describe("authenticated product flow", () => {
  test.skip(!email, "PENDING OPERATOR: set E2E_ACCESS_EMAIL with Shopify entitlement");

  test("acesso → home → treino shell", async ({ page }) => {
    await page.goto("/acesso", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    // Operator must complete redeem/login before asserting app shell.
    test.info().annotations.push({
      type: "pending_operator",
      description: "Wire magic token / password login then assert /treino",
    });
  });

  test("export + account deletion UI reachable when session exists", async ({ page }) => {
    await page.goto("/perfil", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    test.info().annotations.push({
      type: "pending_operator",
      description: "Assert export download + wipe confirmation with controlled user",
    });
  });
});
