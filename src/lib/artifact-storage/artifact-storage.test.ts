import { Readable } from "node:stream";

import type { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { calculateArtifactSha256 } from "./checksum";
import {
  ARTIFACT_STORAGE_ERROR_CODES,
  ArtifactStorageError,
} from "./errors";
import { FakeArtifactStorage } from "./fake";
import {
  buildArtifactStorageKey,
  getArtifactFileExtension,
} from "./keys";
import {
  R2ArtifactStorage,
  buildR2Endpoint,
  readR2ArtifactStorageConfig,
  sdkBodyToBuffer,
} from "./r2";
import { getVerifiedArtifactBytes } from "./verified";

const r2Config = {
  accountId: "account123",
  accessKeyId: "access-key",
  secretAccessKey: "secret-key",
  bucketName: "uniwave-artifacts",
};

describe("artifact storage keys", () => {
  it("derives deterministic object keys from export identity and type", () => {
    expect(getArtifactFileExtension("excel")).toBe("xlsx");
    expect(getArtifactFileExtension("pdf")).toBe("pdf");
    expect(buildArtifactStorageKey({
      exportId: "export-123",
      exportType: "excel",
    })).toBe("shipping-note-exports/export-123/artifact.xlsx");
    expect(buildArtifactStorageKey({
      exportId: "export-123",
      exportType: "pdf",
    })).toBe("shipping-note-exports/export-123/artifact.pdf");
  });

  it("rejects export IDs that cannot safely form object keys", () => {
    expect(() => buildArtifactStorageKey({
      exportId: "../unsafe",
      exportType: "pdf",
    })).toThrow(/storage key/);
  });
});

describe("fake artifact storage and checksum verification", () => {
  it("stores and reads exact bytes through the fake provider", async () => {
    const storage = new FakeArtifactStorage();
    const body = Buffer.from([0, 1, 2, 3, 255]);
    const checksumSha256 = calculateArtifactSha256(body);

    await storage.put({
      key: "shipping-note-exports/export-1/artifact.pdf",
      body,
      mimeType: "application/pdf",
      checksumSha256,
      exportId: "export-1",
    });

    const readBody = await storage.get("shipping-note-exports/export-1/artifact.pdf");
    expect(readBody.equals(body)).toBe(true);
    expect(readBody).not.toBe(body);
  });

  it("returns verified artifact bytes when checksum matches", async () => {
    const storage = new FakeArtifactStorage();
    const body = Buffer.from("stored artifact");
    const checksum = calculateArtifactSha256(body);
    const artifactStorageKey = "shipping-note-exports/export-2/artifact.xlsx";

    await storage.put({
      key: artifactStorageKey,
      body,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      checksumSha256: checksum,
      exportId: "export-2",
    });

    await expect(getVerifiedArtifactBytes({
      artifactStorageKey,
      checksum,
    }, storage)).resolves.toEqual(body);
  });

  it("rejects checksum mismatches", async () => {
    const storage = new FakeArtifactStorage();
    const artifactStorageKey = "shipping-note-exports/export-3/artifact.pdf";

    await storage.put({
      key: artifactStorageKey,
      body: Buffer.from("stored artifact"),
      mimeType: "application/pdf",
      checksumSha256: "unused",
      exportId: "export-3",
    });

    await expect(getVerifiedArtifactBytes({
      artifactStorageKey,
      checksum: calculateArtifactSha256(Buffer.from("different artifact")),
    }, storage)).rejects.toMatchObject({
      code: ARTIFACT_STORAGE_ERROR_CODES.CHECKSUM_MISMATCH,
    });
  });

  it("rejects missing objects and historical metadata-only exports", async () => {
    const storage = new FakeArtifactStorage();

    await expect(storage.get("missing")).rejects.toMatchObject({
      code: ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
    });
    await expect(getVerifiedArtifactBytes({
      artifactStorageKey: null,
      checksum: "ABC",
    }, storage)).rejects.toMatchObject({
      code: ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
    });
  });
});

describe("R2 artifact storage adapter", () => {
  it("builds the Cloudflare R2 endpoint from account ID", () => {
    expect(buildR2Endpoint("abc123")).toBe(
      "https://abc123.r2.cloudflarestorage.com",
    );
  });

  it("validates required R2 configuration when storage is invoked", () => {
    expect(() => readR2ArtifactStorageConfig({})).toThrow(ArtifactStorageError);
    expect(() => readR2ArtifactStorageConfig({})).toThrow(
      /not configured/i,
    );

    expect(readR2ArtifactStorageConfig({
      ARTIFACT_R2_ACCOUNT_ID: "account123",
      ARTIFACT_R2_ACCESS_KEY_ID: "access-key",
      ARTIFACT_R2_SECRET_ACCESS_KEY: "secret-key",
      ARTIFACT_R2_BUCKET_NAME: "bucket",
    })).toStrictEqual({
      accountId: "account123",
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
      bucketName: "bucket",
    });
  });

  it("maps put requests to a private S3 PutObject operation", async () => {
    const sentCommands: Array<{ input?: Record<string, unknown> }> = [];
    const client = {
      async send(command: PutObjectCommand | GetObjectCommand) {
        sentCommands.push(command as unknown as { input?: Record<string, unknown> });
        return {};
      },
    };
    const storage = new R2ArtifactStorage(r2Config, client);
    const body = Buffer.from("pdf bytes");

    await storage.put({
      key: "shipping-note-exports/export-4/artifact.pdf",
      body,
      mimeType: "application/pdf",
      checksumSha256: "ABC123",
      exportId: "export-4",
    });

    expect(sentCommands[0]?.input).toMatchObject({
      Bucket: "uniwave-artifacts",
      Key: "shipping-note-exports/export-4/artifact.pdf",
      Body: body,
      ContentType: "application/pdf",
      Metadata: {
        "uniwave-export-id": "export-4",
        sha256: "ABC123",
      },
    });
  });

  it("converts SDK response bodies to Buffer", async () => {
    await expect(sdkBodyToBuffer(Buffer.from("a"))).resolves.toEqual(
      Buffer.from("a"),
    );
    await expect(sdkBodyToBuffer({
      async transformToByteArray() {
        return new Uint8Array([98]);
      },
    })).resolves.toEqual(Buffer.from("b"));
    await expect(sdkBodyToBuffer(Readable.from([Buffer.from("c")]))).resolves.toEqual(
      Buffer.from("c"),
    );
  });
});
