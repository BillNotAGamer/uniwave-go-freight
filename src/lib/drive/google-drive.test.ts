import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("googleapis", () => ({
  google: {
    auth: {
      GoogleAuth: vi.fn(),
    },
    drive: vi.fn(),
  },
}));

import {
  GOOGLE_DRIVE_SCOPE,
  readGoogleDriveConfig,
  type GoogleDriveConfig,
} from "./config";
import {
  DRIVE_ERROR_CODES,
  classifyGoogleDriveError,
} from "./errors";
import {
  GoogleDriveArtifactUploader,
  buildDriveExportLookupQuery,
  type GoogleDriveFilesResource,
} from "./google-drive";

const config: GoogleDriveConfig = {
  credentials: {
    type: "service_account",
    client_email: "drive-bot@example.test",
    private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
  },
  rootFolderId: "root-folder-1",
  scope: GOOGLE_DRIVE_SCOPE,
  requestTimeoutMs: 30_000,
  maxAdditionalRetries: 2,
};

describe("Google Drive config", () => {
  it("parses service account JSON and root folder configuration", () => {
    expect(readGoogleDriveConfig({
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify(config.credentials),
      GOOGLE_DRIVE_ROOT_FOLDER_ID: " root-folder-1 ",
    })).toMatchObject({
      credentials: config.credentials,
      rootFolderId: "root-folder-1",
      scope: "https://www.googleapis.com/auth/drive.file",
    });
  });

  it("rejects missing or malformed service account configuration", () => {
    expect(() => readGoogleDriveConfig({})).toThrow(/not configured/i);
    expect(() => readGoogleDriveConfig({
      GOOGLE_SERVICE_ACCOUNT_JSON: "{bad json",
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "root",
    })).toThrow(/invalid/i);
    expect(() => readGoogleDriveConfig({
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "bad" }),
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "root",
    })).toThrow(/missing/i);
  });
});

describe("Google Drive adapter request mapping", () => {
  it("builds an escaped appProperties lookup query", () => {
    expect(buildDriveExportLookupQuery("export-'1")).toBe(
      "trashed = false and appProperties has { key='uniwaveExportId' and value='export-\\'1' }",
    );
  });

  it("searches by export appProperties with Shared Drive support", async () => {
    const list = vi.fn<GoogleDriveFilesResource["list"]>().mockResolvedValue({
      data: {
        files: [{
          id: "drive-file-1",
          name: "artifact.xlsx",
          webViewLink: "https://drive.google.test/file/1",
          appProperties: { uniwaveExportId: "export-1" },
          parents: ["root-folder-1"],
        }],
      },
    });
    const create = vi.fn<GoogleDriveFilesResource["create"]>();
    const uploader = new GoogleDriveArtifactUploader(config, { list, create });

    await expect(uploader.findByExportId("export-1")).resolves.toMatchObject({
      files: [{ id: "drive-file-1" }],
      retryCount: 0,
    });

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "trashed = false and appProperties has { key='uniwaveExportId' and value='export-1' }",
        spaces: "drive",
        corpora: "allDrives",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        fields: "files(id,name,webViewLink,appProperties,parents)",
        pageSize: 10,
      }),
      { timeout: 30_000 },
    );
  });

  it("creates files with persisted filename, parent folder, appProperties, MIME, and Shared Drive support", async () => {
    const list = vi.fn<GoogleDriveFilesResource["list"]>();
    const create = vi.fn<GoogleDriveFilesResource["create"]>().mockResolvedValue({
      data: {
        id: "drive-file-2",
        name: "ShippingNote_TEST.pdf",
        webViewLink: "https://drive.google.test/file/2",
        appProperties: {
          uniwaveExportId: "export-2",
          uniwaveShippingNoteId: "note-2",
          uniwaveExportType: "pdf",
          uniwaveExportVersion: "1",
          uniwaveChecksumSha256: "ABC",
        },
        parents: ["root-folder-1"],
      },
    });
    const uploader = new GoogleDriveArtifactUploader(config, { list, create });

    await uploader.upload({
      fileName: "ShippingNote_TEST.pdf",
      mimeType: "application/pdf",
      bytes: Buffer.from("pdf"),
      parentFolderId: "root-folder-1",
      appProperties: {
        uniwaveExportId: "export-2",
        uniwaveShippingNoteId: "note-2",
        uniwaveExportType: "pdf",
        uniwaveExportVersion: "1",
        uniwaveChecksumSha256: "ABC",
      },
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: {
          name: "ShippingNote_TEST.pdf",
          parents: ["root-folder-1"],
          appProperties: {
            uniwaveExportId: "export-2",
            uniwaveShippingNoteId: "note-2",
            uniwaveExportType: "pdf",
            uniwaveExportVersion: "1",
            uniwaveChecksumSha256: "ABC",
          },
        },
        media: expect.objectContaining({
          mimeType: "application/pdf",
        }),
        supportsAllDrives: true,
        fields: "id,name,webViewLink,appProperties,parents",
      }),
      { timeout: 30_000 },
    );
  });

  it("classifies sanitized Google API failures", () => {
    expect(classifyGoogleDriveError({ code: 401 }).code).toBe(
      DRIVE_ERROR_CODES.AUTH_FAILED,
    );
    expect(classifyGoogleDriveError({ code: 403 }).code).toBe(
      DRIVE_ERROR_CODES.PERMISSION_DENIED,
    );
    expect(classifyGoogleDriveError({ code: 404 }).code).toBe(
      DRIVE_ERROR_CODES.FOLDER_NOT_FOUND,
    );
    expect(classifyGoogleDriveError({ code: 429 }).code).toBe(
      DRIVE_ERROR_CODES.RATE_LIMITED,
    );
    expect(classifyGoogleDriveError({ code: 500 }).code).toBe(
      DRIVE_ERROR_CODES.TEMPORARY_FAILURE,
    );
  });
});
