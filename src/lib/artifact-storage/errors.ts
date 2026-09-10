export const ARTIFACT_STORAGE_ERROR_CODES = {
  NOT_CONFIGURED: "ARTIFACT_STORAGE_NOT_CONFIGURED",
  WRITE_FAILED: "ARTIFACT_STORAGE_WRITE_FAILED",
  READ_FAILED: "ARTIFACT_STORAGE_READ_FAILED",
  CHECKSUM_MISMATCH: "ARTIFACT_CHECKSUM_MISMATCH",
} as const;

export type ArtifactStorageErrorCode =
  (typeof ARTIFACT_STORAGE_ERROR_CODES)[keyof typeof ARTIFACT_STORAGE_ERROR_CODES];

export class ArtifactStorageError extends Error {
  readonly code: ArtifactStorageErrorCode;

  constructor(code: ArtifactStorageErrorCode, message: string) {
    super(message);
    this.name = "ArtifactStorageError";
    this.code = code;
  }
}
