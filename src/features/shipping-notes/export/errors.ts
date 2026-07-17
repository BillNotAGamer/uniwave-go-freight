export const EXPORT_ERROR_CODES = {
  UNAUTHENTICATED: "EXPORT_UNAUTHENTICATED",
  PERMISSION_DENIED: "EXPORT_PERMISSION_DENIED",
  ORIGIN_DENIED: "EXPORT_ORIGIN_DENIED",
  NOTE_NOT_FOUND: "EXPORT_NOTE_NOT_FOUND",
  STATUS_NOT_ELIGIBLE: "EXPORT_STATUS_NOT_ELIGIBLE",
  TEMPLATE_NOT_FOUND: "EXPORT_TEMPLATE_NOT_FOUND",
  TEMPLATE_HASH_MISMATCH: "EXPORT_TEMPLATE_HASH_MISMATCH",
  TEMPLATE_INVALID: "EXPORT_TEMPLATE_INVALID",
  TEMPLATE_CAPACITY_EXCEEDED: "TEMPLATE_CAPACITY_EXCEEDED",
  INVALID_DATA: "EXPORT_INVALID_DATA",
  GENERATION_FAILED: "EXPORT_GENERATION_FAILED",
} as const;

export type ExportErrorCode =
  (typeof EXPORT_ERROR_CODES)[keyof typeof EXPORT_ERROR_CODES];

export class ExportError extends Error {
  readonly code: ExportErrorCode;
  readonly status: number;

  constructor(code: ExportErrorCode, status: number, message: string) {
    super(message);
    this.name = "ExportError";
    this.code = code;
    this.status = status;
  }
}
