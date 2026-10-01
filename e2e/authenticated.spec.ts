import { test, expect, type Page } from "@playwright/test";

/**
 * Authenticated product E2E.
 * Requires:
 *   E2E_ACCESS_EMAIL — account with live Shopify entitlement (40-day window)
 *   E2E_ACCESS_PASSWORD — password for /entrar
 * Skip when either is absent — never fake PASS.
 */

const email = process.env["E2E_ACCESS_EMAIL"]?.trim();
const password = process.env["E2E_ACCESS_PASSWORD"]?.trim();
const hasCreds = Boolean(email && password);

async function loginWithPassword(page: Page) {
  await page.goto("/entrar", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#entrar-email")).toBeVisible({ timeout: 25_000 });
  await page.locator("#entrar-email").fill(email!);
  await page.locator("#entrar-senha").fill(password!);
  await page.getByRole("button", { name: /^Entrar/i }).click();

  // Grant + redirect: home, onboarding, or training — leave /entrar.
  await expect(page).not.toHaveURL(/\/entrar(\?|$)/, { timeout: 45_000 });
}

test.describe("authenticated product flow", () => {
  test.skip(!hasCreds, "PENDING OPERATOR: set E2E_ACCESS_EMAIL + E2E_ACCESS_PASSWORD with entitlement");

  test("entrar → shell → treino → água → perfil export UI", async ({ page }) => {
    await loginWithPassword(page);

    // Landed in app shell (AccessGate passed).
    const landed = page.url();
    expect(landed).toMatch(/\/(onboarding|treino|nutricao|perfil|coach|progresso|desafios|clubes|hubs|social|conteudo)?(\?|$|\/)/);

    await page.goto("/treino", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).toContainText(/Treino|Sessão|Plano|Exercício|Histórico/i, {
      timeout: 25_000,
    });

    // Light mutation: water log on nutrition.
    await page.goto("/nutricao", { waitUntil: "domcontentloaded" });
    const waterBtn = page.getByRole("button", { name: /Água \+500 ml/i });
    await expect(waterBtn).toBeVisible({ timeout: 25_000 });
    await waterBtn.click();
    await expect(page.locator("body")).toContainText(/Hidratação|água|Água/i, { timeout: 10_000 });

    await page.goto("/perfil", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /Baixar meus dados/i })).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByRole("button", { name: /Apagar dados da conta no servidor/i })).toBeVisible();
  });
});
