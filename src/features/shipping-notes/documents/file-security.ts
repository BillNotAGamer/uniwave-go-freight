export const MAX_DOCUMENT_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_DOCUMENT_FILE_NAME_LENGTH = 255;

export const ALLOWED_DOCUMENT_EXTENSIONS: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export const DANGEROUS_EXTENSIONS = new Set([
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

export function validateDocumentFile(file: {
  name: string;
  size: number;
  type?: string | null;
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
      error: "File must have a valid extension (e.g. .pdf, .docx, .xlsx, .png, .jpg).",
    };
  }

  if (DANGEROUS_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: `File type .${extension} is not permitted for security reasons.`,
    };
  }

  const expectedMime = ALLOWED_DOCUMENT_EXTENSIONS[extension];
  if (!expectedMime) {
    return {
      valid: false,
      error: `Unsupported file extension .${extension}. Permitted formats: PDF, Word (DOC/DOCX), Excel (XLS/XLSX), Images (PNG/JPG/WEBP).`,
    };
  }

  // Use provided mimeType if valid/specific, otherwise normalize to known expectedMime for the extension
  let resolvedMime = expectedMime;
  if (file.type && file.type !== "application/octet-stream" && file.type.includes("/")) {
    const rawMime = file.type.toLowerCase().trim();
    // Verify client MIME is compatible with allowed extensions
    if (Object.values(ALLOWED_DOCUMENT_EXTENSIONS).includes(rawMime)) {
      resolvedMime = rawMime;
    }
  }

  return {
    valid: true,
    originalFileName: trimmedName,
    mimeType: resolvedMime,
    sizeBytes: file.size,
  };
}
