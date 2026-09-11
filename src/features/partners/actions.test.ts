import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  createPartner: vi.fn(),
  updatePartner: vi.fn(),
  setPartnerCategories: vi.fn(),
  softDeletePartner: vi.fn(),
  restorePartner: vi.fn(),
  addPartnerContact: vi.fn(),
  updatePartnerContact: vi.fn(),
  softDeletePartnerContact: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAuthenticatedUser: mocks.requireAuthenticatedUser }));
vi.mock("@/features/partners/mutations", () => ({
  createPartner: mocks.createPartner,
  updatePartner: mocks.updatePartner,
  setPartnerCategories: mocks.setPartnerCategories,
  softDeletePartner: mocks.softDeletePartner,
  restorePartner: mocks.restorePartner,
  addPartnerContact: mocks.addPartnerContact,
  updatePartnerContact: mocks.updatePartnerContact,
  softDeletePartnerContact: mocks.softDeletePartnerContact,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  addPartnerContactAdminAction,
  createPartnerAdminAction,
  deactivatePartnerAdminAction,
  reactivatePartnerAdminAction,
  removePartnerContactAdminAction,
  setPartnerCategoriesAdminAction,
  updatePartnerAdminAction,
  updatePartnerContactAdminAction,
} from "./actions";

const admin = { id: "admin-1", role: "admin" };
const sale = { id: "sale-1", role: "sale" };
const initial = { ok: true };

function form(values: Record<string, string | string[]>): FormData {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) result.append(key, item);
  }
  return result;
}

describe("Partner Admin server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: admin });
  });

  it("validates and delegates create to the canonical mutation", async () => {
    mocks.createPartner.mockResolvedValue({ id: "partner-1" });
    const result = await createPartnerAdminAction(initial, form({
      companyName: "Acme Logistics",
      vendorCode: "ACME",
      categoryCodes: ["factory_sea"],
    }));

    expect(result).toEqual({ ok: true, message: "Partner created.", partnerId: "partner-1" });
    expect(mocks.createPartner).toHaveBeenCalledWith(expect.objectContaining({
      companyName: "Acme Logistics",
      categoryCodes: ["factory_sea"],
    }), admin);
  });

  it("returns validation feedback without calling create", async () => {
    const result = await createPartnerAdminAction(initial, form({ companyName: "" }));
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(mocks.createPartner).not.toHaveBeenCalled();
  });

  it("does not bypass canonical authorization for a Sale actor", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: sale });
    mocks.createPartner.mockRejectedValue(new Error("You do not have permission to modify partners."));
    const result = await createPartnerAdminAction(initial, form({ companyName: "Acme Logistics" }));
    expect(mocks.createPartner).toHaveBeenCalledWith(expect.any(Object), sale);
    expect(result).toEqual({ ok: false, error: "Partner could not be created." });
  });

  it("wires edit, category, contact, deactivation, and restoration to canonical mutations", async () => {
    mocks.updatePartner.mockResolvedValue({});
    mocks.setPartnerCategories.mockResolvedValue([]);
    mocks.addPartnerContact.mockResolvedValue({});
    mocks.updatePartnerContact.mockResolvedValue({});
    mocks.softDeletePartnerContact.mockResolvedValue({});
    mocks.softDeletePartner.mockResolvedValue({});
    mocks.restorePartner.mockResolvedValue({});

    await expect(updatePartnerAdminAction(initial, form({ id: "partner-1", companyName: "Acme Updated" }))).resolves.toMatchObject({ ok: true });
    await expect(setPartnerCategoriesAdminAction(initial, form({ partnerId: "partner-1", categoryCodes: ["airline"] }))).resolves.toMatchObject({ ok: true });
    await expect(addPartnerContactAdminAction(initial, form({ partnerId: "partner-1", picName: "Alice" }))).resolves.toMatchObject({ ok: true });
    await expect(updatePartnerContactAdminAction(initial, form({ id: "contact-1", partnerId: "partner-1", picName: "Alice Updated" }))).resolves.toMatchObject({ ok: true });
    await expect(removePartnerContactAdminAction(initial, form({ id: "contact-1", partnerId: "partner-1" }))).resolves.toMatchObject({ ok: true });
    await expect(deactivatePartnerAdminAction(initial, form({ id: "partner-1", confirmation: "confirmed" }))).resolves.toMatchObject({ ok: true });
    await expect(reactivatePartnerAdminAction(initial, form({ id: "partner-1" }))).resolves.toMatchObject({ ok: true });

    expect(mocks.updatePartner).toHaveBeenCalledWith("partner-1", expect.objectContaining({ companyName: "Acme Updated" }), admin);
    expect(mocks.setPartnerCategories).toHaveBeenCalledWith("partner-1", ["airline"], admin);
    expect(mocks.addPartnerContact).toHaveBeenCalledWith("partner-1", expect.objectContaining({ picName: "Alice" }), admin);
    expect(mocks.updatePartnerContact).toHaveBeenCalledWith("contact-1", expect.objectContaining({ picName: "Alice Updated" }), admin);
    expect(mocks.softDeletePartnerContact).toHaveBeenCalledWith("contact-1", admin);
    expect(mocks.softDeletePartner).toHaveBeenCalledWith("partner-1", admin);
    expect(mocks.restorePartner).toHaveBeenCalledWith("partner-1", admin);
  });
});
