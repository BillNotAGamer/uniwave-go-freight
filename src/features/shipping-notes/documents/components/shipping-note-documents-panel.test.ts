import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

import { ShippingNoteDocumentsPanel } from "./shipping-note-documents-panel";
import type { ShippingNoteDocumentListItem } from "../types";

describe("ShippingNoteDocumentsPanel UI", () => {
  it("renders empty state when no documents are uploaded", () => {
    const html = renderToStaticMarkup(
      createElement(ShippingNoteDocumentsPanel, {
        shippingNoteId: "note-1",
        documents: [],
        canMutate: true,
        storageAvailable: true,
      }),
    );

    expect(html).toContain("Documents");
    expect(html).toContain("No documents uploaded.");
    expect(html).toContain("Upload document");
  });

  it("renders document list with sanitized metadata and download links without leaking internal storage keys", () => {
    const docs: ShippingNoteDocumentListItem[] = [
      {
        id: "doc-123",
        shippingNoteId: "note-1",
        documentType: "pre_alert_hbl",
        originalFileName: "PreAlert-Scan.pdf",
        storageProvider: "r2",
        mimeType: "application/pdf",
        sizeBytes: 1024 * 50,
        uploadedById: "internal-uuid-user-999",
        uploadedByName: "Alice Operator",
        createdAt: new Date("2026-09-10T12:00:00Z"),
      },
    ];

    const html = renderToStaticMarkup(
      createElement(ShippingNoteDocumentsPanel, {
        shippingNoteId: "note-1",
        documents: docs,
        canMutate: true,
        storageAvailable: true,
      }),
    );

    expect(html).toContain("PreAlert-Scan.pdf");
    expect(html).toContain("Pre-alert HBL");
    expect(html).toContain("50.0 KB");
    expect(html).toContain("Alice Operator");
    expect(html).not.toContain("internal-uuid-user-999");
    expect(html).not.toContain("storageKey");
    expect(html).not.toContain("bucket");

    // Download action
    expect(html).toContain('href="/api/shipping-notes/note-1/documents/doc-123/download"');
    expect(html).toContain("Download");
    expect(html).toContain("Delete");
    expect(html).toContain('aria-label="Delete PreAlert-Scan.pdf"');
  });

  it("renders file input with strictly allowed accept attribute", () => {
    const html = renderToStaticMarkup(
      createElement(ShippingNoteDocumentsPanel, {
        shippingNoteId: "note-1",
        documents: [],
        canMutate: true,
        storageAvailable: true,
      }),
    );

    expect(html).toContain(
      'accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"',
    );
    expect(html).toContain("Allowed formats: PDF, JPG, PNG, WEBP");
    expect(html).toContain("Document Category");
    expect(html).toContain("Pre-alert HBL");
    expect(html).toContain("Pre-alert MBL");
    expect(html).toContain("Contract");
    expect(html).toContain("Invoice");
    expect(html).toContain("Customs declaration");
  });

  it("renders storage unavailable message when storage is not configured", () => {
    const html = renderToStaticMarkup(
      createElement(ShippingNoteDocumentsPanel, {
        shippingNoteId: "note-1",
        documents: [],
        canMutate: true,
        storageAvailable: false,
      }),
    );

    expect(html).toContain("Document storage is currently unavailable");
    expect(html).not.toContain("Upload document form");
  });

  it("disables upload and hard-delete controls when shipping note is not mutable (e.g. locked/cancelled)", () => {
    const html = renderToStaticMarkup(
      createElement(ShippingNoteDocumentsPanel, {
        shippingNoteId: "note-1",
        documents: [{
          id: "doc-locked-1",
          shippingNoteId: "note-1",
          documentType: "invoice",
          originalFileName: "locked.pdf",
          storageProvider: "r2",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          uploadedById: "user-1",
          createdAt: new Date(),
        }],
        canMutate: false,
        storageAvailable: true,
      }),
    );

    expect(html).toContain("Document uploads are disabled because this shipping note is locked or cancelled");
    expect(html).not.toContain("Upload document form");
    expect(html).not.toContain('aria-label="Delete locked.pdf"');
  });

  it("renders general and customs documents in one category-aware list", () => {
    const html = renderToStaticMarkup(
      createElement(ShippingNoteDocumentsPanel, {
        shippingNoteId: "note-1",
        documents: [{
          id: "invoice-doc-1",
          shippingNoteId: "note-1",
          documentType: "invoice",
          originalFileName: "invoice.pdf",
          storageProvider: "r2",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          uploadedById: "user-1",
          uploadedByName: "Billing Operator",
          createdAt: new Date("2026-09-13T00:00:00.000Z"),
        }, {
          id: "customs-doc-1",
          shippingNoteId: "note-1",
          documentType: "customs_declaration",
          originalFileName: "declaration.png",
          storageProvider: "r2",
          mimeType: "image/png",
          sizeBytes: 1024,
          uploadedById: "user-1",
          uploadedByName: "Customs Operator",
          createdAt: new Date("2026-09-13T00:00:00.000Z"),
        }],
        canMutate: true,
        storageAvailable: true,
      }),
    );

    expect(html).toContain("2 documents");
    expect(html).toContain("invoice.pdf");
    expect(html).toContain("Invoice");
    expect(html).toContain("declaration.png");
    expect(html).toContain("Customs declaration");
    expect(html).toContain("Customs Operator");
    expect(html).toContain(
      'href="/api/shipping-notes/note-1/documents/customs-doc-1/download"',
    );
    expect(html).not.toContain("storageKey");
    expect(html).not.toContain("Upload customs declaration");
  });
});
