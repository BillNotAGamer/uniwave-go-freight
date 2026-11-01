import "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54329/uniwave_qa_isolated",
    AUTH_SECRET: "mock-auth-secret-for-test-0123456789",
    AUTH_URL: "http://127.0.0.1:3101",
  },
}));
vi.mock("@/lib/db/client", () => ({ db: {} }));

import { getStorageAvailability } from "@/features/shipping-notes/documents/service";

import { calculateArtifactSha256 } from "./checksum";
import {
  ARTIFACT_STORAGE_ERROR_CODES,
  ArtifactStorageError,
} from "./errors";
import {
  getArtifactStorage,
  isArtifactStorageConfigured,
} from "./index";
import {
  EXPECTED_QA_POSTGRESQL_SYSTEM_IDENTIFIER,
  LocalFsArtifactStorage,
  assertSafeLocalScratchEnvironment,
  assertSafeLogicalKey,
  assertSafeScratchRoot,
  getStorageFileName,
  isSafeLocalScratchEnvironment,
  parseEnvelope,
} from "./local-scratch";
import { R2ArtifactStorage } from "./r2";

function createTempScratchDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "uniwave-scratch-test-"));
}

describe("LocalFsArtifactStorage and Zero-Egress Storage Gates (STG-01 to STG-20)", () => {
  let scratchDir: string;

  beforeEach(() => {
    scratchDir = createTempScratchDir();
  });

  afterEach(() => {
    if (scratchDir && fs.existsSync(scratchDir)) {
      try {
        fs.rmSync(scratchDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup error in test tear-down
      }
    }
  });

  function getValidQaEnv(): Record<string, string | undefined> {
    return {
      ARTIFACT_STORAGE_PROVIDER: "local_qa_scratch",
      UNIWAVE_ALLOW_LOCAL_QA_STORAGE: "true",
      ARTIFACT_LOCAL_SCRATCH_ROOT: scratchDir,
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54329/uniwave_qa_isolated",
      AUTH_URL: "http://127.0.0.1:3101",
    };
  }

  // STG-01: Production/cloud guard rejection
  it("STG-01: rejects local scratch storage if any cloud hosting environment variable is present", () => {
    const cloudVars = [
      "RAILWAY_ENVIRONMENT",
      "RAILWAY_PROJECT_ID",
      "RAILWAY_SERVICE_ID",
      "RAILWAY_STATIC_URL",
      "VERCEL",
      "VERCEL_ENV",
      "CF_PAGES",
      "AWS_EXECUTION_ENV",
    ] as const;

    for (const cloudVar of cloudVars) {
      const env = {
        ...getValidQaEnv(),
        [cloudVar]: "production",
      };

      expect(() => assertSafeLocalScratchEnvironment(env)).toThrow(ArtifactStorageError);
      expect(() => assertSafeLocalScratchEnvironment(env)).toThrow(
        /forbidden in cloud hosting environment/i,
      );
      expect(isSafeLocalScratchEnvironment(env)).toBe(false);
    }
  });

  // STG-02: R2 default unchanged when provider unset
  it("STG-02: maintains R2 as default provider when ARTIFACT_STORAGE_PROVIDER is unset", () => {
    const envWithoutProvider: Record<string, string | undefined> = {
      ARTIFACT_R2_ACCOUNT_ID: "acc1",
      ARTIFACT_R2_ACCESS_KEY_ID: "key1",
      ARTIFACT_R2_SECRET_ACCESS_KEY: "secret1",
      ARTIFACT_R2_BUCKET_NAME: "bucket1",
    };

    expect(isArtifactStorageConfigured(envWithoutProvider)).toBe(true);
    const storage = getArtifactStorage(envWithoutProvider);
    expect(storage).toBeInstanceOf(R2ArtifactStorage);
  });

  // STG-03: Invalid provider fail closed
  it("STG-03: fails closed when ARTIFACT_STORAGE_PROVIDER has an unknown value", () => {
    const invalidEnv = {
      ...getValidQaEnv(),
      ARTIFACT_STORAGE_PROVIDER: "s3_custom",
    };

    expect(isArtifactStorageConfigured(invalidEnv)).toBe(false);
    expect(() => getArtifactStorage(invalidEnv)).toThrow(ArtifactStorageError);
    expect(() => getArtifactStorage(invalidEnv)).toThrow(/Unsupported artifact storage provider/i);
  });

  // STG-04: Missing or malformed QA config
  it("STG-04: fails closed when QA configuration is missing, malformed, or ambiguous", () => {
    // Missing UNIWAVE_ALLOW_LOCAL_QA_STORAGE
    expect(() =>
      assertSafeLocalScratchEnvironment({
        ...getValidQaEnv(),
        UNIWAVE_ALLOW_LOCAL_QA_STORAGE: undefined,
      }),
    ).toThrow(/UNIWAVE_ALLOW_LOCAL_QA_STORAGE must be explicitly set/i);

    // Empty ARTIFACT_LOCAL_SCRATCH_ROOT
    expect(() =>
      assertSafeLocalScratchEnvironment({
        ...getValidQaEnv(),
        ARTIFACT_LOCAL_SCRATCH_ROOT: "",
      }),
    ).toThrow(/ARTIFACT_LOCAL_SCRATCH_ROOT must be defined/i);

    // R2 credentials present while attempting local scratch
    expect(() =>
      assertSafeLocalScratchEnvironment({
        ...getValidQaEnv(),
        ARTIFACT_R2_ACCOUNT_ID: "account-forbidden",
      }),
    ).toThrow(/remote R2 credentials are present/i);

    // Non-loopback database URL
    expect(() =>
      assertSafeLocalScratchEnvironment({
        ...getValidQaEnv(),
        DATABASE_URL: "postgresql://user:pass@remote.db.com:5432/uniwave_qa_isolated",
      }),
    ).toThrow(/rejected non-isolated DATABASE_URL/i);

    // Wrong database port
    expect(() =>
      assertSafeLocalScratchEnvironment({
        ...getValidQaEnv(),
        DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/uniwave_qa_isolated",
      }),
    ).toThrow(/Port '5432' is not QA port 54329/i);

    // Cloud database domain pattern
    expect(() =>
      assertSafeLocalScratchEnvironment({
        ...getValidQaEnv(),
        DATABASE_URL: "postgresql://user:pass@ep-cool-neon.tech:54329/uniwave_qa_isolated",
      }),
    ).toThrow(/rejected non-isolated DATABASE_URL/i);

    // Non-loopback Auth URL
    expect(() =>
      assertSafeLocalScratchEnvironment({
        ...getValidQaEnv(),
        AUTH_URL: "https://auth.company.com",
      }),
    ).toThrow(/rejected non-loopback AUTH_URL/i);
  });

  // STG-05: Scratch-root containment
  it("STG-05: rejects scratch roots residing within repository or postgres data directories", () => {
    // Relative path
    expect(() => assertSafeScratchRoot("./relative/path")).toThrow(/must be an absolute path/i);

    // Inside repository cwd
    const insideRepo = path.join(process.cwd(), "scratch-inside-repo");
    expect(() => assertSafeScratchRoot(insideRepo)).toThrow(/must reside strictly outside/i);

    // Inside postgres data directory pattern
    const fakePgData = path.join(os.tmpdir(), "uniwave_qa_isolated_data");
    expect(() => assertSafeScratchRoot(fakePgData)).toThrow(
      /must not point into a PostgreSQL database data directory/i,
    );
  });

  // STG-06: Traversal and invalid key rejection
  it("STG-06: rejects invalid and traversal artifact storage keys", () => {
    const invalidKeys = [
      "",
      "   ",
      "../parent.pdf",
      "folder/../../escape.pdf",
      "/leading/slash.pdf",
      "trailing/slash/",
      "double//slash.pdf",
      "back\\slash.pdf",
      "null\0byte.pdf",
      "colon:in:key.pdf",
      "wildcard*.pdf",
      "a".repeat(1025),
    ];

    for (const key of invalidKeys) {
      expect(() => assertSafeLogicalKey(key, "write")).toThrow(ArtifactStorageError);
      expect(() => assertSafeLogicalKey(key, "read")).toThrow(ArtifactStorageError);
    }

    // Valid keys must pass
    const validKeys = [
      "shipping-note-exports/exp-123/artifact.pdf",
      "shipping-notes/note-456/documents/doc-789.xlsx",
      "simple-key.bin",
      "sub_dir-1/sub.dir-2/file_01.dat",
    ];

    for (const key of validKeys) {
      expect(() => assertSafeLogicalKey(key, "write")).not.toThrow();
      expect(() => assertSafeLogicalKey(key, "read")).not.toThrow();
    }
  });

  // STG-07: Symlink/reparse-point scratch root rejection
  it("STG-07: rejects symlinks, junctions, non-existent paths, or regular files as scratch root", () => {
    // Non-existent path
    const nonExistent = path.join(scratchDir, "non_existent_folder");
    expect(() => assertSafeScratchRoot(nonExistent)).toThrow(/does not exist/i);

    // Regular file instead of directory
    const filePath = path.join(scratchDir, "file.txt");
    fs.writeFileSync(filePath, "test", "utf-8");
    expect(() => assertSafeScratchRoot(filePath)).toThrow(/must be a physical directory/i);

    // Directory symlink / junction
    const targetDir = path.join(scratchDir, "target_real_dir");
    fs.mkdirSync(targetDir);
    const junctionPath = path.join(scratchDir, "junction_link");

    try {
      fs.symlinkSync(targetDir, junctionPath, "junction");
      expect(() => assertSafeScratchRoot(junctionPath)).toThrow(
        /must be a physical directory and not a link or junction/i,
      );
    } catch {
      // If OS environment does not permit symlink/junction creation, verify mock
      const statMock = vi.spyOn(fs, "lstatSync").mockReturnValueOnce({
        isDirectory: () => true,
        isSymbolicLink: () => true,
      } as unknown as fs.Stats);
      expect(() => assertSafeScratchRoot(targetDir)).toThrow(/not a link or junction/i);
      statMock.mockRestore();
    }
  });

  // STG-08: Put/get/checksum round-trip success
  it("STG-08: performs atomic put, envelope generation, and get round-trip with checksum verification", async () => {
    const storage = new LocalFsArtifactStorage(scratchDir);
    const body = Buffer.from("Uniwave Freight Document Content 2026-11-01", "utf-8");
    const checksumSha256 = calculateArtifactSha256(body);
    const key = "shipping-note-exports/exp-101/artifact.pdf";

    const stored = await storage.put({
      key,
      body,
      mimeType: "application/pdf",
      checksumSha256,
      exportId: "exp-101",
    });

    expect(stored.key).toBe(key);
    expect(stored.sizeBytes).toBe(body.byteLength);
    expect(stored.mimeType).toBe("application/pdf");

    // Verify physical file exists and is named <sha256(key)>.blob
    const expectedFileName = getStorageFileName(key);
    const physicalPath = path.join(scratchDir, expectedFileName);
    expect(fs.existsSync(physicalPath)).toBe(true);

    // Read back through storage
    const retrieved = await storage.get(key);
    expect(retrieved.equals(body)).toBe(true);

    // Verify envelope contents directly
    const rawBytes = fs.readFileSync(physicalPath);
    const { header, body: parsedBody } = parseEnvelope(rawBytes);
    expect(header.version).toBe(1);
    expect(header.key).toBe(key);
    expect(header.sizeBytes).toBe(body.byteLength);
    expect(header.mimeType).toBe("application/pdf");
    expect(header.checksumSha256).toBe(checksumSha256);
    expect(header.exportId).toBe("exp-101");
    expect(parsedBody.equals(body)).toBe(true);
  });

  // STG-09: Duplicate key, identical content (idempotent)
  it("STG-09: handles identical duplicate writes idempotently without corrupting data", async () => {
    const storage = new LocalFsArtifactStorage(scratchDir);
    const body = Buffer.from("Idempotent Test Content", "utf-8");
    const checksumSha256 = calculateArtifactSha256(body);
    const key = "shipping-note-exports/exp-102/artifact.pdf";

    const first = await storage.put({
      key,
      body,
      mimeType: "application/pdf",
      checksumSha256,
    });

    const second = await storage.put({
      key,
      body,
      mimeType: "application/pdf",
      checksumSha256,
    });

    expect(second).toEqual(first);

    const retrieved = await storage.get(key);
    expect(retrieved.equals(body)).toBe(true);
  });

  // STG-10: Duplicate key, different content (no overwrite)
  it("STG-10: throws error and preserves original object when attempting to overwrite with different content", async () => {
    const storage = new LocalFsArtifactStorage(scratchDir);
    const originalBody = Buffer.from("Original Confidential Report", "utf-8");
    const originalChecksum = calculateArtifactSha256(originalBody);
    const key = "shipping-note-exports/exp-103/artifact.pdf";

    await storage.put({
      key,
      body: originalBody,
      mimeType: "application/pdf",
      checksumSha256: originalChecksum,
    });

    const conflictingBody = Buffer.from("Conflicting Overwrite Attempt", "utf-8");
    const conflictingChecksum = calculateArtifactSha256(conflictingBody);

    await expect(
      storage.put({
        key,
        body: conflictingBody,
        mimeType: "application/pdf",
        checksumSha256: conflictingChecksum,
      }),
    ).rejects.toThrow(ArtifactStorageError);

    await expect(
      storage.put({
        key,
        body: conflictingBody,
        mimeType: "application/pdf",
        checksumSha256: conflictingChecksum,
      }),
    ).rejects.toMatchObject({
      code: ARTIFACT_STORAGE_ERROR_CODES.WRITE_FAILED,
      message: expect.stringMatching(/already exists with different content/i),
    });

    // Verify original object was NOT modified or corrupted
    const preserved = await storage.get(key);
    expect(preserved.equals(originalBody)).toBe(true);
  });

  // STG-11: Concurrent same-key writers
  it("STG-11: safely handles concurrent writers for the same key", async () => {
    const storage = new LocalFsArtifactStorage(scratchDir);
    const body = Buffer.from("Concurrent Content Payload", "utf-8");
    const checksumSha256 = calculateArtifactSha256(body);
    const key = "shipping-note-exports/exp-104/artifact.pdf";

    const promises = Array.from({ length: 8 }).map(() =>
      storage.put({
        key,
        body,
        mimeType: "application/pdf",
        checksumSha256,
      }),
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(8);
    for (const res of results) {
      expect(res.key).toBe(key);
      expect(res.sizeBytes).toBe(body.byteLength);
    }

    const retrieved = await storage.get(key);
    expect(retrieved.equals(body)).toBe(true);

    // Verify no temporary files were leaked
    const files = fs.readdirSync(scratchDir);
    const tempFiles = files.filter((f) => f.startsWith(".tmp-"));
    expect(tempFiles).toHaveLength(0);
  });

  // STG-12: Failure after temporary write (rollback unlinks temp)
  it("STG-12: ensures temporary files are removed when write fails", async () => {
    const storage = new LocalFsArtifactStorage(scratchDir);
    const body = Buffer.from("Temp File Failure Test", "utf-8");
    const key = "shipping-note-exports/exp-105/artifact.pdf";

    // Spy on link to simulate an error before publication
    const linkSpy = vi.spyOn(fs.promises, "link").mockRejectedValueOnce(new Error("Disk IO Error"));

    await expect(
      storage.put({
        key,
        body,
        mimeType: "application/pdf",
        checksumSha256: calculateArtifactSha256(body),
      }),
    ).rejects.toThrow(/Disk IO Error/);

    linkSpy.mockRestore();

    // Verify all temporary files are unlinked
    const files = fs.readdirSync(scratchDir);
    const tempFiles = files.filter((f) => f.startsWith(".tmp-"));
    expect(tempFiles).toHaveLength(0);
  });

  // STG-13: Failure during publication
  it("STG-13: cleans up temporary file and leaves target untouched when publication conflicts", async () => {
    const storage = new LocalFsArtifactStorage(scratchDir);
    const existingBody = Buffer.from("Initial Stored Body", "utf-8");
    const key = "shipping-note-exports/exp-106/artifact.pdf";

    await storage.put({
      key,
      body: existingBody,
      mimeType: "application/pdf",
      checksumSha256: calculateArtifactSha256(existingBody),
    });

    const diffBody = Buffer.from("Different Attempt", "utf-8");

    await expect(
      storage.put({
        key,
        body: diffBody,
        mimeType: "application/pdf",
        checksumSha256: calculateArtifactSha256(diffBody),
      }),
    ).rejects.toThrow(/already exists with different content/);

    const files = fs.readdirSync(scratchDir);
    expect(files.filter((f) => f.startsWith(".tmp-"))).toHaveLength(0);
    expect(await storage.get(key)).toEqual(existingBody);
  });

  // STG-14: Existing valid object survives a failed replacement attempt
  it("STG-14: ensures an existing valid object remains completely intact after failed replacement", async () => {
    const storage = new LocalFsArtifactStorage(scratchDir);
    const originalBody = Buffer.from("Golden Master Document", "utf-8");
    const key = "shipping-note-exports/exp-107/artifact.pdf";

    await storage.put({
      key,
      body: originalBody,
      mimeType: "application/pdf",
      checksumSha256: calculateArtifactSha256(originalBody),
    });

    // Multiple failing attempts
    for (let i = 0; i < 3; i++) {
      const corruptBody = Buffer.from(`Bad Replacement ${i}`, "utf-8");
      await expect(
        storage.put({
          key,
          body: corruptBody,
          mimeType: "application/pdf",
          checksumSha256: calculateArtifactSha256(corruptBody),
        }),
      ).rejects.toThrow();
    }

    // Must still read the exact original body
    expect(await storage.get(key)).toEqual(originalBody);
  });

  // STG-15: Corrupted artifact read rejection
  it("STG-15: rejects reads of corrupted, truncated, or tampered envelope files", async () => {
    const storage = new LocalFsArtifactStorage(scratchDir);
    const body = Buffer.from("Valid Initial Body", "utf-8");
    const key = "shipping-note-exports/exp-108/artifact.pdf";

    await storage.put({
      key,
      body,
      mimeType: "application/pdf",
      checksumSha256: calculateArtifactSha256(body),
    });

    const physicalPath = path.join(scratchDir, getStorageFileName(key));
    const validEnvelope = fs.readFileSync(physicalPath);

    // 1. Truncated file (< 14 bytes)
    fs.writeFileSync(physicalPath, validEnvelope.subarray(0, 8));
    await expect(storage.get(key)).rejects.toMatchObject({
      code: ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
      message: expect.stringMatching(/truncated or corrupted/i),
    });

    // 2. Corrupt magic header
    const badMagic = Buffer.from(validEnvelope);
    badMagic.write("CORRUPT_MAGIC", 0);
    fs.writeFileSync(physicalPath, badMagic);
    await expect(storage.get(key)).rejects.toMatchObject({
      code: ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
      message: expect.stringMatching(/magic header mismatch/i),
    });

    // 3. Corrupt header JSON
    const headerLen = validEnvelope.readUInt32BE(10);
    const badJson = Buffer.from(validEnvelope);
    badJson.fill(0x78, 14, 14 + headerLen); // overwrite header JSON with 'xxxx...'
    fs.writeFileSync(physicalPath, badJson);
    await expect(storage.get(key)).rejects.toMatchObject({
      code: ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
      message: expect.stringMatching(/header JSON is invalid/i),
    });

    // 4. Tampered body (checksum mismatch)
    const tamperedBody = Buffer.from(validEnvelope);
    tamperedBody[tamperedBody.length - 1] ^= 0xff; // flip last byte
    fs.writeFileSync(physicalPath, tamperedBody);
    await expect(storage.get(key)).rejects.toMatchObject({
      code: ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
      message: expect.stringMatching(/checksum mismatch/i),
    });
  });

  // STG-16: Exact-key deletion
  it("STG-16: performs exact-key deletion idempotently without touching other files", async () => {
    const storage = new LocalFsArtifactStorage(scratchDir);
    const bodyA = Buffer.from("File A Content", "utf-8");
    const bodyB = Buffer.from("File B Content", "utf-8");
    const keyA = "shipping-note-exports/exp-109A/artifact.pdf";
    const keyB = "shipping-note-exports/exp-109B/artifact.pdf";

    await storage.put({
      key: keyA,
      body: bodyA,
      mimeType: "application/pdf",
      checksumSha256: calculateArtifactSha256(bodyA),
    });

    await storage.put({
      key: keyB,
      body: bodyB,
      mimeType: "application/pdf",
      checksumSha256: calculateArtifactSha256(bodyB),
    });

    // Delete keyA
    await storage.delete(keyA);

    // keyA is gone
    await expect(storage.get(keyA)).rejects.toMatchObject({
      code: ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
      message: expect.stringMatching(/not found/i),
    });

    // keyB is still intact
    expect(await storage.get(keyB)).toEqual(bodyB);

    // Delete keyA again (idempotent, must not throw)
    await expect(storage.delete(keyA)).resolves.toBeUndefined();
  });

  // STG-17: Document availability with local QA provider
  it("STG-17: reports document availability as true and preferredProvider as r2 in QA environment", () => {
    const qaEnv = getValidQaEnv();
    const originalEnv = { ...process.env };

    try {
      Object.assign(process.env, qaEnv);
      // Ensure R2 credentials are unset
      delete process.env.ARTIFACT_R2_ACCOUNT_ID;
      delete process.env.ARTIFACT_R2_ACCESS_KEY_ID;
      delete process.env.ARTIFACT_R2_SECRET_ACCESS_KEY;
      delete process.env.ARTIFACT_R2_BUCKET_NAME;

      const availability = getStorageAvailability();
      expect(availability.available).toBe(true);
      expect(availability.preferredProvider).toBe("r2");
      expect(availability.r2Configured).toBe(false);
    } finally {
      process.env = originalEnv;
    }
  });

  // STG-18: Document availability with production/default R2
  it("STG-18: reports document availability based on R2 when provider is unset", () => {
    const originalEnv = { ...process.env };

    try {
      delete process.env.ARTIFACT_STORAGE_PROVIDER;
      delete process.env.UNIWAVE_ALLOW_LOCAL_QA_STORAGE;
      delete process.env.ARTIFACT_LOCAL_SCRATCH_ROOT;

      // When R2 is configured
      process.env.ARTIFACT_R2_ACCOUNT_ID = "acc1";
      process.env.ARTIFACT_R2_ACCESS_KEY_ID = "key1";
      process.env.ARTIFACT_R2_SECRET_ACCESS_KEY = "sec1";
      process.env.ARTIFACT_R2_BUCKET_NAME = "buc1";

      const r2Available = getStorageAvailability();
      expect(r2Available.available).toBe(true);
      expect(r2Available.preferredProvider).toBe("r2");
      expect(r2Available.r2Configured).toBe(true);

      // When R2 is NOT configured
      delete process.env.ARTIFACT_R2_ACCOUNT_ID;
      const unconfigured = getStorageAvailability();
      expect(unconfigured.available).toBe(false);
      expect(unconfigured.preferredProvider).toBe(null);
      expect(unconfigured.r2Configured).toBe(false);
    } finally {
      process.env = originalEnv;
    }
  });

  // STG-19: Server-side zero egress
  it("STG-19: confirms zero outbound network calls are made during storage operations", async () => {
    let networkCallCount = 0;

    const httpSpy = vi.spyOn(http, "request").mockImplementation(() => {
      networkCallCount++;
      throw new Error("Outbound HTTP blocked in zero-egress test");
    });
    const httpsSpy = vi.spyOn(https, "request").mockImplementation(() => {
      networkCallCount++;
      throw new Error("Outbound HTTPS blocked in zero-egress test");
    });
    const netSpy = vi.spyOn(net, "connect").mockImplementation(() => {
      networkCallCount++;
      throw new Error("Outbound TCP blocked in zero-egress test");
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      networkCallCount++;
      throw new Error("Outbound fetch blocked in zero-egress test");
    });

    try {
      const storage = new LocalFsArtifactStorage(scratchDir);
      const body = Buffer.from("Zero Egress Test Data", "utf-8");
      const key = "shipping-note-exports/exp-110/artifact.pdf";

      await storage.put({
        key,
        body,
        mimeType: "application/pdf",
        checksumSha256: calculateArtifactSha256(body),
      });

      const retrieved = await storage.get(key);
      expect(retrieved.equals(body)).toBe(true);

      await storage.delete(key);

      expect(networkCallCount).toBe(0);
    } finally {
      httpSpy.mockRestore();
      httpsSpy.mockRestore();
      netSpy.mockRestore();
      fetchSpy.mockRestore();
    }
  });

  // STG-20: Provider semantics and error contract compatibility
  it("STG-20: satisfies the ArtifactStorage interface contract and error taxonomy", async () => {
    const storage = new LocalFsArtifactStorage(scratchDir);

    // Reading non-existent object throws READ_FAILED
    await expect(storage.get("shipping-note-exports/exp-missing/artifact.pdf")).rejects.toMatchObject({
      name: "ArtifactStorageError",
      code: ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
    });

    // EXPECTED_QA_POSTGRESQL_SYSTEM_IDENTIFIER constant check
    expect(EXPECTED_QA_POSTGRESQL_SYSTEM_IDENTIFIER).toBe("7701384516187065248");
  });
});
