import "server-only";

import { assertArtifactChecksum } from "@/lib/artifact-storage/checksum";
import {
  buildArtifactStorageKey,
  type ArtifactExportType,
} from "@/lib/artifact-storage/keys";
import {
  getArtifactStorage,
  type ArtifactStorage,
} from "@/lib/artifact-storage";

export type PersistGeneratedExportArtifactInput = {
  exportId: string;
  exportType: ArtifactExportType;
  bytes: Buffer | Uint8Array | ArrayBuffer;
  mimeType: string;
  checksumSha256: string;
  storage?: ArtifactStorage;
};

export type PersistedExportArtifactMetadata = {
  artifactStorageKey: string;
  artifactSizeBytes: number;
  artifactMimeType: string;
};

function toArtifactBuffer(bytes: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(bytes)) {
    return Buffer.from(bytes);
  }

  if (bytes instanceof ArrayBuffer) {
    return Buffer.from(bytes);
  }

  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export async function persistGeneratedExportArtifact(
  input: PersistGeneratedExportArtifactInput,
): Promise<PersistedExportArtifactMetadata> {
  const body = toArtifactBuffer(input.bytes);
  assertArtifactChecksum({
    bytes: body,
    expectedSha256: input.checksumSha256,
  });

  const key = buildArtifactStorageKey({
    exportId: input.exportId,
    exportType: input.exportType,
  });
  const storage = input.storage ?? getArtifactStorage();
  const stored = await storage.put({
    key,
    body,
    mimeType: input.mimeType,
    checksumSha256: input.checksumSha256,
    exportId: input.exportId,
  });

  return {
    artifactStorageKey: stored.key,
    artifactSizeBytes: stored.sizeBytes,
    artifactMimeType: stored.mimeType,
  };
}
