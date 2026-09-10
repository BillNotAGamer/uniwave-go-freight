export type DriveAppProperties = {
  uniwaveExportId: string;
  uniwaveShippingNoteId: string;
  uniwaveExportType: string;
  uniwaveExportVersion: string;
  uniwaveChecksumSha256: string;
};

export type DriveFileRecord = {
  id: string;
  name: string | null;
  webViewLink: string | null;
  appProperties: Record<string, string>;
  parents: string[];
};

export type DriveListResult = {
  files: DriveFileRecord[];
  retryCount: number;
};

export type DriveUploadResult = {
  file: DriveFileRecord;
  retryCount: number;
};

export type DriveArtifactUploadInput = {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  appProperties: Record<string, string>;
  parentFolderId: string;
};

export interface DriveArtifactUploader {
  findByExportId(exportId: string): Promise<DriveListResult>;
  upload(input: DriveArtifactUploadInput): Promise<DriveUploadResult>;
  delete?(fileId: string): Promise<void>;
  download?(fileId: string): Promise<Buffer>;
  getOrCreateFolder?(name: string, parentFolderId: string): Promise<string>;
}
