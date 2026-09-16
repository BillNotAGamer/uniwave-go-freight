import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    expect(rows.map((row) => text(elements(row, "td").at(-1)))).toEqual(["Haru Nguyen", "Other Creator", "-", "-"]);
    expect(rows.map(text).join(" ")).not.toContain("Current Viewer");
    expect(mocks.listShippingNotesForUser).toHaveBeenLastCalledWith(expect.objectContaining({ role: "admin" }), { jobsheet: "JS" });
  });
});
