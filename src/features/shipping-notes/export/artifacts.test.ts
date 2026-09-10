import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { calculateArtifactSha256 } from "@/lib/artifact-storage/checksum";
import {
  ARTIFACT_STORAGE_ERROR_CODES,
} from "@/lib/artifact-storage/errors";
import { FakeArtifactStorage } from "@/lib/artifact-storage/fake";

import { persistGeneratedExportArtifact } from "./artifacts";

describe("generated export artifact persistence", () => {
  it("persists exact bytes under the deterministic export key", async () => {
    const storage = new FakeArtifactStorage();
    const bytes = Buffer.from("xlsx bytes");
    const checksumSha256 = calculateArtifactSha256(bytes);

    const stored = await persistGeneratedExportArtifact({
      exportId: "export-5",
      exportType: "excel",
      bytes,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      checksumSha256,
      storage,
    });

    expect(stored).toStrictEqual({
      artifactStorageKey: "shipping-note-exports/export-5/artifact.xlsx",
      artifactSizeBytes: bytes.byteLength,
      artifactMimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(storage.getObjectForTest(stored.artifactStorageKey)?.body.equals(bytes)).toBe(
      true,
    );
  });

  it("rejects storing bytes when the provided checksum does not match", async () => {
    const storage = new FakeArtifactStorage();

    await expect(persistGeneratedExportArtifact({
      exportId: "export-6",
      exportType: "pdf",
      bytes: Buffer.from("pdf bytes"),
      mimeType: "application/pdf",
      checksumSha256: calculateArtifactSha256(Buffer.from("different bytes")),
      storage,
    })).rejects.toMatchObject({
      code: ARTIFACT_STORAGE_ERROR_CODES.CHECKSUM_MISMATCH,
    });

    expect(storage.getObjectForTest("shipping-note-exports/export-6/artifact.pdf")).toBeNull();
  });

  it("propagates sanitized storage write failures", async () => {
    const storage = new FakeArtifactStorage();
    const bytes = Buffer.from("pdf bytes");
    storage.failNextPut();

    await expect(persistGeneratedExportArtifact({
      exportId: "export-7",
      exportType: "pdf",
      bytes,
      mimeType: "application/pdf",
      checksumSha256: calculateArtifactSha256(bytes),
      storage,
    })).rejects.toMatchObject({
      code: ARTIFACT_STORAGE_ERROR_CODES.WRITE_FAILED,
    });
  });
});
