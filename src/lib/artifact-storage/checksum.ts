import { createHash } from "node:crypto";

import {
  ARTIFACT_STORAGE_ERROR_CODES,
  ArtifactStorageError,
} from "./errors";

export function calculateArtifactSha256(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

export function assertArtifactChecksum(input: {
  bytes: Buffer | Uint8Array;
  expectedSha256: string;
}): void {
  const actualSha256 = calculateArtifactSha256(input.bytes);

  if (actualSha256 !== input.expectedSha256) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.CHECKSUM_MISMATCH,
      "Stored artifact checksum does not match export metadata.",
    );
  }
}
