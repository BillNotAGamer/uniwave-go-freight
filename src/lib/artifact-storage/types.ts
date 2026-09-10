export type ArtifactStoragePutInput = {
  key: string;
  body: Buffer;
  mimeType: string;
  checksumSha256: string;
  exportId: string;
};

export type StoredArtifact = {
  key: string;
  sizeBytes: number;
  mimeType: string;
};

export interface ArtifactStorage {
  put(input: ArtifactStoragePutInput): Promise<StoredArtifact>;
  get(key: string): Promise<Buffer>;
  delete?(key: string): Promise<void>;
}
