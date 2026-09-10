import { describe, expect, it } from "vitest";

import {
  buildShippingNotesListHref,
  parseShippingNotesListSearchParams,
  SHIPPING_NOTE_LIST_MAX_JOBSHEET_LENGTH,
} from "./list-filters";

describe("Shipping Note list filters", () => {
  it("normalizes blank and trimmed Jobsheet filter values", () => {
    const blank = parseShippingNotesListSearchParams({ jobsheet: "   " });
    const trimmed = parseShippingNotesListSearchParams({ jobsheet: "  UGF-26  " });

    expect(blank).toMatchObject({ success: true, filters: {} });
    expect(trimmed).toMatchObject({
      success: true,
      filters: { jobsheet: "UGF-26" },
      formValues: { jobsheet: "UGF-26" },
    });
  });

  it("maps date-only filters to inclusive UTC+07 starts and exclusive next-day ends", () => {
    const fromOnly = parseShippingNotesListSearchParams({ etdFrom: "2026-09-01" });
    const toOnly = parseShippingNotesListSearchParams({ etdTo: "2026-09-30" });
    const range = parseShippingNotesListSearchParams({
      etdFrom: "2026-09-01",
      etdTo: "2026-09-30",
    });

    if (!fromOnly.success || !toOnly.success || !range.success) {
      throw new Error("Expected valid Shipping Note list filters.");
    }

    expect(fromOnly.filters.etdFrom?.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(toOnly.filters.etdToExclusive?.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(range.filters.etdFrom?.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(range.filters.etdToExclusive?.toISOString()).toBe("2026-09-30T17:00:00.000Z");
  });

  it("rejects malformed dates, reversed ranges, and oversized Jobsheet input", () => {
    expect(parseShippingNotesListSearchParams({ etdFrom: "2026-02-30" })).toMatchObject({
      success: false,
      error: "ETD dates must be valid calendar dates.",
    });
    expect(parseShippingNotesListSearchParams({ etdTo: "01-09-2026" })).toMatchObject({
      success: false,
      error: "ETD dates must use YYYY-MM-DD.",
    });
    expect(parseShippingNotesListSearchParams({
      etdFrom: "2026-10-01",
      etdTo: "2026-09-30",
    })).toMatchObject({
      success: false,
      error: "ETD From must be on or before ETD To.",
    });
    expect(parseShippingNotesListSearchParams({
      jobsheet: "A".repeat(SHIPPING_NOTE_LIST_MAX_JOBSHEET_LENGTH + 1),
    })).toMatchObject({
      success: false,
      error: `Jobsheet No must be at most ${SHIPPING_NOTE_LIST_MAX_JOBSHEET_LENGTH} characters.`,
    });
  });

  it("serializes only active filters into a shareable list URL", () => {
    expect(buildShippingNotesListHref({
      jobsheet: " UGF-26 ",
      etdFrom: "2026-09-01",
      etdTo: "2026-09-30",
    })).toBe("/shipping-notes?jobsheet=UGF-26&etdFrom=2026-09-01&etdTo=2026-09-30");
    expect(buildShippingNotesListHref({})).toBe("/shipping-notes");
  });
});
