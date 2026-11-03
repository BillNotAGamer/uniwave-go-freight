import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({
  approveShippingNoteAction: vi.fn(),
  lockShippingNoteAction: vi.fn(),
  markShippingNoteCheckedAction: vi.fn(),
  startAccountingReviewAction: vi.fn(),
  unlockShippingNoteAction: vi.fn(),
}));

import { AccountingReviewControls } from "./accounting-review-controls";

describe("AccountingReviewControls", () => {
  it("renders the compact three-confirmation Mark Checked panel", () => {
    const html = renderToStaticMarkup(createElement(AccountingReviewControls, {
      noteId: "note-1",
      status: "accounting_reviewing",
      canStartReview: false,
      canMarkChecked: true,
      canApprove: false,
      canLock: false,
      canUnlock: false,
    }));

    expect(html).toContain('name="sellingVerified"');
    expect(html).toContain('name="buyingVerified"');
    expect(html).toContain('name="taxVerified"');
    expect(html.match(/required=""/g)).toHaveLength(3);
    expect(html).toContain("Selling charges verified");
    expect(html).toContain("Buying charges verified");
    expect(html).toContain("VAT/Tax classification verified");
    expect(html).not.toContain("Documents Verified");
  });
});
