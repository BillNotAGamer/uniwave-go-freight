import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));
vi.mock("@/features/shipping-notes/export/download", () => ({
  getHistoricalExportDownloadForUser: vi.fn(),
}));

import { getCurrentSession } from "@/lib/auth/session";
import { getHistoricalExportDownloadForUser } from "@/features/shipping-notes/export/download";
import { GET } from "./route";

const mockGetCurrentSession = vi.mocked(getCurrentSession);
const mockDownload = vi.mocked(getHistoricalExportDownloadForUser);

const admin = {
  id: "admin-1",
  email: "admin@example.test",
  name: "Admin",
  image: null,
  emailVerified: true,
  role: "admin" as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function request(origin = "https://app.example.test") {
  return new NextRequest(
    "https://app.example.test/api/shipping-note-exports/11111111-1111-4111-8111-111111111111/download",
    {
      method: "GET",
      headers: {
        origin,
      },
    },
  );
}

describe("historical export download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns verified artifact bytes with safe download headers", async () => {
    mockGetCurrentSession.mockResolvedValue({
      session: {
        id: "session-1",
        userId: admin.id,
        expiresAt: new Date(),
        token: "token",
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      },
      user: admin,
    });
    mockDownload.mockResolvedValue({
      exportId: "11111111-1111-4111-8111-111111111111",
      fileName: "ShippingNote_TEST.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      bytes: Buffer.from("artifact"),
    });

    const response = await GET(request(), {
      params: Promise.resolve({
        exportId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("content-disposition")).toContain(
      "ShippingNote_TEST.xlsx",
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      Buffer.from("artifact"),
    );
  });

  it("rejects cross-origin requests before authentication", async () => {
    const response = await GET(request("https://evil.example.test"), {
      params: Promise.resolve({
        exportId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    expect(response.status).toBe(403);
    expect(mockGetCurrentSession).not.toHaveBeenCalled();
  });
});
