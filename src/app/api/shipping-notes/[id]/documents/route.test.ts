vi.mock("server-only", () => ({}));

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { AuthorizationError } from "@/lib/permissions/require-permission";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  uploadShippingNoteDocument: vi.fn(),
  listShippingNoteDocumentsForUser: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));

vi.mock("@/features/shipping-notes/documents/service", () => ({
  uploadShippingNoteDocument: mocks.uploadShippingNoteDocument,
}));

vi.mock("@/features/shipping-notes/documents/queries", () => ({
  listShippingNoteDocumentsForUser: mocks.listShippingNoteDocumentsForUser,
}));

import { POST, GET } from "./route";

function makeUploadRequest(
  formData: FormData,
  origin = "http://localhost:3000",
  requestUrl = "http://localhost:3000/api/shipping-notes/note-1/documents",
): NextRequest {
  const req = new NextRequest(requestUrl, {
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
  beforeEach(() => {
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

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
    expect(mocks.getCurrentSession).not.toHaveBeenCalled();
    expect(mocks.uploadShippingNoteDocument).not.toHaveBeenCalled();
  });

  it("uses AUTH_URL for a proxied public customs upload before authentication", async () => {
    const publicOrigin = "https://uniwave-go-freight-production-8da8.up.railway.app";
    vi.stubEnv("AUTH_URL", publicOrigin);
    vi.stubEnv("NODE_ENV", "production");
    mocks.getCurrentSession.mockResolvedValue(null);

    const formData = new FormData();
    formData.append("documentType", "customs_declaration");
    formData.append(
      "file",
      new Blob(["fake-pdf"], { type: "application/pdf" }),
      "declaration.pdf",
    );

    const response = await POST(
      makeUploadRequest(
        formData,
        publicOrigin,
        "http://railway-internal:8080/api/shipping-notes/note-1/documents",
      ),
      { params: Promise.resolve({ id: "note-1" }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.getCurrentSession).toHaveBeenCalledOnce();
    expect(mocks.uploadShippingNoteDocument).not.toHaveBeenCalled();
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

  it("accepts the canonical customs declaration category and delegates to the shared upload service", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: { id: "user-1", role: "admin", email: "admin@test.com" },
    });
    mocks.uploadShippingNoteDocument.mockResolvedValue({
      id: "doc-customs",
      shippingNoteId: "note-1",
      documentType: "customs_declaration",
      originalFileName: "declaration.pdf",
      storageProvider: "r2",
      mimeType: "application/pdf",
      sizeBytes: 8,
      uploadedById: "user-1",
      createdAt: new Date(),
    });

    const formData = new FormData();
    formData.append("documentType", "customs_declaration");
    formData.append(
      "file",
      new Blob(["fake-pdf"], { type: "application/pdf" }),
      "declaration.pdf",
    );

    const response = await POST(makeUploadRequest(formData), {
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(response.status).toBe(201);
    expect(mocks.uploadShippingNoteDocument).toHaveBeenCalledWith(
      expect.objectContaining({ documentType: "customs_declaration" }),
      expect.anything(),
    );
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
describe("Document list route handler (GET)", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function makeGetRequest(origin = "http://localhost:3000"): NextRequest {
    return new NextRequest("http://localhost:3000/api/shipping-notes/note-1/documents", {
      method: "GET",
      headers: {
        origin,
        "sec-fetch-site": "same-origin",
      },
    });
  }

  it("rejects cross-origin requests with 403", async () => {
    const req = new NextRequest("http://localhost:3000/api/shipping-notes/note-1/documents", {
      method: "GET",
      headers: {
        origin: "http://evil.com",
        "sec-fetch-site": "cross-site",
      },
    });

    const response = await GET(req, {
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);

    const response = await GET(makeGetRequest(), {
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 when user is not authorized to read shipping note documents", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: { id: "sale-unauth", role: "sale", email: "sale2@test.com" },
    });

    mocks.listShippingNoteDocumentsForUser.mockRejectedValue(
      new AuthorizationError("Forbidden."),
    );

    const response = await GET(makeGetRequest(), {
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("returns 200 with list of documents for authorized user", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: { id: "admin-1", role: "admin", email: "admin@test.com" },
    });

    const mockDocs = [
      {
        id: "doc-1",
        shippingNoteId: "note-1",
        documentType: "pre_alert_hbl",
        originalFileName: "hbl.pdf",
        storageProvider: "r2",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        uploadedById: "admin-1",
        createdAt: new Date("2026-09-10T12:00:00Z"),
      },
    ];

    mocks.listShippingNoteDocumentsForUser.mockResolvedValue(mockDocs);

    const response = await GET(makeGetRequest(), {
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.documents).toHaveLength(1);
    expect(json.documents[0].originalFileName).toBe("hbl.pdf");
  });
});
