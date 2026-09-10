import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock("@/lib/db/client", () => ({ db: { select: mocks.select } }));

import type { User } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import {
  searchServiceCatalogItems,
  SERVICE_CATALOG_LOOKUP_LIMIT,
} from "./queries";

const now = new Date("2026-09-10T00:00:00.000Z");

function user(role: User["role"], overrides: Partial<User> = {}): User {
  return {
    id: `${role}-1`,
    email: `${role}@example.test`,
    name: role,
    image: null,
    emailVerified: true,
    role,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function configureRows(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  mocks.select.mockReturnValue({ from } as never);
  return { limit };
}

describe("Service Catalog charge lookup", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["sale", "accountant", "admin"] as const)(
    "allows active %s users to search code/name with a bounded result",
    async (role) => {
      const item = {
        id: "catalog-1",
        code: "OF",
        name: "Ocean Freight",
        primaryUnit: "Shipment",
        vatRate: "8.00",
      };
      const configured = configureRows([item]);

      await expect(searchServiceCatalogItems(" OF ", user(role))).resolves.toEqual([
        item,
      ]);
      expect(configured.limit).toHaveBeenCalledWith(SERVICE_CATALOG_LOOKUP_LIMIT);
    },
  );

  it("supports search by code or name and respects custom limit", async () => {
    const codeItem = {
      id: "catalog-code",
      code: "AIR-EXP",
      name: "Air Express",
      primaryUnit: "KG",
      vatRate: "10.00",
    };
    const nameItem = {
      id: "catalog-name",
      code: "TRK-DOM",
      name: "Trucking Domestic",
      primaryUnit: "Trip",
      vatRate: "8.00",
    };

    const configCode = configureRows([codeItem]);
    await expect(
      searchServiceCatalogItems("air-exp", user("sale"), 5),
    ).resolves.toEqual([codeItem]);
    expect(configCode.limit).toHaveBeenCalledWith(5);

    const configName = configureRows([nameItem]);
    await expect(
      searchServiceCatalogItems("trucking", user("accountant"), 10),
    ).resolves.toEqual([nameItem]);
    expect(configName.limit).toHaveBeenCalledWith(10);
  });

  it("rejects inactive/deleted users before querying", async () => {
    await expect(
      searchServiceCatalogItems("OF", user("admin", { isActive: false })),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      searchServiceCatalogItems("OF", user("admin", { deletedAt: now })),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("rejects invalid input and limits above the server maximum", async () => {
    await expect(searchServiceCatalogItems("", user("admin"))).rejects.toThrow();
    await expect(searchServiceCatalogItems("OF", user("admin"), 21)).rejects.toThrow();
    await expect(searchServiceCatalogItems("OF", user("admin"), 0)).rejects.toThrow();
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
