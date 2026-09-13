vi.mock("server-only", () => ({}));

import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { AuthorizationError } from "@/lib/permissions/require-permission";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  downloadShippingNoteDocument: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));

vi.mock("@/features/shipping-notes/documents/service", () => ({
  downloadShippingNoteDocument: mocks.downloadShippingNoteDocument,
}));

import { GET } from "./route";

function makeDownloadRequest(
  noteId = "note-1",
  docId = "doc-1",
  origin = "http://localhost:3000",
): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/shipping-notes/${noteId}/documents/${docId}/download`,
    {
      method: "GET",
      headers: {
        origin,
        "sec-fetch-site": "same-origin",
      },
    },
  );
}

describe("Document download route handler (GET)", () => {
  it("rejects cross-origin download requests with 403", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/shipping-notes/note-1/documents/doc-1/download",
      {
        method: "GET",
        headers: {
          origin: "http://malicious.site",
          "sec-fetch-site": "cross-site",
        },
      },
    );

    const response = await GET(req, {
      params: Promise.resolve({ id: "note-1", documentId: "doc-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);

    const response = await GET(makeDownloadRequest(), {
      params: Promise.resolve({ id: "note-1", documentId: "doc-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 on AuthorizationError", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: { id: "sale-unauth", role: "sale", email: "sale@test.com" },
    });

    mocks.downloadShippingNoteDocument.mockRejectedValue(
      new AuthorizationError("Forbidden access to shipping note."),
    );

    const response = await GET(makeDownloadRequest(), {
      params: Promise.resolve({ id: "note-1", documentId: "doc-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("returns 404 if document belongs to another shipping note", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: { id: "admin-1", role: "admin", email: "admin@test.com" },
    });

    // Document belongs to note-999, but request URL was for note-1
    mocks.downloadShippingNoteDocument.mockResolvedValue({
      documentId: "doc-1",
      fileName: "invoice.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      bytes: Buffer.from("%PDF-1.4 mock content"),
      shippingNoteId: "note-999",
    });

    const response = await GET(makeDownloadRequest("note-1", "doc-1"), {
      params: Promise.resolve({ id: "note-1", documentId: "doc-1" }),
    });

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toContain("Document not found for this shipping note");
  });

  it("returns 404 when document is not found", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: { id: "admin-1", role: "admin", email: "admin@test.com" },
    });

    mocks.downloadShippingNoteDocument.mockRejectedValue(
      new Error("Document not found."),
    );

    const response = await GET(makeDownloadRequest(), {
      params: Promise.resolve({ id: "note-1", documentId: "doc-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 200 with streamed bytes and safe headers on authorized download", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: { id: "admin-1", role: "admin", email: "admin@test.com" },
    });

    const pdfBuffer = Buffer.from("%PDF-1.4 streamable content");
    mocks.downloadShippingNoteDocument.mockResolvedValue({
      documentId: "doc-1",
      fileName: "contract.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdfBuffer.length,
      bytes: pdfBuffer,
      shippingNoteId: "note-1",
    });

    const response = await GET(makeDownloadRequest("note-1", "doc-1"), {
      params: Promise.resolve({ id: "note-1", documentId: "doc-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(response.headers.get("content-disposition")).toContain("contract.pdf");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toContain("no-store");

    const arrayBuffer = await response.arrayBuffer();
    expect(Buffer.from(arrayBuffer).toString()).toBe("%PDF-1.4 streamable content");
  });
});
