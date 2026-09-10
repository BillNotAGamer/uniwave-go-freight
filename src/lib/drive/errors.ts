export const DRIVE_ERROR_CODES = {
  NOT_CONFIGURED: "DRIVE_NOT_CONFIGURED",
  AUTH_FAILED: "DRIVE_AUTH_FAILED",
  PERMISSION_DENIED: "DRIVE_PERMISSION_DENIED",
  FOLDER_NOT_FOUND: "DRIVE_FOLDER_NOT_FOUND",
  RATE_LIMITED: "DRIVE_RATE_LIMITED",
  TEMPORARY_FAILURE: "DRIVE_TEMPORARY_FAILURE",
  DUPLICATE_ARTIFACT: "DRIVE_DUPLICATE_ARTIFACT",
  RECONCILIATION_CONFLICT: "DRIVE_RECONCILIATION_CONFLICT",
  ARTIFACT_STORAGE_READ_FAILED: "ARTIFACT_STORAGE_READ_FAILED",
  ARTIFACT_CHECKSUM_MISMATCH: "ARTIFACT_CHECKSUM_MISMATCH",
  UPLOAD_FAILED: "DRIVE_UPLOAD_FAILED",
  DELETE_FAILED: "DRIVE_DELETE_FAILED",
  READ_FAILED: "DRIVE_READ_FAILED",
  FILE_NOT_FOUND: "DRIVE_FILE_NOT_FOUND",
  UPLOAD_IN_PROGRESS: "DRIVE_UPLOAD_IN_PROGRESS",
  UPLOAD_STALE: "DRIVE_UPLOAD_STALE",
  ARTIFACT_NOT_ELIGIBLE: "DRIVE_ARTIFACT_NOT_ELIGIBLE",
  EXPORT_NOT_FOUND: "DRIVE_EXPORT_NOT_FOUND",
  INVALID_EXPORT_ID: "DRIVE_INVALID_EXPORT_ID",
} as const;

export type DriveErrorCode =
  (typeof DRIVE_ERROR_CODES)[keyof typeof DRIVE_ERROR_CODES];

export class DriveError extends Error {
  readonly code: DriveErrorCode;
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    code: DriveErrorCode,
    status: number,
    message: string,
    options: { retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "DriveError";
    this.code = code;
    this.status = status;
    this.retryable = options.retryable ?? false;
  }
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function numericStatus(error: unknown): number | null {
  const record = objectRecord(error);
  const directStatus = record?.status ?? record?.code;

  if (typeof directStatus === "number") {
    return directStatus;
  }

  const response = objectRecord(record?.response);
  const responseStatus = response?.status;

  return typeof responseStatus === "number" ? responseStatus : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

export function classifyGoogleDriveError(error: unknown): DriveError {
  if (error instanceof DriveError) {
    return error;
  }

  const status = numericStatus(error);
  const message = errorMessage(error);
  const normalizedMessage = message.toLowerCase();

  if (status === 401) {
    return new DriveError(
      DRIVE_ERROR_CODES.AUTH_FAILED,
      502,
      "Google Drive authentication failed.",
    );
  }

  if (status === 403) {
    return new DriveError(
      DRIVE_ERROR_CODES.PERMISSION_DENIED,
      502,
      "Google Drive permission was denied.",
    );
  }

  if (status === 404) {
    return new DriveError(
      DRIVE_ERROR_CODES.FOLDER_NOT_FOUND,
      502,
      "Configured Google Drive folder was not found.",
    );
  }

  if (status === 429) {
    return new DriveError(
      DRIVE_ERROR_CODES.RATE_LIMITED,
      503,
      "Google Drive rate limit was reached.",
      { retryable: true },
    );
  }

  if (status !== null && status >= 500) {
    return new DriveError(
      DRIVE_ERROR_CODES.TEMPORARY_FAILURE,
      503,
      "Google Drive returned a temporary failure.",
      { retryable: true },
    );
  }

  if (
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("econnreset") ||
    normalizedMessage.includes("etimedout")
  ) {
    return new DriveError(
      DRIVE_ERROR_CODES.TEMPORARY_FAILURE,
      503,
      "Google Drive request timed out.",
      { retryable: true },
    );
  }

  return new DriveError(
    DRIVE_ERROR_CODES.UPLOAD_FAILED,
    502,
    "Google Drive upload failed.",
  );
}
