import { expect, test, type Page } from "@playwright/test";

const requiredEnv = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for authenticated E2E.`);
  }

  return value;
};

const fixtures = {
  runId: requiredEnv("AUTH_E2E_RUN_ID"),
  sale: {
    email: requiredEnv("AUTH_E2E_SALE_EMAIL"),
    password: requiredEnv("AUTH_E2E_SALE_PASSWORD"),
  },
  accountant: {
    email: requiredEnv("AUTH_E2E_ACCOUNTANT_EMAIL"),
    password: requiredEnv("AUTH_E2E_ACCOUNTANT_PASSWORD"),
  },
  admin: {
    email: requiredEnv("AUTH_E2E_ADMIN_EMAIL"),
    password: requiredEnv("AUTH_E2E_ADMIN_PASSWORD"),
  },
  workflow: {
    noteId: requiredEnv("AUTH_E2E_WORKFLOW_NOTE_ID"),
    jobsheetNo: requiredEnv("AUTH_E2E_WORKFLOW_JOB"),
  },
  locked: {
    noteId: requiredEnv("AUTH_E2E_LOCKED_NOTE_ID"),
    jobsheetNo: requiredEnv("AUTH_E2E_LOCKED_JOB"),
  },
  browserDraft: {
    jobsheetNo: requiredEnv("AUTH_E2E_BROWSER_DRAFT_JOB"),
    mawbHawbNo: requiredEnv("AUTH_E2E_BROWSER_DRAFT_MAWB"),
  },
};

type Principal = {
  email: string;
  password: string;
};

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();

      if (!/Failed to load resource: the server responded with a status of 404/i.test(text)) {
        errors.push(text);
      }
    }
  });

  return errors;
}

async function login(page: Page, principal: Principal, expectedRole: RegExp) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(principal.email);
  await page.getByLabel(/^password$/i).fill(principal.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /welcome,/i })).toBeVisible();
  await expect(page.getByText(expectedRole).last()).toBeVisible();
}

async function logout(page: Page) {
  await page.getByRole("button", { name: /^sign out$/i }).first().click();
  await expect(page).toHaveURL(/\/login$/);
}

async function expectProtectedRouteDenied(page: Page, path: string, heading: RegExp) {
  const response = await page.goto(path);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
}

async function openWorkflowNote(page: Page) {
  await page.goto(`/shipping-notes/${fixtures.workflow.noteId}`);
  await expect(
    page.getByRole("heading", { name: fixtures.workflow.jobsheetNo }),
  ).toBeVisible();
}

async function expectStatus(page: Page, status: RegExp) {
  await expect(page.getByText(status).first()).toBeVisible();
}

test.describe.serial("authenticated browser RBAC and workflow", () => {
  test("Sale logs in through the real flow, creates/edits/submits own note, and cannot access Admin routes", async ({
    page,
    context,
  }) => {
    const consoleErrors = collectConsoleErrors(page);

    await login(page, fixtures.sale, /Sale/i);
    await expect(
      page.getByRole("link", { name: /^New Note$/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /^Users$/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Audit$/i })).toHaveCount(0);

    const cookies = await context.cookies();
    const sessionCookie = cookies.find((cookie) => /session/i.test(cookie.name));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe("Lax");

    const dashboardResponse = await page.goto("/dashboard");
    expect(dashboardResponse?.headers()["cache-control"]).toContain("no-store");
    expect(dashboardResponse?.headers()["cache-control"]).not.toContain("public");
    await expect(page.getByRole("heading", { name: /welcome,/i })).toBeVisible();

    await expectProtectedRouteDenied(page, "/admin/users", /Admin Users/i);
    await page.goto("/dashboard");
    await expectProtectedRouteDenied(page, "/admin/audit", /Audit Log/i);

    await page.goto("/shipping-notes/new");
    await page.getByLabel(/Jobsheet No/i).fill(fixtures.browserDraft.jobsheetNo);
    await page.getByLabel(/Shipping Mode/i).selectOption("sea_export");
    await page.getByLabel(/MAWB \/ HAWB No/i).fill(fixtures.browserDraft.mawbHawbNo);
    await page.getByLabel(/^Shipper$/i).fill(`${fixtures.runId} Browser Shipper`);
    await page.getByLabel(/^Consignee$/i).fill(`${fixtures.runId} Browser Consignee`);
    await page.getByLabel(/^Customer$/i).fill(`${fixtures.runId} Browser Customer`);
    await page.getByLabel(/^Agent$/i).fill(`${fixtures.runId} Browser Agent`);
    await page.getByLabel(/^AOL$/i).fill("SGN");
    await page.getByLabel(/^AOD$/i).fill("LAX");
    await page.getByLabel(/Final Destination/i).fill("Los Angeles");
    await page.getByLabel(/Volume Value/i).fill("1.5");
    await page.getByLabel(/Volume Unit/i).selectOption("cbm");
    await page.getByLabel(/Exchange Rate/i).fill("25000");
    await page.getByRole("button", { name: /Save Draft/i }).click();

    await expect(page).toHaveURL(/\/shipping-notes\/[^/]+$/);
    await expect(page.getByRole("heading", { name: fixtures.browserDraft.jobsheetNo })).toBeVisible();
    await page.getByLabel(/^Shipper$/i).fill(`${fixtures.runId} Edited Shipper`);
    await page.getByRole("button", { name: /Save Draft Changes/i }).click();
    await expect(page.getByText(`${fixtures.runId} Edited Shipper`).first()).toBeVisible();
    await page.getByRole("button", { name: /Submit Draft/i }).click();
    await expect(page.getByText(/Submitted/i).first()).toBeVisible();

    await openWorkflowNote(page);
    await expect(page.getByText(/Financial Area/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Start Accounting Review/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Approve$/i })).toHaveCount(0);

    await logout(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    expect(consoleErrors).toEqual([]);
  });

  test("Accountant logs in, sees accounting surfaces, starts review, marks checked, and remains outside Admin routes", async ({
    page,
  }) => {
    const consoleErrors = collectConsoleErrors(page);

    await login(page, fixtures.accountant, /Accountant/i);
    await expect(page.getByRole("link", { name: /^Users$/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Audit$/i })).toHaveCount(0);
    await expectProtectedRouteDenied(page, "/admin/users", /Admin Users/i);

    await openWorkflowNote(page);
    await expect(page.getByText(/Financial Area/i)).toBeVisible();
    await expect(page.getByText(/Buying Charges/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Start Accounting Review/i })).toBeVisible();
    await page.getByRole("button", { name: /Start Accounting Review/i }).click();
    await expectStatus(page, /Accounting Reviewing/i);
    await expect(page.getByRole("button", { name: /Mark Checked/i })).toBeVisible();
    await page.getByRole("button", { name: /Mark Checked/i }).click();
    await expectStatus(page, /Checked/i);
    await expect(page.getByRole("button", { name: /^Approve$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Lock$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Export XLSX$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Export PDF$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Print$/i })).toBeVisible();

    await logout(page);
    expect(consoleErrors).toEqual([]);
  });

  test("Admin reaches Admin surfaces, approves and locks checked notes, and unlocks with a reason", async ({
    page,
  }) => {
    const consoleErrors = collectConsoleErrors(page);

    await login(page, fixtures.admin, /Admin/i);
    await expect(page.getByRole("link", { name: /^Users$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Audit$/i })).toBeVisible();

    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: /Admin Users/i })).toBeVisible();
    await expect(page.getByText(fixtures.runId).first()).toBeVisible();

    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: /Audit Log/i })).toBeVisible();
    await expect(
      page.getByRole("row", { name: new RegExp(fixtures.workflow.jobsheetNo) }).first(),
    ).toBeVisible();

    await openWorkflowNote(page);
    await expectStatus(page, /Checked/i);
    await expect(page.getByRole("button", { name: /^Approve$/i })).toBeVisible();
    await page.getByRole("button", { name: /^Approve$/i }).click();
    await expectStatus(page, /Approved/i);
    await page.getByLabel(/Lock reason/i).fill(`${fixtures.runId} final browser lock`);
    await page.getByRole("button", { name: /^Lock$/i }).click();
    await expectStatus(page, /Locked/i);
    await expect(page.getByRole("button", { name: /^Export XLSX$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Export PDF$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Print$/i })).toBeVisible();

    await page.goto(`/shipping-notes/${fixtures.locked.noteId}`);
    await expect(page.getByRole("heading", { name: fixtures.locked.jobsheetNo })).toBeVisible();
    await expectStatus(page, /Locked/i);
    await expect(page.getByRole("button", { name: /^Unlock$/i })).toBeVisible();
    await page.getByLabel(/Unlock reason/i).fill(`${fixtures.runId} browser unlock`);
    await page.getByLabel(/Confirm unlock/i).check();
    await page.getByRole("button", { name: /^Unlock$/i }).click();
    await expectStatus(page, /Approved/i);

    await logout(page);
    expect(consoleErrors).toEqual([]);
  });
});
