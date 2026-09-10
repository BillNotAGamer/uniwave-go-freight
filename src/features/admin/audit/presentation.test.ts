import { describe, expect, it } from "vitest";

import {
  AUDIT_VIEWER_ACTION_CATALOG,
  buildAuditViewerItem,
  getAuditActionPresentation,
  presentAuditChanges,
  sanitizeAuditPresentationValue,
} from "./presentation";
import { AUDIT_VIEWER_KNOWN_ACTIONS } from "./types";

const baseRow = {
  id: "00000000-0000-4000-8000-000000000010",
  actorUserId: "00000000-0000-4000-8000-000000000001",
  entityType: "shipping_note",
  entityId: "00000000-0000-4000-8000-000000000002",
  reason: "routine check",
  createdAt: new Date("2026-08-24T04:00:00.000Z"),
  actorName: "Admin User",
  actorEmail: "admin@example.test",
};

function asText(value: unknown): string {
  return JSON.stringify(value);
}

describe("audit viewer presentation", () => {
  it("catalogs every current production audit action", () => {
    expect(AUDIT_VIEWER_KNOWN_ACTIONS).toHaveLength(34);
    expect(Object.keys(AUDIT_VIEWER_ACTION_CATALOG).sort())
      .toEqual([...AUDIT_VIEWER_KNOWN_ACTIONS].sort());
    expect(getAuditActionPresentation("shipping_note.approve"))
      .toMatchObject({
        actionLabel: "Shipping Note approved",
        category: "shipping_note",
        known: true,
      });
    expect(getAuditActionPresentation("future.action")).toMatchObject({
      actionLabel: "future.action",
      category: "unknown",
      known: false,
    });
  });

  it("hides all snapshots for unknown actions", () => {
    const item = buildAuditViewerItem({
      row: {
        ...baseRow,
        action: "future.secret_rotation",
        before: {
          harmless: "before-value",
          password: "secret-before",
        },
        after: {
          harmless: "after-value",
          token: "secret-token",
        },
      },
    });

    expect(item).toMatchObject({
      action: "future.secret_rotation",
      actionLabel: "future.secret_rotation",
      category: "unknown",
      detailsAvailable: false,
      changes: [],
      reason: "routine check",
      actor: expect.objectContaining({
        display: "Admin User",
      }),
    });
    expect(asText(item)).not.toContain("before-value");
    expect(asText(item)).not.toContain("after-value");
    expect(asText(item)).not.toContain("secret-before");
    expect(asText(item)).not.toContain("secret-token");
  });

  it("recursively removes sensitive keys from nested objects and arrays", () => {
    const sanitized = sanitizeAuditPresentationValue({
      safe: "kept",
      password: "remove-password",
      passwordHash: "remove-hash",
      password_hash: "remove-snake-hash",
      token: "remove-token",
      sessionToken: "remove-session-token",
      accessToken: "remove-access-token",
      refreshToken: "remove-refresh-token",
      privateKey: "remove-private-key",
      client_secret: "remove-client-secret",
      credential: "remove-credential",
      databaseUrl: "remove-db-url",
      artifactStorageKey: "remove-storage-key",
      authorization: "remove-authorization",
      cookie: "remove-cookie",
      nested: {
        safeNested: "kept-nested",
        Secret: "remove-nested-secret",
      },
      array: [
        { safeArray: "kept-array", access_token: "remove-array-token" },
      ],
    });
    const text = asText(sanitized);

    expect(text).toContain("kept");
    expect(text).toContain("kept-nested");
    expect(text).toContain("kept-array");
    expect(text).not.toContain("remove-password");
    expect(text).not.toContain("remove-hash");
    expect(text).not.toContain("remove-snake-hash");
    expect(text).not.toContain("remove-token");
    expect(text).not.toContain("remove-session-token");
    expect(text).not.toContain("remove-access-token");
    expect(text).not.toContain("remove-refresh-token");
    expect(text).not.toContain("remove-private-key");
    expect(text).not.toContain("remove-client-secret");
    expect(text).not.toContain("remove-credential");
    expect(text).not.toContain("remove-db-url");
    expect(text).not.toContain("remove-storage-key");
    expect(text).not.toContain("remove-authorization");
    expect(text).not.toContain("remove-cookie");
    expect(text).not.toContain("remove-nested-secret");
    expect(text).not.toContain("remove-array-token");
  });

  it("presents password and session user events without credential or token data", () => {
    const passwordDetails = presentAuditChanges({
      action: "user.password_set_by_admin",
      before: {
        password: "old-password",
        credentialAccountId: "credential-1",
      },
      after: {
        revokedSessionCount: 2,
        passwordHash: "new-hash",
        sessionToken: "session-token",
      },
    });
    const sessionDetails = presentAuditChanges({
      action: "user.sessions_revoked",
      before: null,
      after: {
        revokedSessionCount: 3,
        token: "session-token",
      },
    });
    const combined = asText({ passwordDetails, sessionDetails });

    expect(passwordDetails.detailsAvailable).toBe(true);
    expect(passwordDetails.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: "revokedSessionCount",
        after: "2",
      }),
    ]));
    expect(sessionDetails.changes).toEqual([
      {
        field: "revokedSessionCount",
        label: "Revoked session count",
        before: null,
        after: "3",
      },
    ]);
    expect(combined).not.toContain("old-password");
    expect(combined).not.toContain("new-hash");
    expect(combined).not.toContain("credential-1");
    expect(combined).not.toContain("session-token");
  });

  it("presents buying charge and tax override allowlisted fields only", () => {
    const buying = presentAuditChanges({
      action: "shipping_note_charge.buying.update",
      before: {
        chargeName: "Trucking",
        unitPrice: "100.00",
        amountVnd: "2400000.00",
        artifactStorageKey: "private-storage-key",
      },
      after: {
        chargeName: "Trucking",
        unitPrice: "120.00",
        amountVnd: "2880000.00",
        accessToken: "secret-access-token",
      },
    });
    const tax = presentAuditChanges({
      action: "shipping_note_charge.tax_override",
      before: {
        vatPercent: "8.00",
        vatAmount: "800.00",
        isOverride: false,
      },
      after: {
        vatPercent: "10.00",
        vatAmount: "1000.00",
        isOverride: true,
        overrideReason: "manual correction",
        refreshToken: "secret-refresh-token",
      },
    });
    const text = asText({ buying, tax });

    expect(text).toContain("120.00");
    expect(text).toContain("2880000.00");
    expect(text).toContain("10.00");
    expect(text).toContain("manual correction");
    expect(text).not.toContain("private-storage-key");
    expect(text).not.toContain("secret-access-token");
    expect(text).not.toContain("secret-refresh-token");
  });

  it("presents export and Drive events while hiding storage keys and Drive IDs", () => {
    const generated = presentAuditChanges({
      action: "shipping_note.export.xlsx.generated",
      before: null,
      after: {
        format: "xlsx",
        fileName: "SN-1.xlsx",
        checksum: "checksum-1",
        artifactStorageKey: "shipping-note-exports/export-1/artifact.xlsx",
        artifactSizeBytes: 1234,
      },
    });
    const pdf = presentAuditChanges({
      action: "shipping_note.export.pdf.generated",
      before: null,
      after: {
        format: "pdf",
        fileName: "SN-1.pdf",
        checksum: "checksum-pdf",
        artifactStorageKey: "shipping-note-exports/export-1/artifact.pdf",
      },
    });
    const drive = presentAuditChanges({
      action: "shipping_note.export.drive.uploaded",
      before: null,
      after: {
        exportType: "pdf",
        version: 1,
        checksum: "checksum-drive",
        driveUploadStatus: "uploaded",
        driveFileId: "drive-file-id",
        driveFolderId: "drive-folder-id",
        artifactStorageKey: "private-storage-key",
        retryCount: 1,
        reconciledFromDrive: true,
      },
    });
    const failed = presentAuditChanges({
      action: "shipping_note.export.drive.failed",
      before: null,
      after: {
        driveUploadStatus: "upload_failed",
        driveErrorMessage: "DRIVE_UPLOAD_FAILED",
        driveFileId: "drive-file-id",
        driveFolderId: "drive-folder-id",
      },
    });
    const text = asText({ generated, pdf, drive, failed });

    expect(text).toContain("SN-1.xlsx");
    expect(text).toContain("SN-1.pdf");
    expect(text).toContain("checksum-drive");
    expect(text).toContain("DRIVE_UPLOAD_FAILED");
    expect(text).not.toContain("shipping-note-exports/export-1/artifact.xlsx");
    expect(text).not.toContain("shipping-note-exports/export-1/artifact.pdf");
    expect(text).not.toContain("private-storage-key");
    expect(text).not.toContain("drive-file-id");
    expect(text).not.toContain("drive-folder-id");
  });

  it("presents cancellation and reopen state transitions", () => {
    const cancellation = presentAuditChanges({
      action: "shipping_note.cancel",
      before: { status: "approved", cancelReason: null },
      after: { status: "cancelled", cancelReason: "customer void" },
    });
    const reopen = presentAuditChanges({
      action: "shipping_note.reopen_for_correction",
      before: {
        status: "approved",
        checkedById: "checker-1",
        approvedById: "admin-1",
      },
      after: {
        status: "accounting_reviewing",
        checkedById: null,
        approvedById: null,
      },
    });

    expect(cancellation.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "status", before: "approved", after: "cancelled" }),
      expect.objectContaining({ field: "cancelReason", after: "customer void" }),
    ]));
    expect(reopen.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: "status",
        before: "approved",
        after: "accounting_reviewing",
      }),
      expect.objectContaining({ field: "checkedById", before: "checker-1", after: null }),
      expect.objectContaining({ field: "approvedById", before: "admin-1", after: null }),
    ]));
  });
});
