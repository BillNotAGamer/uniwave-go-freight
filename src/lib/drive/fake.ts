import { DRIVE_ERROR_CODES, DriveError } from "./errors";
import type {
  DriveArtifactUploadInput,
  DriveArtifactUploader,
  DriveFileRecord,
  DriveListResult,
  DriveUploadResult,
} from "./types";

export class FakeDriveArtifactUploader implements DriveArtifactUploader {
  private readonly files = new Map<string, DriveFileRecord[]>();
  private uploadCounter = 0;
  private folderCounter = 0;
  private findError: DriveError | null = null;
  private uploadError: DriveError | null = null;
  private deleteError: DriveError | null = null;
  private downloadError: DriveError | null = null;
  readonly uploads: DriveArtifactUploadInput[] = [];
  readonly deletedFileIds: string[] = [];
  readonly folders = new Map<string, { id: string; name: string; parentId: string }>();

  seedFile(file: DriveFileRecord): void {
    const exportId = file.appProperties?.uniwaveExportId ?? file.id;
    this.files.set(exportId, [...(this.files.get(exportId) ?? []), file]);
  }

  failNextFind(error = new DriveError(
    DRIVE_ERROR_CODES.TEMPORARY_FAILURE,
    503,
    "Fake Drive lookup failed.",
    { retryable: true },
  )): void {
    this.findError = error;
  }

  failNextUpload(error = new DriveError(
    DRIVE_ERROR_CODES.UPLOAD_FAILED,
    502,
    "Fake Drive upload failed.",
  )): void {
    this.uploadError = error;
  }

  failNextDelete(error = new DriveError(
    DRIVE_ERROR_CODES.DELETE_FAILED,
    500,
    "Fake Drive delete failed.",
  )): void {
    this.deleteError = error;
  }

  failNextDownload(error = new DriveError(
    DRIVE_ERROR_CODES.READ_FAILED,
    500,
    "Fake Drive download failed.",
  )): void {
    this.downloadError = error;
  }

  async findByExportId(exportId: string): Promise<DriveListResult> {
    if (this.findError) {
      const error = this.findError;
      this.findError = null;
      throw error;
    }

    return {
      files: [...(this.files.get(exportId) ?? [])],
      retryCount: 0,
    };
  }

  async upload(input: DriveArtifactUploadInput): Promise<DriveUploadResult> {
    if (this.uploadError) {
      const error = this.uploadError;
      this.uploadError = null;
      throw error;
    }

    this.uploads.push({
      ...input,
      bytes: Buffer.from(input.bytes),
    });

    this.uploadCounter += 1;

    const file: DriveFileRecord = {
      id: `fake-drive-file-${this.uploadCounter}`,
      name: input.fileName,
      webViewLink: `https://drive.google.test/file/${this.uploadCounter}`,
      appProperties: input.appProperties,
      parents: [input.parentFolderId],
    };

    this.seedFile(file);

    return {
      file,
      retryCount: 0,
    };
  }

  async delete(fileId: string): Promise<void> {
    if (this.deleteError) {
      const error = this.deleteError;
      this.deleteError = null;
      throw error;
    }

    this.deletedFileIds.push(fileId);
    for (const [key, list] of this.files.entries()) {
      this.files.set(
        key,
        list.filter((f) => f.id !== fileId),
      );
    }
  }

  async download(fileId: string): Promise<Buffer> {
    if (this.downloadError) {
      const error = this.downloadError;
      this.downloadError = null;
      throw error;
    }

    const matchingUpload = this.uploads.find((u) => {
      // Look up in files
      for (const list of this.files.values()) {
        const found = list.find((f) => f.id === fileId);
        if (found && found.name === u.fileName) {
          return true;
        }
      }
      return false;
    });

    if (matchingUpload) {
      return Buffer.from(matchingUpload.bytes);
    }

    // Default fake bytes if seeded directly
    return Buffer.from(`fake-drive-content-${fileId}`);
  }

  async getOrCreateFolder(name: string, parentFolderId: string): Promise<string> {
    const key = `${parentFolderId}::${name}`;
    const existing = this.folders.get(key);
    if (existing) {
      return existing.id;
    }

    this.folderCounter += 1;
    const id = `fake-folder-${this.folderCounter}`;
    this.folders.set(key, { id, name, parentId: parentFolderId });
    return id;
  }
}
