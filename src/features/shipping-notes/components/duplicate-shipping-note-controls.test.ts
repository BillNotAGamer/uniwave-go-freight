import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DuplicateShippingNoteControls", () => {
  const source = readFileSync(
    new URL("./duplicate-shipping-note-controls.tsx", import.meta.url),
    "utf8",
  );

  it("uses the accessible shared dialog primitive and a required Jobsheet input", () => {
    expect(source).toContain('import * as Dialog from "@radix-ui/react-dialog"');
    expect(source).toContain("<Dialog.Title");
    expect(source).toContain("<Dialog.Description");
    expect(source).toContain('name="newJobsheetNo"');
    expect(source).toContain("required");
  });

  it("discloses the exact copy exclusions and exchange-rate reset", () => {
    expect(source).toContain("Charges, documents, exports");
    expect(source).toContain("approvals, workflow history, and audit history are not copied");
    expect(source).toContain("standard exchange-rate default");
  });

  it("does not offer financial copy choices or automatic number generation", () => {
    expect(source).not.toContain('type="checkbox"');
    expect(source).not.toContain("Generate Jobsheet");
  });
});
