import { describe, expect, it, vi } from "vitest";

import {
  INTERNAL_PDF_LAYOUT_VERSION,
  INTERNAL_PDF_METADATA_VERSION,
  INTERNAL_PDF_MIME_TYPE,
  INTERNAL_XLSX_METADATA_VERSION,
  INTERNAL_XLSX_TEMPLATE_SHA256,
  INTERNAL_XLSX_TEMPLATE_VERSION,
} from "./constants";
import {
  buildFailedInternalPdfExportRecordValues,
  buildFailedInternalXlsxExportRecordValues,
  buildGeneratedInternalPdfExportRecordValues,
  buildGeneratedInternalXlsxExportRecordValues,
  buildPendingInternalPdfExportRecordValues,
  buildPendingInternalXlsxExportRecordValues,
} from "./mutations";
import { EXPORT_ERROR_CODES } from "./errors";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({
  db: {},
}));
vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: vi.fn(),
}));

describe("internal XLSX export metadata versioning", () => {
  it("distinguishes Phase 7A internal-v2 artifacts from historical v1 records", () => {
    expect(INTERNAL_XLSX_METADATA_VERSION).toBe(2);
    expect(INTERNAL_XLSX_TEMPLATE_VERSION).toBe("internal-v2");
    expect(INTERNAL_XLSX_TEMPLATE_SHA256).toBe(
      "CFC150C44E49A368433D6295BE6FB2F70876139F8A7A70D0FE97963076284E57",
    );
  });

  it("persists the v2 export version for newly created pending records", () => {
    expect(buildPendingInternalXlsxExportRecordValues({
      shippingNoteId: "note-1",
      fileName: "ShippingNote_TEST.xlsx",
      generatedById: "user-1",
    })).toMatchObject({
      exportType: "excel",
      version: 2,
      status: "pending",
      shippingNoteId: "note-1",
      fileName: "ShippingNote_TEST.xlsx",
      generatedById: "user-1",
      errorMessage: null,
    });
  });

  it("keeps the v2 export version on generated and failed updates", () => {
    const generatedAt = new Date("2026-08-13T00:00:00.000Z");

    expect(buildGeneratedInternalXlsxExportRecordValues({
      fileName: "ShippingNote_TEST.xlsx",
      checksumSha256: "ABC123",
      generatedById: "user-1",
      generatedAt,
    })).toMatchObject({
      version: 2,
      status: "generated",
      fileName: "ShippingNote_TEST.xlsx",
      checksum: "ABC123",
      errorMessage: null,
      generatedById: "user-1",
      generatedAt,
    });

    expect(buildFailedInternalXlsxExportRecordValues({
      errorCode: EXPORT_ERROR_CODES.GENERATION_FAILED,
      fileName: "ShippingNote_TEST.xlsx",
      generatedById: "user-1",
    })).toMatchObject({
      version: 2,
      status: "failed",
      fileName: "ShippingNote_TEST.xlsx",
      checksum: null,
      errorMessage: EXPORT_ERROR_CODES.GENERATION_FAILED,
      generatedById: "user-1",
      generatedAt: null,
    });
  });
});

describe("internal PDF export metadata versioning", () => {
  it("defines the internal PDF v1 artifact contract", () => {
    expect(INTERNAL_PDF_METADATA_VERSION).toBe(1);
    expect(INTERNAL_PDF_LAYOUT_VERSION).toBe("internal-pdf-v1");
    expect(INTERNAL_PDF_MIME_TYPE).toBe("application/pdf");
  });

  it("persists the v1 PDF export version for newly created pending records", () => {
    expect(buildPendingInternalPdfExportRecordValues({
      shippingNoteId: "note-1",
      fileName: "ShippingNote_TEST.pdf",
      generatedById: "user-1",
    })).toMatchObject({
      exportType: "pdf",
      version: 1,
      status: "pending",
      shippingNoteId: "note-1",
      fileName: "ShippingNote_TEST.pdf",
      generatedById: "user-1",
      errorMessage: null,
    });
  });

  it("keeps the v1 PDF export version on generated and failed updates", () => {
    const generatedAt = new Date("2026-08-21T00:00:00.000Z");

    expect(buildGeneratedInternalPdfExportRecordValues({
      fileName: "ShippingNote_TEST.pdf",
      checksumSha256: "PDF123",
      generatedById: "user-1",
      generatedAt,
    })).toMatchObject({
      version: 1,
      status: "generated",
      fileName: "ShippingNote_TEST.pdf",
      checksum: "PDF123",
      errorMessage: null,
      generatedById: "user-1",
      generatedAt,
    });

    expect(buildFailedInternalPdfExportRecordValues({
      errorCode: EXPORT_ERROR_CODES.GENERATION_FAILED,
      fileName: "ShippingNote_TEST.pdf",
      generatedById: "user-1",
    })).toMatchObject({
      version: 1,
      status: "failed",
      fileName: "ShippingNote_TEST.pdf",
      checksum: null,
      errorMessage: EXPORT_ERROR_CODES.GENERATION_FAILED,
      generatedById: "user-1",
      generatedAt: null,
    });
  });
});
