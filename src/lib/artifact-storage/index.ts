import "server-only";

import { R2ArtifactStorage } from "./r2";
import type { ArtifactStorage } from "./types";

let defaultArtifactStorage: ArtifactStorage | null = null;

export function getArtifactStorage(): ArtifactStorage {
  defaultArtifactStorage ??= new R2ArtifactStorage();
  return defaultArtifactStorage;
}

export type {
  ArtifactStorage,
  ArtifactStoragePutInput,
  StoredArtifact,
} from "./types";
