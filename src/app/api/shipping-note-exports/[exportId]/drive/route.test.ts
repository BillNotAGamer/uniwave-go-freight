import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));
vi.mock("@/features/shipping-notes/export/drive/service", () => ({
  uploadShippingNoteExportToDrive: vi.fn(),
}));

import { getCurrentSession } from "@/lib/auth/session";
import { uploadShippingNoteExportToDrive } from "@/features/shipping-notes/export/drive/service";
import { POST } from "./route";

const mockGetCurrentSession = vi.mocked(getCurrentSession);
const mockUpload = vi.mocked(uploadShippingNoteExportToDrive);

function request(origin = "https://app.example.test") {
  return new NextRequest(
    "https://app.example.test/api/shipping-note-exports/11111111-1111-4111-8111-111111111111/drive",
    {
      method: "POST",
      headers: {
        origin,
      },
    },
  );
}

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

describe("Drive upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns safe no-store JSON for successful upload", async () => {
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
    mockUpload.mockResolvedValue({
      exportId: "11111111-1111-4111-8111-111111111111",
      driveUploadStatus: "uploaded",
      driveFileId: "drive-file-1",
      driveUrl: "https://drive.google.test/file/1",
      reconciledFromDrive: false,
    });

    const response = await POST(request(), {
      params: Promise.resolve({
        exportId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    await expect(response.json()).resolves.toStrictEqual({
      exportId: "11111111-1111-4111-8111-111111111111",
      driveUploadStatus: "uploaded",
      driveFileId: "drive-file-1",
      driveUrl: "https://drive.google.test/file/1",
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mockUpload).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      admin,
    );
  });

  it("rejects cross-origin requests before authentication", async () => {
    const response = await POST(request("https://evil.example.test"), {
      params: Promise.resolve({
        exportId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    expect(response.status).toBe(403);
    expect(mockGetCurrentSession).not.toHaveBeenCalled();
  });
});
