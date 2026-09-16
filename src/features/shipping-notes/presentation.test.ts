import { describe, expect, it } from "vitest";
import { shippingNotes } from "@/lib/db/schema";

import { formatDetailDateTime, formatDetailValue, formatMawbHawb } from "./presentation";

// Exercise the real Drizzle mapping without trusting its generic unknown return type.
function readTimestamp(
  column: { mapFromDriverValue(value: string): unknown },
  value: string,
): Date {
  const mapped = column.mapFromDriverValue(value);
  if (!(mapped instanceof Date)) {
    throw new Error("Expected a Date from the timestamp column");
  }
  return mapped;
}

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

describe("Shipping Note detail date formatting", () => {
  it.each([
    ["2026-09-11 22:50:00.000", "11 Sep 2026, 22:50"],
    ["2026-09-20 00:20:00.000", "20 Sep 2026, 00:20"],
    ["2026-09-30 23:59:59.999", "30 Sep 2026, 23:59"],
    ["2026-10-01 00:00:00.000", "01 Oct 2026, 00:00"],
    ["2026-01-05 08:05:00.000", "05 Jan 2026, 08:05"],
  ])("preserves Drizzle timestamp wall-clock components for %s", (stored, expected) => {
    const mapped = readTimestamp(shippingNotes.etd, stored);
    expect(formatDetailDateTime(mapped)).toBe(expected);
    expect(formatDetailDateTime(stored)).toBe(expected);
    expect(formatDetailDateTime(mapped.toISOString())).toBe(expected);
  });

  it("matches the previous UTC-host verbose display without a +7 hour shift", () => {
    const etd = readTimestamp(shippingNotes.etd, "2026-09-11 22:50:00.000");
    const eta = readTimestamp(shippingNotes.eta, "2026-09-20 00:20:00.000");
    expect(etd.toLocaleString("en-US", { timeZone: "UTC" })).toBe("9/11/2026, 10:50:00 PM");
    expect(eta.toLocaleString("en-US", { timeZone: "UTC" })).toBe("9/20/2026, 12:20:00 AM");
    expect(formatDetailDateTime(etd)).toBe("11 Sep 2026, 22:50");
    expect(formatDetailDateTime(etd)).not.toBe("12 Sep 2026, 05:50");
    expect(formatDetailDateTime(eta)).toBe("20 Sep 2026, 00:20");
    expect(formatDetailDateTime(eta)).not.toBe("20 Sep 2026, 07:20");
  });

  it.each([null, undefined, "", "invalid-date-string", new Date(NaN)])(
    "returns '-' for missing or invalid input %s", (value) => {
      expect(formatDetailDateTime(value)).toBe("-");
    },
  );
});

describe("Shipping Note detail empty values", () => {
  it.each([null, undefined, "", "   "])("renders %s as '-'", (value) => {
    expect(formatDetailValue(value)).toBe("-");
  });

  it("preserves populated values, zero, and multiline text", () => {
    expect(formatDetailValue(0)).toBe("0");
    expect(formatDetailValue("Driver\nPhone")).toBe("Driver\nPhone");
    expect(formatDetailValue("  Reference  ")).toBe("  Reference  ");
  });
});
