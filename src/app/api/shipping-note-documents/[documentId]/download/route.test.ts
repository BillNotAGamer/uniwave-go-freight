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

function makeRequest(origin = "http://localhost:3000"): NextRequest {
  return new NextRequest("http://localhost:3000/api/shipping-note-documents/doc-1/download", {
    headers: {
      origin,
      "sec-fetch-site": "same-origin",
    },
  });
}

describe("Document download route handler", () => {
  it("rejects cross-origin requests with 403", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/shipping-note-documents/doc-1/download",
      {
        headers: {
          origin: "http://malicious.test",
          "sec-fetch-site": "cross-site",
        },
      },
    );

    const response = await GET(request, {
      params: Promise.resolve({ documentId: "doc-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ documentId: "doc-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns binary response with safe headers when authorized", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: { id: "user-1", role: "admin", email: "admin@test.com" },
    });

    const fileBytes = Buffer.from("pdf-document-content");
    mocks.downloadShippingNoteDocument.mockResolvedValue({
      documentId: "doc-1",
      fileName: "shipping_contract.pdf",
      mimeType: "application/pdf",
      sizeBytes: fileBytes.byteLength,
      bytes: fileBytes,
    });

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ documentId: "doc-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("shipping_contract.pdf");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    const body = await response.arrayBuffer();
    expect(Buffer.from(body).toString()).toBe("pdf-document-content");
  });

  it("returns 403 when user is not authorized to access document", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: { id: "sale-1", role: "sale", email: "sale@test.com" },
    });

    mocks.downloadShippingNoteDocument.mockRejectedValue(
      new AuthorizationError("Forbidden"),
    );

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ documentId: "doc-1" }),
    });

    expect(response.status).toBe(403);
  });
});
