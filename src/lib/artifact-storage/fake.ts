import {
  ARTIFACT_STORAGE_ERROR_CODES,
  ArtifactStorageError,
} from "./errors";
import type {
  ArtifactStorage,
  ArtifactStoragePutInput,
  StoredArtifact,
} from "./types";

type FakeArtifactObject = {
  body: Buffer;
  mimeType: string;
  checksumSha256: string;
  exportId: string;
};

export class FakeArtifactStorage implements ArtifactStorage {
  private readonly objects = new Map<string, FakeArtifactObject>();
  private putError: ArtifactStorageError | null = null;
  private deleteError: ArtifactStorageError | null = null;
  readonly deletedKeys: string[] = [];

  failNextPut(error = new ArtifactStorageError(
    ARTIFACT_STORAGE_ERROR_CODES.WRITE_FAILED,
    "Fake artifact storage write failed.",
  )): void {
    this.putError = error;
  }

  failNextDelete(error = new ArtifactStorageError(
    ARTIFACT_STORAGE_ERROR_CODES.WRITE_FAILED,
    "Fake artifact storage delete failed.",
  )): void {
    this.deleteError = error;
  }

  async put(input: ArtifactStoragePutInput): Promise<StoredArtifact> {
    if (this.putError) {
      const error = this.putError;
      this.putError = null;
      throw error;
    }

    this.objects.set(input.key, {
      body: Buffer.from(input.body),
      mimeType: input.mimeType,
      checksumSha256: input.checksumSha256,
      exportId: input.exportId,
    });

    return {
      key: input.key,
      sizeBytes: input.body.byteLength,
      mimeType: input.mimeType,
    };
  }

  async get(key: string): Promise<Buffer> {
    const object = this.objects.get(key);

    if (!object) {
      throw new ArtifactStorageError(
        ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
        "Artifact object was not found.",
      );
    }

    return Buffer.from(object.body);
  }

  async delete(key: string): Promise<void> {
    if (this.deleteError) {
      const error = this.deleteError;
      this.deleteError = null;
      throw error;
    }

    this.deletedKeys.push(key);
    this.objects.delete(key);
  }

  getObjectForTest(key: string): FakeArtifactObject | null {
    const object = this.objects.get(key);
    return object
      ? {
          ...object,
          body: Buffer.from(object.body),
        }
      : null;
  }
}
