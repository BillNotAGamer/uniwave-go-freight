import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
    AUTH_SECRET: "secret",
    AUTH_URL: "http://localhost:3000",
  },
}));
vi.mock("@/lib/db/client", () => ({ db: {} }));

import type { User } from "@/lib/db/schema";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  listShippingNotesForUser: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/features/shipping-notes/queries", () => ({
  listShippingNotesForUser: mocks.listShippingNotesForUser,
}));

import ShippingNotesPage from "./page";

const now = new Date("2026-09-01T00:00:00.000Z");

function user(): User {
  return {
    id: "sale-1",
    email: "sale@example.test",
    name: "Sale",
    image: null,
    emailVerified: true,
    role: "sale",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

describe("/shipping-notes C7 filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: user() });
    mocks.listShippingNotesForUser.mockResolvedValue([]);
  });

  it("passes normalized URL filters to the protected list query", async () => {
    const actor = user();
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: actor });

    await expect(ShippingNotesPage({
      searchParams: Promise.resolve({
        jobsheet: " UGF-26 ",
        etdFrom: "2026-09-01",
        etdTo: "2026-09-30",
      }),
    })).resolves.toBeTruthy();

    expect(mocks.listShippingNotesForUser).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        jobsheet: "UGF-26",
        etdFrom: new Date("2026-08-31T17:00:00.000Z"),
        etdToExclusive: new Date("2026-09-30T17:00:00.000Z"),
      }),
    );
  });

  it("renders invalid filters safely without issuing a database query", async () => {
    await expect(ShippingNotesPage({
      searchParams: Promise.resolve({ etdFrom: "2026-02-30" }),
    })).resolves.toBeTruthy();

    expect(mocks.listShippingNotesForUser).not.toHaveBeenCalled();
  });
});


type HtmlElement = React.ReactElement<{ children?: React.ReactNode }>;
function elements(node: unknown, type: string): HtmlElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => elements(child, type));
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return [];
  return [...(node.type === type ? [node] : []), ...elements(node.props.children, type)];
}
function text(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement<{ children?: unknown }>(node) ? text(node.props.children) : "";
}

describe("Shipping Notes CREATED BY column", () => {
  it("renders distinct persisted creator names rather than the current session account", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: { ...user(), role: "admin", name: "Current Viewer" } });
    mocks.listShippingNotesForUser.mockResolvedValue(["Haru Nguyen", "Other Creator", null, ""].map((name, index) => ({
      id: `note-${index}`, jobsheetNo: `JS-${index}`, shippingMode: "air_export", shipperText: null,
      consigneeText: null, status: "submitted", createdAt: now, createdByName: name,
    })));
    const page = await ShippingNotesPage({ searchParams: Promise.resolve({ jobsheet: "JS" }) });
    expect(elements(page, "th").map(text)).toContain("Created by");
    const rows = elements(elements(page, "tbody")[0], "tr");
    expect(rows.map((row) => text(elements(row, "td").at(-2)))).toEqual(["Haru Nguyen", "Other Creator", "-", "-"]);
    expect(rows.map(text).join(" ")).not.toContain("Current Viewer");
    expect(mocks.listShippingNotesForUser).toHaveBeenLastCalledWith(expect.objectContaining({ role: "admin" }), { jobsheet: "JS" });
  });
});


describe("Shipping Notes list Copy action authorization (REQ-02)", () => {
  it("renders DuplicateShippingNoteControls (Copy) only for notes the actor is authorized to duplicate", async () => {
    const notes = [
      {
        id: "note-own",
        jobsheetNo: "JS-OWN",
        shippingMode: "sea_export" as const,
        shipperText: "Shipper A",
        consigneeText: "Consignee B",
        status: "submitted" as const,
        createdAt: now,
        createdById: "sale-1",
        createdByName: "Sale One",
      },
      {
        id: "note-other",
        jobsheetNo: "JS-OTHER",
        shippingMode: "sea_export" as const,
        shipperText: "Shipper C",
        consigneeText: "Consignee D",
        status: "submitted" as const,
        createdAt: now,
        createdById: "sale-2",
        createdByName: "Sale Two",
      },
    ];
    mocks.listShippingNotesForUser.mockResolvedValue(notes);

    // 1. Sale user sees Copy only on their own note (row 0), not on other's note (row 1)
    mocks.requireAuthenticatedUser.mockResolvedValue({
      user: { ...user(), id: "sale-1", role: "sale" },
    });
    const salePage = await ShippingNotesPage({ searchParams: Promise.resolve({}) });
    expect(elements(salePage, "th").map(text)).toContain("Actions");
    const saleRows = elements(elements(salePage, "tbody")[0], "tr");
    const saleRow0ActionCell = elements(saleRows[0], "td").at(-1);
    const saleRow1ActionCell = elements(saleRows[1], "td").at(-1);
    expect((saleRow0ActionCell?.props.children as React.ReactElement)?.props).toMatchObject({
      sourceId: "note-own",
      sourceJobsheetNo: "JS-OWN",
    });
    expect(text(saleRow1ActionCell)).toBe("-");

    // 2. Admin sees Copy on all notes
    mocks.requireAuthenticatedUser.mockResolvedValue({
      user: { ...user(), id: "admin-1", role: "admin" },
    });
    const adminPage = await ShippingNotesPage({ searchParams: Promise.resolve({}) });
    const adminRows = elements(elements(adminPage, "tbody")[0], "tr");
    expect((elements(adminRows[0], "td").at(-1)?.props.children as React.ReactElement)?.props).toMatchObject({
      sourceId: "note-own",
      sourceJobsheetNo: "JS-OWN",
    });
    expect((elements(adminRows[1], "td").at(-1)?.props.children as React.ReactElement)?.props).toMatchObject({
      sourceId: "note-other",
      sourceJobsheetNo: "JS-OTHER",
    });

    // 3. Accountant sees Copy on no notes
    mocks.requireAuthenticatedUser.mockResolvedValue({
      user: { ...user(), id: "acc-1", role: "accountant" },
    });
    const accPage = await ShippingNotesPage({ searchParams: Promise.resolve({}) });
    const accRows = elements(elements(accPage, "tbody")[0], "tr");
    expect(text(elements(accRows[0], "td").at(-1))).toBe("-");
    expect(text(elements(accRows[1], "td").at(-1))).toBe("-");
  });
});
