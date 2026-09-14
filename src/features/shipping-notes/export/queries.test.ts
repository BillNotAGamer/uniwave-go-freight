import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: {} }));

import { shippingNotes } from "@/lib/db/schema";

import { internalShippingNoteExportNoteSelect } from "./queries";

describe("internal export note projection", () => {
  it("projects modern MAWB and HAWB fields alongside the legacy fallback", () => {
    expect(internalShippingNoteExportNoteSelect.mawbNo).toBe(shippingNotes.mawbNo);
    expect(internalShippingNoteExportNoteSelect.hawbNo).toBe(shippingNotes.hawbNo);
    expect(internalShippingNoteExportNoteSelect.mawbHawbNo).toBe(
      shippingNotes.mawbHawbNo,
    );
  });
});
