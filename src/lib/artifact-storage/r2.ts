import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";

import {
  ARTIFACT_STORAGE_ERROR_CODES,
  ArtifactStorageError,
} from "./errors";
import type {
  ArtifactStorage,
  ArtifactStoragePutInput,
  StoredArtifact,
} from "./types";

export type R2ArtifactStorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

type R2Environment = Record<string, string | undefined>;

type S3ClientLike = {
  send(
    command: PutObjectCommand | GetObjectCommand | DeleteObjectCommand,
  ): Promise<unknown>;
};

function readRequiredEnv(
  env: R2Environment,
  key: keyof R2Environment,
): string {
  const value = env[key]?.trim();

  if (!value) {
    throw new ArtifactStorageError(
      ARTIFACT_STORAGE_ERROR_CODES.NOT_CONFIGURED,
      "Artifact storage is not configured.",
    );
  }

  return value;
}

export function isR2Configured(
  env: R2Environment = process.env,
): boolean {
  return Boolean(
    env.ARTIFACT_R2_ACCOUNT_ID?.trim() &&
    env.ARTIFACT_R2_ACCESS_KEY_ID?.trim() &&
    env.ARTIFACT_R2_SECRET_ACCESS_KEY?.trim() &&
    env.ARTIFACT_R2_BUCKET_NAME?.trim(),
  );
}

export function buildR2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function readR2ArtifactStorageConfig(
  env: R2Environment = process.env,
): R2ArtifactStorageConfig {
  return {
    accountId: readRequiredEnv(env, "ARTIFACT_R2_ACCOUNT_ID"),
    accessKeyId: readRequiredEnv(env, "ARTIFACT_R2_ACCESS_KEY_ID"),
    secretAccessKey: readRequiredEnv(env, "ARTIFACT_R2_SECRET_ACCESS_KEY"),
    bucketName: readRequiredEnv(env, "ARTIFACT_R2_BUCKET_NAME"),
  };
}

function createR2Client(config: R2ArtifactStorageConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: buildR2Endpoint(config.accountId),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function isTransformableBody(
  body: unknown,
): body is { transformToByteArray: () => Promise<Uint8Array> } {
  return (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof body.transformToByteArray === "function"
  );
}

function isAsyncIterableBody(
  body: unknown,
): body is AsyncIterable<Uint8Array> {
  return (
    typeof body === "object" &&
    body !== null &&
    Symbol.asyncIterator in body
  );
}

export async function sdkBodyToBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) {
    return Buffer.from(body);
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (isTransformableBody(body)) {
    return Buffer.from(await body.transformToByteArray());
  }

  if (isAsyncIterableBody(body)) {
    const chunks: Buffer[] = [];

    for await (const chunk of body) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  throw new ArtifactStorageError(
    ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
    "Artifact storage returned an unreadable object body.",
  );
}

export class R2ArtifactStorage implements ArtifactStorage {
  private readonly bucketName: string;
  private readonly client: S3ClientLike;

  constructor(
    config = readR2ArtifactStorageConfig(),
    client: S3ClientLike = createR2Client(config),
  ) {
    this.bucketName = config.bucketName;
    this.client = client;
  }

  async put(input: ArtifactStoragePutInput): Promise<StoredArtifact> {
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: input.key,
        Body: input.body,
        ContentType: input.mimeType,
        Metadata: {
          "uniwave-export-id": input.exportId,
          sha256: input.checksumSha256,
        },
      }));
    } catch (error) {
      if (error instanceof ArtifactStorageError) {
        throw error;
      }

      throw new ArtifactStorageError(
        ARTIFACT_STORAGE_ERROR_CODES.WRITE_FAILED,
        "Artifact storage write failed.",
      );
    }

    return {
      key: input.key,
      sizeBytes: input.body.byteLength,
      mimeType: input.mimeType,
    };
  }

  async get(key: string): Promise<Buffer> {
    try {
      const result = await this.client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })) as GetObjectCommandOutput;

      if (!result.Body) {
        throw new ArtifactStorageError(
          ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
          "Artifact storage object body was empty.",
        );
      }

      return sdkBodyToBuffer(result.Body);
    } catch (error) {
      if (error instanceof ArtifactStorageError) {
        throw error;
      }

      throw new ArtifactStorageError(
        ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
        "Artifact storage read failed.",
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }));
    } catch (error) {
      if (error instanceof ArtifactStorageError) {
        throw error;
      }

      throw new ArtifactStorageError(
        ARTIFACT_STORAGE_ERROR_CODES.WRITE_FAILED,
        "Artifact storage delete failed.",
      );
    }
  }
}
