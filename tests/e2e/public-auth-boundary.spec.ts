import { expect, test, type Page } from "@playwright/test";

const protectedRoutes = [
  {
    path: "/dashboard",
    protectedContent: /Welcome,/i,
  },
  {
    path: "/shipping-notes",
    protectedContent: /Shipping notes/i,
  },
  {
    path: "/admin/users",
    protectedContent: /Admin Users/i,
  },
  {
    path: "/admin/audit",
    protectedContent: /Audit Log/i,
  },
  {
    path: "/documents",
    protectedContent: /Document Library/i,
  },
] as const;

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  return errors;
}

async function expectNoVisibleRuntimeFailure(page: Page) {
  await expect(
    page.getByText(/Unhandled Runtime Error|Application error|Stack Trace/i),
  ).toHaveCount(0);
}

test.describe("public login page", () => {
  test("serves the baseline security headers without exposing framework or local HSTS", async ({
    page,
  }) => {
    const response = await page.goto("/login");
    expect(response).not.toBeNull();

    const headers = response?.headers() ?? {};

    expect(headers["x-powered-by"]).toBeUndefined();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["permissions-policy"]).toContain("microphone=()");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("base-uri 'self'");
    expect(headers["content-security-policy"]).toContain("form-action 'self'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(headers["cache-control"]).toContain("no-store");
    expect(headers["strict-transport-security"]).toBeUndefined();
  });

  test("loads the DB-free public auth surface", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);

    await page.goto("/login");

    await expect(page).toHaveTitle(/Uniwave Go Freight/i);
    await expect(page.getByText("Uniwave Go Freight")).toBeVisible();
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByText(/Self-registration is disabled/i)).toBeVisible();

    const email = page.getByLabel(/email/i);
    const password = page.getByLabel(/^password$/i);

    await expect(email).toBeEditable();
    await email.fill("browser-e2e@example.invalid");
    await expect(email).toHaveValue("browser-e2e@example.invalid");

    await expect(password).toBeEditable();
    await expect(password).toHaveAttribute("type", "password");
    await password.fill("not-a-real-password");
    await expect(password).toHaveValue("not-a-real-password");

    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
    await expectNoVisibleRuntimeFailure(page);

    const html = await page.content();
    expect(html).not.toMatch(
      /postgres:\/\/|postgresql:\/\/|DATABASE_URL|AUTH_SECRET|GOOGLE_SERVICE_ACCOUNT|ARTIFACT_R2|BEGIN PRIVATE KEY/i,
    );
    expect(consoleErrors).toEqual([]);
  });

  test("keeps password hidden by default and exposes only through the visible toggle", async ({
    page,
  }) => {
    await page.goto("/login");

    const password = page.getByLabel(/^password$/i);
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: /show password/i }).click();
    await expect(password).toHaveAttribute("type", "text");

    await page.getByRole("button", { name: /hide password/i }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("uses browser-native required-field validation before auth submission", async ({
    page,
  }) => {
    let authSubmissions = 0;

    page.on("request", (request) => {
      if (request.url().includes("/api/auth/")) {
        authSubmissions += 1;
      }
    });

    await page.goto("/login");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    const emailMissing = await page
      .getByLabel(/email/i)
      .evaluate((input) => (input as HTMLInputElement).validity.valueMissing);
    expect(emailMissing).toBe(true);
    expect(authSubmissions).toBe(0);

    await page.getByLabel(/email/i).fill("browser-e2e@example.invalid");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    const passwordMissing = await page
      .getByLabel(/^password$/i)
      .evaluate((input) => (input as HTMLInputElement).validity.valueMissing);
    expect(passwordMissing).toBe(true);
    expect(authSubmissions).toBe(0);
  });

  test("does not perform an external redirect from inert callback parameters", async ({
    page,
  }) => {
    await page.goto("/login?callbackUrl=https%3A%2F%2Fevil.example%2Fnext");

    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    expect(new URL(page.url()).origin).not.toBe("https://evil.example");
  });
});

test.describe("unauthenticated protected routes", () => {
  for (const route of protectedRoutes) {
    test(`redirects ${route.path} to login without privileged content`, async ({
      page,
    }) => {
      const consoleErrors = collectConsoleErrors(page);

      await page.goto(route.path);

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
      await expect(page.getByText(route.protectedContent)).toHaveCount(0);
      await expectNoVisibleRuntimeFailure(page);
      expect(consoleErrors).toEqual([]);
    });
  }
});
