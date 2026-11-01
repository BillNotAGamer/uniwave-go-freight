import "server-only";

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { calculateArtifactSha256 } from "./checksum";
import {
  ARTIFACT_STORAGE_ERROR_CODES,
  ArtifactStorageError,
} from "./errors";
import type {
  ArtifactStorage,
  ArtifactStoragePutInput,
  StoredArtifact,
} from "./types";

export const EXPECTED_QA_POSTGRESQL_SYSTEM_IDENTIFIER = "7701384516187065248";

const MAGIC_HEADER = "UNAW_ART1\n";
const MAGIC_BUFFER = Buffer.from(MAGIC_HEADER, "utf-8"); // 10 bytes

const FORBIDDEN_CLOUD_ENV_VARS = [
  "RAILWAY_ENVIRONMENT",
  "RAILWAY_PROJECT_ID",
  "RAILWAY_SERVICE_ID",
  "RAILWAY_STATIC_URL",
  "VERCEL",
  "VERCEL_ENV",
  "CF_PAGES",
  "AWS_EXECUTION_ENV",
] as const;

const FORBIDDEN_R2_ENV_VARS = [
  "ARTIFACT_R2_ACCOUNT_ID",
  "ARTIFACT_R2_ACCESS_KEY_ID",
  "ARTIFACT_R2_SECRET_ACCESS_KEY",
  "ARTIFACT_R2_BUCKET_NAME",
] as const;

export interface LocalArtifactEnvelopeHeader {
  version: 1;
  key: string;
  sizeBytes: number;
  mimeType: string;
  checksumSha256: string;
  exportId?: string;
  createdAt: string;
}

export function assertSafeLogicalKey(
  key: string,
  operation: "read" | "write" = "write",
): void {
  const errorCode =
    operation === "read"
      ? ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED
      : ARTIFACT_STORAGE_ERROR_CODES.WRITE_FAILED;

  if (typeof key !== "string" || key.trim().length === 0) {
    throw new ArtifactStorageError(errorCode, "Artifact key must be a non-empty string.");
  }

  if (key.length > 1024) {
    throw new ArtifactStorageError(errorCode, "Artifact key exceeds maximum length of 1024 characters.");
  }

  if (key.startsWith("/") || key.endsWith("/")) {
    throw new ArtifactStorageError(errorCode, "Artifact key cannot start or end with a slash.");
  }

  if (key.includes("\\") || key.includes("\0")) {
    throw new ArtifactStorageError(errorCode, "Artifact key contains invalid path characters.");
  }

  if (key.includes("..") || key.includes("//")) {
    throw new ArtifactStorageError(
      errorCode,
      "Artifact key contains illegal directory traversal or duplicate slashes.",
    );
  }

  if (!/^[a-zA-Z0-9_.\-/]+$/.test(key)) {
    throw new ArtifactStorageError(errorCode, "Artifact key contains illegal characters.");
  }
}

export function getStorageFileName(key: string): string {
  return createHash("sha256").update(key).digest("hex") + ".blob";
}

export function assertSafeScratchRoot(scratchRoot: string): string {
  if (!scratchRoot || typeof scratchRoot !== "string" || scratchRoot.trim().length === 0) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.NOT_CONFIGURED,
      "Local scratch root path must be a non-empty string.",
    );
  }

  if (!path.isAbsolute(scratchRoot)) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.NOT_CONFIGURED,
      `Local scratch root must be an absolute path: ${scratchRoot}`,
    );
  }

  const resolvedRoot = path.resolve(scratchRoot);
  const normalizedRoot = resolvedRoot.replace(/\\/g, "/").toLowerCase();
  const normalizedCwd = process.cwd().replace(/\\/g, "/").toLowerCase();

  // Scratch root must not reside inside application working directory or repository
  if (normalizedRoot === normalizedCwd || normalizedRoot.startsWith(normalizedCwd + "/")) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.NOT_CONFIGURED,
      "Local scratch root must reside strictly outside the application repository and worktrees.",
    );
  }

  // Scratch root must not reside inside postgres database data directory
  if (
    normalizedRoot.includes("uniwave_qa_isolated_data") ||
    normalizedRoot.includes("postgres_data") ||
    normalizedRoot.includes("/pgdata") ||
    normalizedRoot.includes("\\pgdata")
  ) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.NOT_CONFIGURED,
      "Local scratch root must not point into a PostgreSQL database data directory.",
    );
  }

  if (!fs.existsSync(resolvedRoot)) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.NOT_CONFIGURED,
      `Local scratch root directory does not exist: ${resolvedRoot}`,
    );
  }

  const stat = fs.lstatSync(resolvedRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.NOT_CONFIGURED,
      `Local scratch root must be a physical directory and not a link or junction: ${resolvedRoot}`,
    );
  }

  return resolvedRoot;
}

export function assertSafeLocalScratchEnvironment(
  env: Record<string, string | undefined> = process.env,
): void {
  // 1. Explicit opt-in flags
  if (env.ARTIFACT_STORAGE_PROVIDER !== "local_qa_scratch") {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.NOT_CONFIGURED,
      "ARTIFACT_STORAGE_PROVIDER is not configured for local QA scratch storage.",
    );
  }

  if (env.UNIWAVE_ALLOW_LOCAL_QA_STORAGE !== "true") {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.NOT_CONFIGURED,
      "UNIWAVE_ALLOW_LOCAL_QA_STORAGE must be explicitly set to 'true'.",
    );
  }

  // 2. Absolute prohibition on production / cloud hosting environment variables
  for (const cloudVar of FORBIDDEN_CLOUD_ENV_VARS) {
    if (env[cloudVar] && env[cloudVar]!.trim().length > 0) {
      throw new ArtifactStorageError(
        ARTIFACT_STORAGE_ERROR_CODES.NOT_CONFIGURED,
        `Local scratch storage is forbidden in cloud hosting environment: ${cloudVar} is set.`,
      );
    }
  }

  // 3. Absolute prohibition on active R2 credentials
  for (const r2Var of FORBIDDEN_R2_ENV_VARS) {
    if (env[r2Var] && env[r2Var]!.trim().length > 0) {
      throw new ArtifactStorageError(
        ARTIFACT_STORAGE_ERROR_CODES.NOT_CONFIGURED,
        `Local scratch storage is forbidden when remote R2 credentials are present: ${r2Var} is set.`,
      );
    }
  }

  // 4. Loopback Auth URL validation
  const authUrl = (env.AUTH_URL || env.BETTER_AUTH_URL)?.trim();
  if (authUrl) {
    try {
      const parsed = new URL(authUrl);
      const host = parsed.hostname.toLowerCase();
      if (host !== "127.0.0.1" && host !== "localhost") {
        throw new Error(`Hostname '${host}' is not a loopback address.`);
      }
    } catch (err) {
      throw new ArtifactStorageError(
        ARTIFACT_STORAGE_ERROR_CODES.NOT_CONFIGURED,
        `Local scratch storage rejected non-loopback AUTH_URL: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 5. Loopback PostgreSQL validation
  const dbUrl = env.DATABASE_URL?.trim();
  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      const host = parsed.hostname.toLowerCase();
      if (host !== "127.0.0.1" && host !== "localhost") {
        throw new Error(`Hostname '${host}' is not loopback.`);
      }
      if (parsed.port && parsed.port !== "54329") {
        throw new Error(`Port '${parsed.port}' is not QA port 54329.`);
      }
      const dbName = parsed.pathname.replace(/^\//, "");
      if (dbName && dbName !== "uniwave_qa_isolated") {
        throw new Error(`Database name '${dbName}' is not 'uniwave_qa_isolated'.`);
      }
      if (dbUrl.includes("neon.tech") || dbUrl.includes("railway.app")) {
        throw new Error("DATABASE_URL contains cloud provider domain pattern.");
      }
    } catch (err) {
      throw new ArtifactStorageError(
        ARTIFACT_STORAGE_ERROR_CODES.NOT_CONFIGURED,
        `Local scratch storage rejected non-isolated DATABASE_URL: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 6. Scratch root validation
  const scratchRoot = env.ARTIFACT_LOCAL_SCRATCH_ROOT?.trim();
  if (!scratchRoot) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.NOT_CONFIGURED,
      "ARTIFACT_LOCAL_SCRATCH_ROOT must be defined and non-empty.",
    );
  }

  assertSafeScratchRoot(scratchRoot);
}

export function isSafeLocalScratchEnvironment(
  env: Record<string, string | undefined> = process.env,
): boolean {
  try {
    assertSafeLocalScratchEnvironment(env);
    return true;
  } catch {
    return false;
  }
}

export function buildEnvelope(input: ArtifactStoragePutInput): Buffer {
  const header: LocalArtifactEnvelopeHeader = {
    version: 1,
    key: input.key,
    sizeBytes: input.body.byteLength,
    mimeType: input.mimeType,
    checksumSha256: input.checksumSha256.toUpperCase(),
    exportId: input.exportId,
    createdAt: new Date().toISOString(),
  };

  const headerJson = Buffer.from(JSON.stringify(header), "utf-8");
  const headerLengthBuf = Buffer.alloc(4);
  headerLengthBuf.writeUInt32BE(headerJson.byteLength, 0);

  return Buffer.concat([MAGIC_BUFFER, headerLengthBuf, headerJson, input.body]);
}

export function parseEnvelope(buf: Buffer): {
  header: LocalArtifactEnvelopeHeader;
  body: Buffer;
} {
  if (buf.length < 14) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
      "Artifact envelope is truncated or corrupted (too short).",
    );
  }

  const magic = buf.subarray(0, 10);
  if (!magic.equals(MAGIC_BUFFER)) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
      "Artifact envelope magic header mismatch.",
    );
  }

  const headerLen = buf.readUInt32BE(10);
  if (buf.length < 14 + headerLen) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
      "Artifact envelope header length exceeds file size.",
    );
  }

  const headerJsonStr = buf.subarray(14, 14 + headerLen).toString("utf-8");
  let header: LocalArtifactEnvelopeHeader;
  try {
    header = JSON.parse(headerJsonStr);
  } catch {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
      "Artifact envelope header JSON is invalid.",
    );
  }

  if (
    header.version !== 1 ||
    typeof header.key !== "string" ||
    typeof header.sizeBytes !== "number" ||
    typeof header.checksumSha256 !== "string"
  ) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
      "Artifact envelope header schema is invalid.",
    );
  }

  const bodySlice = buf.subarray(14 + headerLen);
  if (bodySlice.byteLength !== header.sizeBytes) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
      `Artifact body size (${bodySlice.byteLength}) does not match header declaration (${header.sizeBytes}).`,
    );
  }

  const actualChecksum = calculateArtifactSha256(bodySlice);
  if (actualChecksum.toUpperCase() !== header.checksumSha256.toUpperCase()) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
      "Artifact envelope body checksum mismatch.",
    );
  }

  return {
    header,
    body: Buffer.from(bodySlice),
  };
}

async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return;
    }
    // Ignore cleanup error if already removed
  }
}

export class LocalFsArtifactStorage implements ArtifactStorage {
  readonly scratchRoot: string;

  constructor(scratchRoot: string) {
    this.scratchRoot = assertSafeScratchRoot(scratchRoot);
  }

  async put(input: ArtifactStoragePutInput): Promise<StoredArtifact> {
    assertSafeLogicalKey(input.key, "write");

    const targetFileName = getStorageFileName(input.key);
    const targetPath = path.join(this.scratchRoot, targetFileName);
    const tempFileName = `.tmp-${randomUUID()}-${Date.now()}.blob`;
    const tempPath = path.join(this.scratchRoot, tempFileName);

    const envelopeBuffer = buildEnvelope(input);

    // Write envelope to unique temporary file first
    try {
      await fs.promises.writeFile(tempPath, envelopeBuffer, { flag: "wx" });
    } catch (writeError) {
      await safeUnlink(tempPath);
      throw new ArtifactStorageError(
        ARTIFACT_STORAGE_ERROR_CODES.WRITE_FAILED,
        `Failed to write temporary artifact file: ${writeError instanceof Error ? writeError.message : String(writeError)}`,
      );
    }

    try {
      // 1. Check if target object already exists
      if (fs.existsSync(targetPath)) {
        let existingEnvelope: { header: LocalArtifactEnvelopeHeader; body: Buffer };
        try {
          const existingBytes = await fs.promises.readFile(targetPath);
          existingEnvelope = parseEnvelope(existingBytes);
        } catch {
          // If existing file cannot be parsed, reject overwrite to protect forensics
          await safeUnlink(tempPath);
          throw new ArtifactStorageError(
            ARTIFACT_STORAGE_ERROR_CODES.WRITE_FAILED,
            "Target artifact already exists in an unreadable state and cannot be overwritten.",
          );
        }

        const normalizedInputChecksum = input.checksumSha256.toUpperCase();
        const normalizedExistingChecksum = existingEnvelope.header.checksumSha256.toUpperCase();

        if (normalizedInputChecksum === normalizedExistingChecksum) {
          // Idempotent write: clean up temp file and return existing stored artifact
          await safeUnlink(tempPath);
          return {
            key: existingEnvelope.header.key,
            sizeBytes: existingEnvelope.header.sizeBytes,
            mimeType: existingEnvelope.header.mimeType,
          };
        } else {
          // Conflict: different content exists. Do NOT overwrite!
          await safeUnlink(tempPath);
          throw new ArtifactStorageError(
            ARTIFACT_STORAGE_ERROR_CODES.WRITE_FAILED,
            "Object already exists with different content.",
          );
        }
      }

      // 2. Publish atomically using hard link
      try {
        await fs.promises.link(tempPath, targetPath);
        await safeUnlink(tempPath);
      } catch (linkError: unknown) {
        if (
          linkError &&
          typeof linkError === "object" &&
          "code" in linkError &&
          linkError.code === "EEXIST"
        ) {
          // Race condition: another concurrent writer published the target first
          await safeUnlink(tempPath);
          const winningBytes = await fs.promises.readFile(targetPath);
          const winner = parseEnvelope(winningBytes);

          if (winner.header.checksumSha256.toUpperCase() === input.checksumSha256.toUpperCase()) {
            return {
              key: winner.header.key,
              sizeBytes: winner.header.sizeBytes,
              mimeType: winner.header.mimeType,
            };
          } else {
            throw new ArtifactStorageError(
              ARTIFACT_STORAGE_ERROR_CODES.WRITE_FAILED,
              "Object already exists with different content.",
            );
          }
        }

        throw linkError;
      }

      return {
        key: input.key,
        sizeBytes: input.body.byteLength,
        mimeType: input.mimeType,
      };
    } catch (error) {
      // Cleanup: only clean up temporary file. Never delete or corrupt target file!
      await safeUnlink(tempPath);

      if (error instanceof ArtifactStorageError) {
        throw error;
      }

      throw new ArtifactStorageError(
        ARTIFACT_STORAGE_ERROR_CODES.WRITE_FAILED,
        `Artifact storage write failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async get(key: string): Promise<Buffer> {
    assertSafeLogicalKey(key, "read");

    const targetFileName = getStorageFileName(key);
    const targetPath = path.join(this.scratchRoot, targetFileName);

    let rawBuffer: Buffer;
    try {
      rawBuffer = await fs.promises.readFile(targetPath);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        throw new ArtifactStorageError(
          ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
          `Artifact object not found for key: ${key}`,
        );
      }

      throw new ArtifactStorageError(
        ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
        `Failed to read artifact object: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const { header, body } = parseEnvelope(rawBuffer);

    if (header.key !== key) {
      throw new ArtifactStorageError(
        ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
        `Artifact key in envelope (${header.key}) does not match requested key (${key}).`,
      );
    }

    return body;
  }

  async delete(key: string): Promise<void> {
    assertSafeLogicalKey(key, "write");

    const targetFileName = getStorageFileName(key);
    const targetPath = path.join(this.scratchRoot, targetFileName);

    try {
      await fs.promises.unlink(targetPath);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        // Idempotent delete: key does not exist, consider deleted
        return;
      }

      throw new ArtifactStorageError(
        ARTIFACT_STORAGE_ERROR_CODES.WRITE_FAILED,
        `Failed to delete artifact object: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
