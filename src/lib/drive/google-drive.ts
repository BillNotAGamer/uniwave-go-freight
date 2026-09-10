import "server-only";

import { Readable } from "node:stream";

import { google } from "googleapis";

import {
  classifyGoogleDriveError,
  DRIVE_ERROR_CODES,
  DriveError,
} from "./errors";
import {
  GOOGLE_DRIVE_REQUEST_TIMEOUT_MS,
  type GoogleDriveConfig,
  readGoogleDriveConfig,
} from "./config";
import type {
  DriveArtifactUploadInput,
  DriveArtifactUploader,
  DriveFileRecord,
  DriveListResult,
  DriveUploadResult,
} from "./types";

const DRIVE_FILE_FIELDS = "id,name,webViewLink,appProperties,parents";

type GoogleDriveApiFile = {
  id?: string | null;
  name?: string | null;
  webViewLink?: string | null;
  appProperties?: Record<string, string> | null;
  parents?: string[] | null;
};

export type GoogleDriveFilesResource = {
  list(
    params: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<{ data: { files?: GoogleDriveApiFile[] | null } }>;
  create(
    params: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<{ data: GoogleDriveApiFile }>;
  get?(
    params: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<{ data: unknown }>;
  delete?(
    params: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
};

type RetryResult<T> = {
  value: T;
  retryCount: number;
};

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function buildDriveExportLookupQuery(exportId: string): string {
  return `trashed = false and appProperties has { key='uniwaveExportId' and value='${escapeDriveQueryValue(exportId)}' }`;
}

function toDriveFileRecord(file: GoogleDriveApiFile): DriveFileRecord {
  if (!file.id) {
    throw new DriveError(
      DRIVE_ERROR_CODES.UPLOAD_FAILED,
      502,
      "Google Drive response did not include a file ID.",
    );
  }

  return {
    id: file.id,
    name: file.name ?? null,
    webViewLink: file.webViewLink ?? null,
    appProperties: file.appProperties ?? {},
    parents: file.parents ?? [],
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withGoogleDriveRetry<T>(
  operation: () => Promise<T>,
  maxAdditionalRetries: number,
): Promise<RetryResult<T>> {
  let retryCount = 0;

  for (;;) {
    try {
      return {
        value: await operation(),
        retryCount,
      };
    } catch (error) {
      const driveError = classifyGoogleDriveError(error);

      if (!driveError.retryable || retryCount >= maxAdditionalRetries) {
        throw driveError;
      }

      retryCount += 1;
      await sleep(100 * retryCount);
    }
  }
}

export class GoogleDriveArtifactUploader implements DriveArtifactUploader {
  private readonly files: GoogleDriveFilesResource;
  private readonly config: GoogleDriveConfig;

  constructor(
    config: GoogleDriveConfig = readGoogleDriveConfig(),
    files?: GoogleDriveFilesResource,
  ) {
    this.config = config;

    if (files) {
      this.files = files;
      return;
    }

    const auth = new google.auth.GoogleAuth({
      credentials: config.credentials,
      scopes: [config.scope],
    });
    const drive = google.drive({ version: "v3", auth });
    this.files = drive.files as unknown as GoogleDriveFilesResource;
  }

  async findByExportId(exportId: string): Promise<DriveListResult> {
    const result = await withGoogleDriveRetry(async () => {
      const response = await this.files.list({
        q: buildDriveExportLookupQuery(exportId),
        spaces: "drive",
        corpora: "allDrives",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        fields: `files(${DRIVE_FILE_FIELDS})`,
        pageSize: 10,
      }, {
        timeout: this.config.requestTimeoutMs,
      });

      return (response.data.files ?? []).map(toDriveFileRecord);
    }, this.config.maxAdditionalRetries);

    return {
      files: result.value,
      retryCount: result.retryCount,
    };
  }

  async upload(input: DriveArtifactUploadInput): Promise<DriveUploadResult> {
    const result = await withGoogleDriveRetry(async () => {
      const response = await this.files.create({
        requestBody: {
          name: input.fileName,
          parents: [input.parentFolderId],
          appProperties: input.appProperties,
        },
        media: {
          mimeType: input.mimeType,
          body: Readable.from(input.bytes),
        },
        supportsAllDrives: true,
        fields: DRIVE_FILE_FIELDS,
      }, {
        timeout: this.config.requestTimeoutMs || GOOGLE_DRIVE_REQUEST_TIMEOUT_MS,
      });

      return toDriveFileRecord(response.data);
    }, this.config.maxAdditionalRetries);

    return {
      file: result.value,
      retryCount: result.retryCount,
    };
  }

  async delete(fileId: string): Promise<void> {
    try {
      await withGoogleDriveRetry(async () => {
        if (!this.files.delete) {
          throw new DriveError(
            DRIVE_ERROR_CODES.DELETE_FAILED,
            500,
            "Google Drive client does not support delete.",
          );
        }
        await this.files.delete(
          { fileId, supportsAllDrives: true },
          { timeout: this.config.requestTimeoutMs || GOOGLE_DRIVE_REQUEST_TIMEOUT_MS },
        );
      }, this.config.maxAdditionalRetries);
    } catch (error) {
      const driveError = classifyGoogleDriveError(error);
      if (driveError.status === 404) {
        // Missing on remote; treat as idempotent delete
        return;
      }
      throw driveError;
    }
  }

  async download(fileId: string): Promise<Buffer> {
    const result = await withGoogleDriveRetry(async () => {
      if (!this.files.get) {
        throw new DriveError(
          DRIVE_ERROR_CODES.READ_FAILED,
          500,
          "Google Drive client does not support get.",
        );
      }
      const response = await this.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        {
          responseType: "arraybuffer",
          timeout: this.config.requestTimeoutMs || GOOGLE_DRIVE_REQUEST_TIMEOUT_MS,
        },
      );
      const data = response.data;
      if (Buffer.isBuffer(data)) {
        return data;
      }
      if (data instanceof ArrayBuffer) {
        return Buffer.from(data);
      }
      if (data instanceof Uint8Array) {
        return Buffer.from(data);
      }
      if (typeof data === "object" && data !== null && Symbol.asyncIterator in data) {
        const chunks: Buffer[] = [];
        for await (const chunk of data as AsyncIterable<Uint8Array>) {
          chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      }
      return Buffer.from(String(data));
    }, this.config.maxAdditionalRetries);

    return result.value;
  }

  async getOrCreateFolder(name: string, parentFolderId: string): Promise<string> {
    const query = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${escapeDriveQueryValue(name)}' and '${escapeDriveQueryValue(parentFolderId)}' in parents`;
    const searchResult = await withGoogleDriveRetry(async () => {
      const response = await this.files.list({
        q: query,
        spaces: "drive",
        corpora: "allDrives",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        fields: "files(id,name)",
        pageSize: 1,
      }, {
        timeout: this.config.requestTimeoutMs || GOOGLE_DRIVE_REQUEST_TIMEOUT_MS,
      });
      return response.data.files?.[0]?.id ?? null;
    }, this.config.maxAdditionalRetries);

    if (searchResult.value) {
      return searchResult.value;
    }

    const created = await withGoogleDriveRetry(async () => {
      const response = await this.files.create({
        requestBody: {
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId],
        },
        supportsAllDrives: true,
        fields: "id",
      }, {
        timeout: this.config.requestTimeoutMs || GOOGLE_DRIVE_REQUEST_TIMEOUT_MS,
      });
      if (!response.data.id) {
        throw new DriveError(
          DRIVE_ERROR_CODES.UPLOAD_FAILED,
          502,
          "Failed to create Google Drive folder.",
        );
      }
      return response.data.id;
    }, this.config.maxAdditionalRetries);

    return created.value;
  }
}
