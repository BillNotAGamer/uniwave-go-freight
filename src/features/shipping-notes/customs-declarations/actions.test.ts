import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  addCustomsDeclaration: vi.fn(),
  removeCustomsDeclaration: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));
vi.mock("./mutations", () => ({
  addCustomsDeclaration: mocks.addCustomsDeclaration,
  removeCustomsDeclaration: mocks.removeCustomsDeclaration,
}));

import {
  addCustomsDeclarationAction,
  removeCustomsDeclarationAction,
} from "./actions";

describe("Customs Declaration actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({
      user: { id: "acc-1", role: "accountant" },
    });
  });

  describe("addCustomsDeclarationAction", () => {
    it("successfully adds declaration and revalidates path", async () => {
      mocks.addCustomsDeclaration.mockResolvedValue({
        id: "dec-1",
        shippingNoteId: "note-1",
        declarationNo: "DEC/2026/001",
      });

      const formData = new FormData();
      formData.set("shippingNoteId", "note-1");
      formData.set("declarationNo", "DEC/2026/001");

      const result = await addCustomsDeclarationAction({ ok: true }, formData);

      expect(result).toEqual({ ok: true });
      expect(mocks.addCustomsDeclaration).toHaveBeenCalledWith(
        { shippingNoteId: "note-1", declarationNo: "DEC/2026/001" },
        { id: "acc-1", role: "accountant" },
      );
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/shipping-notes/note-1");
    });

    it("rejects empty declaration number with validation error", async () => {
      const formData = new FormData();
      formData.set("shippingNoteId", "note-1");
      formData.set("declarationNo", "   ");

      const result = await addCustomsDeclarationAction({ ok: true }, formData);

      expect(result.ok).toBe(false);
      expect(mocks.addCustomsDeclaration).not.toHaveBeenCalled();
    });

    it("catches duplicate error and returns domain-friendly message", async () => {
      mocks.addCustomsDeclaration.mockRejectedValue(
        new Error("Customs Declaration No already exists for this Shipping Note."),
      );

      const formData = new FormData();
      formData.set("shippingNoteId", "note-1");
      formData.set("declarationNo", "DEC/DUP");

      const result = await addCustomsDeclarationAction({ ok: true }, formData);

      expect(result).toEqual({
        ok: false,
        error: "Customs Declaration No already exists for this Shipping Note.",
      });
    });
  });

  describe("removeCustomsDeclarationAction", () => {
    it("successfully removes declaration and revalidates path", async () => {
      mocks.removeCustomsDeclaration.mockResolvedValue(undefined);

      const formData = new FormData();
      formData.set("id", "dec-1");
      formData.set("shippingNoteId", "note-1");

      const result = await removeCustomsDeclarationAction({ ok: true }, formData);

      expect(result).toEqual({ ok: true });
      expect(mocks.removeCustomsDeclaration).toHaveBeenCalledWith(
        { id: "dec-1", shippingNoteId: "note-1" },
        { id: "acc-1", role: "accountant" },
      );
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/shipping-notes/note-1");
    });

    it("rejects invalid input without mutation", async () => {
      const formData = new FormData();
      formData.set("id", "");
      formData.set("shippingNoteId", "note-1");

      const result = await removeCustomsDeclarationAction({ ok: true }, formData);

      expect(result.ok).toBe(false);
      expect(mocks.removeCustomsDeclaration).not.toHaveBeenCalled();
    });
  });
});
