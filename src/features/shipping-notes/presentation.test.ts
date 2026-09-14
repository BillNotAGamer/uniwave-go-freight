import { describe, expect, it } from "vitest";

import { formatMawbHawb } from "./presentation";

describe("MAWB / HAWB presentation", () => {
  it("prefers both modern values when they exist", () => {
    expect(formatMawbHawb({
      mawbNo: "MAWB-123",
      hawbNo: "HAWB-456",
      mawbHawbNo: "LEGACY-AWB",
    })).toBe("MAWB-123 / HAWB-456");
  });

  it("shows the available modern MAWB or HAWB without an empty separator", () => {
    expect(formatMawbHawb({ mawbNo: "MAWB-123" })).toBe("MAWB-123");
    expect(formatMawbHawb({ hawbNo: "HAWB-456" })).toBe("HAWB-456");
  });

  it("falls back to the legacy combined value only when modern values are absent", () => {
    expect(formatMawbHawb({ mawbHawbNo: "LEGACY-AWB" })).toBe("LEGACY-AWB");
  });

  it("renders the standard empty value when neither modern nor legacy data exists", () => {
    expect(formatMawbHawb({})).toBe("-");
  });
});
