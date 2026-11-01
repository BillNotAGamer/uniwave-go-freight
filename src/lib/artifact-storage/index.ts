import "server-only";

import {
  ARTIFACT_STORAGE_ERROR_CODES,
  ArtifactStorageError,
} from "./errors";
import {
  LocalFsArtifactStorage,
  assertSafeLocalScratchEnvironment,
  isSafeLocalScratchEnvironment,
} from "./local-scratch";
import {
  R2ArtifactStorage,
  isR2Configured,
  readR2ArtifactStorageConfig,
} from "./r2";
import type { ArtifactStorage } from "./types";

let defaultR2Storage: ArtifactStorage | null = null;

export function isArtifactStorageConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const provider = env.ARTIFACT_STORAGE_PROVIDER?.trim();

  if (provider === "local_qa_scratch") {
    return isSafeLocalScratchEnvironment(env);
  }

  if (!provider || provider === "r2") {
    return isR2Configured(env);
  }

  return false;
}

export function getArtifactStorage(
  env: Record<string, string | undefined> = process.env,
): ArtifactStorage {
  const provider = env.ARTIFACT_STORAGE_PROVIDER?.trim();

  if (provider === "local_qa_scratch") {
    assertSafeLocalScratchEnvironment(env);
    return new LocalFsArtifactStorage(env.ARTIFACT_LOCAL_SCRATCH_ROOT!.trim());
  }

  if (!provider || provider === "r2") {
    if (env === process.env) {
      defaultR2Storage ??= new R2ArtifactStorage();
      return defaultR2Storage;
    }
    return new R2ArtifactStorage(readR2ArtifactStorageConfig(env));
  }

  throw new ArtifactStorageError(
    ARTIFACT_STORAGE_ERROR_CODES.NOT_CONFIGURED,
    `Unsupported artifact storage provider: ${provider}`,
  );
}

export {
  LocalFsArtifactStorage,
  assertSafeLocalScratchEnvironment,
  isSafeLocalScratchEnvironment,
  EXPECTED_QA_POSTGRESQL_SYSTEM_IDENTIFIER,
} from "./local-scratch";

export type {
  ArtifactStorage,
  ArtifactStoragePutInput,
  StoredArtifact,
} from "./types";
