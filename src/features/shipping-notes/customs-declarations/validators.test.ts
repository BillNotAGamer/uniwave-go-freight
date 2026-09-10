import { describe, expect, it } from "vitest";

import {
  addCustomsDeclarationInputSchema,
  CUSTOMS_DECLARATION_NUMBER_MAX_LENGTH,
} from "./validators";

describe("Customs Declaration validation", () => {
  it("trims and preserves punctuation in a declaration number", () => {
    expect(addCustomsDeclarationInputSchema.parse({
      shippingNoteId: " note-1 ",
      declarationNo: "  123/ABC-45  ",
    })).toEqual({
      shippingNoteId: "note-1",
      declarationNo: "123/ABC-45",
    });
  });

  it("rejects blank and overlong declaration numbers", () => {
    expect(() => addCustomsDeclarationInputSchema.parse({
      shippingNoteId: "note-1",
      declarationNo: "   ",
    })).toThrow();
    expect(() => addCustomsDeclarationInputSchema.parse({
      shippingNoteId: "note-1",
      declarationNo: "x".repeat(CUSTOMS_DECLARATION_NUMBER_MAX_LENGTH + 1),
    })).toThrow();
  });
});
