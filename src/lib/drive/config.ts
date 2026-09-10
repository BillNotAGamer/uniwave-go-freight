import "server-only";

import { z } from "zod";

import { DRIVE_ERROR_CODES, DriveError } from "./errors";

export const GOOGLE_DRIVE_SCOPE =
  "https://www.googleapis.com/auth/drive.file";

export const GOOGLE_DRIVE_REQUEST_TIMEOUT_MS = 30_000;
export const GOOGLE_DRIVE_MAX_ADDITIONAL_RETRIES = 2;

const serviceAccountSchema = z.object({
  type: z.string().optional(),
  client_email: z.string().email(),
  private_key: z.string().min(1),
}).passthrough();

const driveConfigSchema = z.object({
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().min(1),
  GOOGLE_DRIVE_ROOT_FOLDER_ID: z.string().trim().min(1),
});

export type GoogleServiceAccountCredentials = z.infer<
  typeof serviceAccountSchema
>;

export type GoogleDriveConfig = {
  credentials: GoogleServiceAccountCredentials;
  rootFolderId: string;
  scope: typeof GOOGLE_DRIVE_SCOPE;
  requestTimeoutMs: number;
  maxAdditionalRetries: number;
};

export function isGoogleDriveConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const parsedEnv = driveConfigSchema.safeParse(env);
  if (!parsedEnv.success) {
    return false;
  }
  try {
    const rawCredential = JSON.parse(parsedEnv.data.GOOGLE_SERVICE_ACCOUNT_JSON);
    return serviceAccountSchema.safeParse(rawCredential).success;
  } catch {
    return false;
  }
}

export function readGoogleDriveConfig(
  env: Record<string, string | undefined> = process.env,
): GoogleDriveConfig {
  const parsedEnv = driveConfigSchema.safeParse(env);

  if (!parsedEnv.success) {
    throw new DriveError(
      DRIVE_ERROR_CODES.NOT_CONFIGURED,
      500,
      "Google Drive upload is not configured.",
    );
  }

  let rawCredential: unknown;

  try {
    rawCredential = JSON.parse(parsedEnv.data.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new DriveError(
      DRIVE_ERROR_CODES.NOT_CONFIGURED,
      500,
      "Google service account JSON is invalid.",
    );
  }

  const parsedCredential = serviceAccountSchema.safeParse(rawCredential);

  if (!parsedCredential.success) {
    throw new DriveError(
      DRIVE_ERROR_CODES.NOT_CONFIGURED,
      500,
      "Google service account JSON is missing required fields.",
    );
  }

  return {
    credentials: parsedCredential.data,
    rootFolderId: parsedEnv.data.GOOGLE_DRIVE_ROOT_FOLDER_ID.trim(),
    scope: GOOGLE_DRIVE_SCOPE,
    requestTimeoutMs: GOOGLE_DRIVE_REQUEST_TIMEOUT_MS,
    maxAdditionalRetries: GOOGLE_DRIVE_MAX_ADDITIONAL_RETRIES,
  };
}
