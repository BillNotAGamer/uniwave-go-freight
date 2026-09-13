export const MAX_DOCUMENT_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_DOCUMENT_FILE_NAME_LENGTH = 255;

export const ALLOWED_DOCUMENT_EXTENSIONS: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const DANGEROUS_OR_DISALLOWED_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "ps1",
  "js",
  "mjs",
  "cjs",
  "vbs",
  "scr",
  "sh",
  "bin",
  "msi",
  "dll",
  "com",
  "hta",
  "jar",
  "vbe",
  "wsf",
  "reg",
  "app",
  "deb",
  "rpm",
  "apk",
  "pif",
  "cpl",
  "svg",
  "html",
  "htm",
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
  "doc",
  "docx",
  "xls",
  "xlsx",
]);

export type FileValidationSuccess = {
  valid: true;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type FileValidationFailure = {
  valid: false;
  error: string;
};

export type FileValidationResult = FileValidationSuccess | FileValidationFailure;

export function extractFileExtension(fileName: string): string {
  const parts = fileName.trim().split(".");
  if (parts.length < 2) {
    return "";
  }
  return parts.pop()?.toLowerCase() ?? "";
}

/**
 * Validates magic bytes / file signatures against expected format:
 * - PDF:  %PDF- (25 50 44 46 2D)
 * - JPEG: FF D8 FF
 * - PNG:  89 50 4E 47 0D 0A 1A 0A
 * - WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
 */
export function verifyFileSignature(bytes: Buffer | Uint8Array, extension: string): boolean {
  if (!bytes || bytes.length < 3) {
    return false;
  }

  const ext = extension.toLowerCase();

  switch (ext) {
    case "pdf": {
      if (bytes.length < 5) return false;
      return (
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46 &&
        bytes[4] === 0x2d
      );
    }
    case "jpg":
    case "jpeg": {
      return (
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      );
    }
    case "png": {
      if (bytes.length < 8) return false;
      return (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    }
    case "webp": {
      if (bytes.length < 12) return false;
      const isRiff =
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46;
      const isWebp =
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50;
      return isRiff && isWebp;
    }
    default:
      return false;
  }
}

export function validateDocumentFile(file: {
  name: string;
  size: number;
  type?: string | null;
  bytes?: Buffer | Uint8Array;
}): FileValidationResult {
  const trimmedName = file.name.trim();

  if (!trimmedName) {
    return { valid: false, error: "File name is required." };
  }

  if (trimmedName.length > MAX_DOCUMENT_FILE_NAME_LENGTH) {
    return {
      valid: false,
      error: `File name exceeds maximum permitted length of ${MAX_DOCUMENT_FILE_NAME_LENGTH} characters.`,
    };
  }

  if (file.size <= 0) {
    return { valid: false, error: "Uploaded file cannot be empty." };
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 15 MB limit (file is ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  const extension = extractFileExtension(trimmedName);

  if (!extension) {
    return {
      valid: false,
      error: "File must have a valid extension (e.g. .pdf, .jpg, .jpeg, .png, .webp).",
    };
  }

  if (DANGEROUS_OR_DISALLOWED_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: `File type .${extension} is not permitted for security reasons. Only PDF, JPG, PNG, and WEBP are allowed.`,
    };
  }

  const expectedMime = ALLOWED_DOCUMENT_EXTENSIONS[extension];
  if (!expectedMime) {
    return {
      valid: false,
      error: `Unsupported file extension .${extension}. Permitted formats: PDF, JPG, PNG, WEBP.`,
    };
  }

  // Verify MIME type if provided by client
  let resolvedMime = expectedMime;
  if (file.type && file.type.trim().length > 0) {
    const rawMime = file.type.toLowerCase().trim();

    // Reject arbitrary octet-stream or unapproved MIME types
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(rawMime)) {
      return {
        valid: false,
        error: `MIME type "${rawMime}" is not permitted. Permitted types: ${Array.from(ALLOWED_DOCUMENT_MIME_TYPES).join(", ")}.`,
      };
    }

    // Verify extension/MIME combination consistency
    if (rawMime !== expectedMime) {
      return {
        valid: false,
        error: `File extension .${extension} does not match provided MIME type "${rawMime}".`,
      };
    }

    resolvedMime = rawMime;
  }

  // Verify file magic bytes / signature if bytes are provided
  if (file.bytes) {
    if (file.bytes.length === 0) {
      return { valid: false, error: "Uploaded file content cannot be empty." };
    }

    const signatureValid = verifyFileSignature(file.bytes, extension);
    if (!signatureValid) {
      return {
        valid: false,
        error: `File content does not match the expected signature for .${extension}.`,
      };
    }
  }

  return {
    valid: true,
    originalFileName: trimmedName,
    mimeType: resolvedMime,
    sizeBytes: file.size,
  };
}
