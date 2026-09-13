vi.mock("server-only", () => ({}));

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  persistGeneratedExportArtifact: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));

vi.mock("@/features/shipping-notes/export/artifacts", () => ({
  persistGeneratedExportArtifact: mocks.persistGeneratedExportArtifact,
}));

vi.mock("@/features/shipping-notes/export/queries", () => ({
  getInternalShippingNoteExportDataForUser: vi.fn(),
}));

vi.mock("@/features/shipping-notes/export/generator", () => ({
  buildInternalXlsxFileName: vi.fn(),
  generateInternalShippingNoteXlsx: vi.fn(),
}));

vi.mock("@/features/shipping-notes/export/mutations", () => ({
  createPendingInternalXlsxExportRecord: vi.fn(),
  markInternalXlsxExportFailed: vi.fn(),
  markInternalXlsxExportGenerated: vi.fn(),
}));

import { POST } from "./route";

const publicOrigin = "https://uniwave-go-freight-production-8da8.up.railway.app";
const context = { params: Promise.resolve({ id: "note-1" }) };

function makeRequest(origin: string): NextRequest {
  return new NextRequest(
    "http://railway-internal:8080/api/shipping-notes/note-1/exports/internal-xlsx",
    {
      method: "POST",
      headers: {
        origin,
        "sec-fetch-site": "same-origin",
      },
    },
  );
}

describe("internal XLSX export origin guard", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_URL", publicOrigin);
    vi.stubEnv("NODE_ENV", "production");
    mocks.getCurrentSession.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("accepts the trusted public origin through Railway's internal request URL", async () => {
    const response = await POST(makeRequest(publicOrigin), context);

    expect(response.status).toBe(401);
    expect(mocks.getCurrentSession).toHaveBeenCalledOnce();
  });

  it("rejects a foreign origin before authentication or artifact storage", async () => {
    const response = await POST(makeRequest("https://evil.example"), context);

    expect(response.status).toBe(403);
    expect(mocks.getCurrentSession).not.toHaveBeenCalled();
    expect(mocks.persistGeneratedExportArtifact).not.toHaveBeenCalled();
  });
});
