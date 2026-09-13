import "server-only";

import { getArtifactStorage } from "@/lib/artifact-storage";
import type { ArtifactStorage } from "@/lib/artifact-storage/types";

export type ExactArtifactCleanupResult = {
  attemptedKeyCount: number;
  failedKeyCount: number;
};

/**
 * Removes only explicit keys collected from persisted metadata. It deliberately
 * has no prefix or bucket operation, so a caller can never broaden cleanup
 * based on browser input.
 */
export async function deleteExactArtifactKeys(
  keys: readonly string[],
  storage: ArtifactStorage = getArtifactStorage(),
): Promise<ExactArtifactCleanupResult> {
  const exactKeys = [...new Set(keys)];

  if (exactKeys.length === 0) {
    return { attemptedKeyCount: 0, failedKeyCount: 0 };
  }

  if (!storage.delete) {
    return {
      attemptedKeyCount: exactKeys.length,
      failedKeyCount: exactKeys.length,
    };
  }

  let failedKeyCount = 0;

  for (const key of exactKeys) {
    try {
      await storage.delete(key);
    } catch {
      // Continue exact-key cleanup and deliberately do not expose provider errors.
      failedKeyCount += 1;
    }
  }

  return { attemptedKeyCount: exactKeys.length, failedKeyCount };
}
