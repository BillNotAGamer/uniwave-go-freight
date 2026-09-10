vi.mock("server-only", () => ({}));

import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { AuthorizationError } from "@/lib/permissions/require-permission";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  uploadShippingNoteDocument: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));

vi.mock("@/features/shipping-notes/documents/service", () => ({
  uploadShippingNoteDocument: mocks.uploadShippingNoteDocument,
}));

import { POST } from "./route";

function makeUploadRequest(formData: FormData, origin = "http://localhost:3000"): NextRequest {
  const req = new NextRequest("http://localhost:3000/api/shipping-notes/note-1/documents", {
    method: "POST",
    headers: {
      origin,
      "sec-fetch-site": "same-origin",
    },
    body: formData,
  });
  return req;
}

describe("Document upload route handler", () => {
  it("rejects cross-origin requests with 403", async () => {
    const formData = new FormData();
    const req = new NextRequest("http://localhost:3000/api/shipping-notes/note-1/documents", {
      method: "POST",
      headers: {
        origin: "http://attacker.com",
        "sec-fetch-site": "cross-site",
      },
      body: formData,
    });

    const response = await POST(req, {
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);

    const formData = new FormData();
    const response = await POST(makeUploadRequest(formData), {
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("rejects invalid document type with 400", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: { id: "user-1", role: "admin", email: "admin@test.com" },
    });

    const formData = new FormData();
    formData.append("documentType", "invalid_category");
    formData.append("file", new Blob(["fake-pdf"], { type: "application/pdf" }), "file.pdf");

    const response = await POST(makeUploadRequest(formData), {
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("Valid document type is required");
  });

  it("returns 201 on successful upload", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: { id: "user-1", role: "admin", email: "admin@test.com" },
    });

    const createdDoc = {
      id: "doc-new",
      shippingNoteId: "note-1",
      documentType: "pre_alert_hbl",
      originalFileName: "hbl.pdf",
      storageProvider: "r2",
      mimeType: "application/pdf",
      sizeBytes: 8,
      uploadedById: "user-1",
      createdAt: new Date(),
    };

    mocks.uploadShippingNoteDocument.mockResolvedValue(createdDoc);

    const formData = new FormData();
    formData.append("documentType", "pre_alert_hbl");
    formData.append("file", new Blob(["fake-pdf"], { type: "application/pdf" }), "hbl.pdf");

    const response = await POST(makeUploadRequest(formData), {
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.document.id).toBe("doc-new");
  });

  it("returns 403 on AuthorizationError (e.g. locked note or unauthorized)", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: { id: "user-1", role: "sale", email: "sale@test.com" },
    });

    mocks.uploadShippingNoteDocument.mockRejectedValue(
      new AuthorizationError("Note is locked"),
    );

    const formData = new FormData();
    formData.append("documentType", "pre_alert_hbl");
    formData.append("file", new Blob(["fake-pdf"], { type: "application/pdf" }), "hbl.pdf");

    const response = await POST(makeUploadRequest(formData), {
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(response.status).toBe(403);
  });
});
