import { describe, expect, it } from "vitest";

import { readFormString } from "./form-data";

describe("shipping note form data parsing", () => {
  it("normalizes blank form values to undefined without treating zero as blank", () => {
    const formData = new FormData();
    formData.set("blank", "   ");
    formData.set("zero", "0");
    formData.set("text", "  Value  ");

    expect(readFormString(formData, "blank")).toBeUndefined();
    expect(readFormString(formData, "missing")).toBeUndefined();
    expect(readFormString(formData, "zero")).toBe("0");
    expect(readFormString(formData, "text")).toBe("  Value  ");
  });
});
