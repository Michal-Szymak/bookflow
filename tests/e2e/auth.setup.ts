import { test as setup, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, "../../playwright/.auth/user.json");

setup("authenticate", async ({ page }) => {
  // Get test credentials from environment variables
  const testEmail = process.env.E2E_USERNAME || "test@example.com";
  const testPassword = process.env.E2E_PASSWORD || "testpassword123";

  // Navigate to login page
  await page.goto("/login");

  // Wait for React island to load and form to be interactive
  await page.waitForLoadState("networkidle");
  await page.waitForSelector('input[type="email"]', { state: "visible" });

  // Fill in credentials
  await page.locator('input[type="email"]').fill(testEmail);
  await page.locator('input[type="password"]').fill(testPassword);

  // Set up response listener BEFORE clicking
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes("/api/auth/login") && resp.request().method() === "POST",
    { timeout: 15000 }
  );

  // Click submit button
  await page.locator('button[type="submit"]').click();

  // Wait for response
  const response = await responsePromise;

  // Check if login was successful
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(`Login failed: ${response.status()} - ${errorData.message || "Invalid credentials"}`);
  }

  // Wait for navigation away from login page to ensure cookies are set
  // Sometimes login flow sets cookies in the process of several redirects.
  // Wait for the final URL to ensure that the cookies are actually set.
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 });

  // Alternatively, wait for a specific element that indicates successful login
  // This ensures all cookies and session data are properly set
  await expect(page).toHaveURL(/\/app\//);

  // End of authentication steps.

  await page.context().storageState({ path: authFile });
});
