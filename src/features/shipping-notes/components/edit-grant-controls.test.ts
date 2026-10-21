import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("EditGrantControls", () => {
  const source = readFileSync(
    new URL("./edit-grant-controls.tsx", import.meta.url),
    "utf8",
  );

  it("binds grant and revoke forms to their dedicated server actions", () => {
    expect(source).toContain("issueShippingNoteEditGrantAction");
    expect(source).toContain("revokeShippingNoteEditGrantAction");
    expect(source).toContain('name="shippingNoteId"');
    expect(source).toContain('name="recipientUserId"');
    expect(source).toContain('name="grantId"');
  });

  it("discloses the operational-only and Closed-note boundaries", () => {
    expect(source).toContain("cannot edit selling or buying charges");
    expect(source).toContain("stop being effective when this note is Closed");
  });

  it("shows issuer and revoker attribution in grant history", () => {
    expect(source).toContain("grantedByName");
    expect(source).toContain("revokedByName");
    expect(source).toContain("formatAuditTimestamp");
  });
});
