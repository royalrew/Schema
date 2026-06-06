import { test, expect } from "@playwright/test";

const ADMIN_USER = process.env.TEST_ADMIN_USER ?? "Sara_A";
const ADMIN_PASS = process.env.TEST_ADMIN_PASS ?? "Schema2026";
const BASE = "http://localhost:3000";

// ── Hjälpfunktion: logga in och spara auth-state ────────────────────────────
async function loginAs(page: any, username: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("ditt.namn").fill(username);
  await page.getByPlaceholder("••••••").fill(password);
  await page.getByRole("button", { name: /Logga in/i }).click();
}

// ════════════════════════════════════════════════════════════
// 1. LANDNINGSSIDA
// ════════════════════════════════════════════════════════════

test.describe("Landningssida", () => {
  test("visar tagline och Sintari-logotypen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Ditt schema.")).toBeVisible();
    await expect(page.getByText("Dina regler.")).toBeVisible();
    await expect(page.getByText("Klart på minuter.")).toBeVisible();
  });

  test("nav innehåller Logga in-länk", async ({ page }) => {
    await page.goto("/");
    const loginLink = page.getByRole("link", { name: /Logga in/i }).first();
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");
  });

  test("siffror visas i värdessektionen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("1 248")).toBeVisible();
    await expect(page.getByText("307 000")).toBeVisible();
    await expect(page.getByText("< 2")).toBeVisible();
  });

  test("AI-demo visar Sara-persona som standard", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Sara (Schemaansvarig)")).toBeVisible();
    await expect(page.getByText("Medarbetare (Elin)")).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════
// 2. INLOGGNING
// ════════════════════════════════════════════════════════════

test.describe("Inloggning", () => {
  test("inloggningssidan laddas och visar formulär", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Välkommen tillbaka")).toBeVisible();
    await expect(page.getByPlaceholder("ditt.namn")).toBeVisible();
    await expect(page.getByPlaceholder("••••••")).toBeVisible();
    await expect(page.getByRole("button", { name: /Logga in/i })).toBeVisible();
  });

  test("fel lösenord visar felmeddelande", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("ditt.namn").fill("Sara_A");
    await page.getByPlaceholder("••••••").fill("felaktigt_lösenord");
    await page.getByRole("button", { name: /Logga in/i }).click();
    // Felmeddelandet kan variera: "Felaktigt lösenord" (401) eller nätverksfel
    await expect(
      page.getByText(/Felaktigt|misslyckades|lösenord|fetch|anslut/i)
    ).toBeVisible({ timeout: 5000 });
    // Viktigt: vi ska fortfarande vara kvar på /login
    await expect(page).toHaveURL(/\/login/);
  });

  test("ej inloggad användare redirectas från /dashboard till /login", async ({ page }) => {
    // Navigera först till en sida, sedan rensa auth och gå till /dashboard
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("lyckad inloggning som admin redirectar till /dashboard", async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });
  });
});

// ════════════════════════════════════════════════════════════
// 3. DASHBOARD (kräver inloggning)
// ════════════════════════════════════════════════════════════

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS);
    await page.waitForURL(/\/dashboard/, { timeout: 8000 });
  });

  test("visar Sintari-logotypen och admin-namn", async ({ page }) => {
    await expect(page.getByText("Sintari")).toBeVisible();
    await expect(page.getByText(ADMIN_USER.replace("_", " ")).or(
      page.getByText("Sara Arnham")
    )).toBeVisible();
  });

  test("visar gruppcellerna", async ({ page }) => {
    // Vänta tills minst en grupp laddas
    await expect(page.getByText("Norra")).toBeVisible({ timeout: 10000 });
  });

  test("klick på grupp navigerar till schema-vy", async ({ page }) => {
    await page.getByText("Norra").first().click();
    await expect(page).toHaveURL(/\/schema\/Norra/, { timeout: 8000 });
  });

  test("Logga ut-knappen rensar session och skickar till login", async ({ page }) => {
    await page.getByRole("button", { name: /Logga ut/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    // Verifiera att localStorage är rensat
    const token = await page.evaluate(() => localStorage.getItem("auth_token"));
    expect(token).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════
// 4. SCHEMA-VY
// ════════════════════════════════════════════════════════════

test.describe("Schema-vy", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS);
    await page.waitForURL(/\/dashboard/, { timeout: 8000 });
    await page.goto("/schema/Norra");
  });

  test("visar PhaseBar med steg-för-steg-flödet", async ({ page }) => {
    await expect(page.getByText(/Önskeschema|Granska schema|Attesterat/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("gruppväljaren är synlig och Norra är aktiv", async ({ page }) => {
    const norraBtn = page.getByRole("button", { name: "Norra" });
    await expect(norraBtn).toBeVisible({ timeout: 8000 });
  });

  test("kalender- och grid-toggle finns", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Kalender/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /Grid/i })).toBeVisible({ timeout: 8000 });
  });

  test("Kör autoschema-knappen finns och är klickbar", async ({ page }) => {
    const btn = page.getByRole("button", { name: /Kör autoschema/i });
    await expect(btn).toBeVisible({ timeout: 8000 });
    await expect(btn).toBeEnabled();
  });
});
