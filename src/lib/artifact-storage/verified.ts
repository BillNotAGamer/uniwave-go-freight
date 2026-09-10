import "server-only";

import { assertArtifactChecksum } from "./checksum";
import {
  ARTIFACT_STORAGE_ERROR_CODES,
  ArtifactStorageError,
} from "./errors";
import { getArtifactStorage } from "./index";
import type { ArtifactStorage } from "./types";

export type DurableArtifactMetadata = {
  artifactStorageKey: string | null;
  checksum: string | null;
};

export async function getVerifiedArtifactBytes(
  exportRecord: DurableArtifactMetadata,
  storage: ArtifactStorage = getArtifactStorage(),
): Promise<Buffer> {
  if (!exportRecord.artifactStorageKey || !exportRecord.checksum) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
      "Export artifact is not available in durable storage.",
    );
  }

  const bytes = await storage.get(exportRecord.artifactStorageKey);
  assertArtifactChecksum({
    bytes,
    expectedSha256: exportRecord.checksum,
  });

  return bytes;
}
