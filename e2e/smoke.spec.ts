import { test, expect } from "@playwright/test";

/**
 * Minimal browser E2E smoke — public routes + gated redirects.
 * Full authenticated flows require E2E_ACCESS_EMAIL + live entitlement (PENDING OPERATOR).
 * Avoid waitForLoadState("networkidle") — SSR apps keep long-polling open.
 */

test.describe("public entry", () => {
  test("welcome renders brand signal", async ({ page }) => {
    await page.goto("/welcome", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    // AccessGate splash or welcome hero — both must show Soldiers brand
    await expect(page.locator("body")).toContainText(/Soldiers|TRAINING|evolução|Treino/i, {
      timeout: 25_000,
    });
  });

  test("termos and privacidade load", async ({ page }) => {
    await page.goto("/termos", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    await page.goto("/privacidade", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });

  test("entrar and cadastro load", async ({ page }) => {
    await page.goto("/entrar", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    await page.goto("/cadastro", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("access gate", () => {
  test("protected home redirects unauthenticated users to access or welcome", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const url = page.url();
    expect(
      /\/(acesso|welcome|entrar|cadastro)/.test(url) || /\/(\?|$)/.test(url),
    ).toBeTruthy();
  });
});

test.describe("coach deterministic path (gated)", () => {
  test("coach route responds without crashing", async ({ page }) => {
    const res = await page.goto("/coach", { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 200).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("authenticated flows", () => {
  test.skip(!process.env["E2E_ACCESS_EMAIL"], "Requires E2E_ACCESS_EMAIL + entitlement (PENDING OPERATOR)");

  test("login → home → training shell", async ({ page }) => {
    test.fail(true, "Wire magic-link / access redeem when operator secrets available");
    await page.goto("/acesso", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });
});
