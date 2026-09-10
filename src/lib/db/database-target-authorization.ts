export const DATABASE_TARGET_AUTHORIZATION_ERROR_CODES = [
  "INTEGRATION_DB_NOT_AUTHORIZED",
  "INTEGRATION_DB_PRODUCTION_ENV_FORBIDDEN",
  "INTEGRATION_DB_EXPECTED_HOST_REQUIRED",
  "INTEGRATION_DB_EXPECTED_NAME_REQUIRED",
  "INTEGRATION_DB_URL_INVALID",
  "INTEGRATION_DB_PROTOCOL_INVALID",
  "INTEGRATION_DB_HOST_MISMATCH",
  "INTEGRATION_DB_NAME_MISMATCH",
] as const;

export type DatabaseTargetAuthorizationErrorCode =
  (typeof DATABASE_TARGET_AUTHORIZATION_ERROR_CODES)[number];

export type AuthorizedDatabaseTarget = {
  hostname: string;
  databaseName: string;
  port: string;
};

export type DatabaseTargetAuthorizationInput = {
  operation: string;
  databaseUrl: string | undefined;
  authorization: string | undefined;
  productionAuthorization?: string | undefined;
  expectedHost: string | undefined;
  expectedDatabase: string | undefined;
  nodeEnv: string | undefined;
  forbidProductionNodeEnv: boolean;
};

export class DatabaseTargetAuthorizationError extends Error {
  readonly code: DatabaseTargetAuthorizationErrorCode;

  constructor(code: DatabaseTargetAuthorizationErrorCode, message: string) {
    super(message);
    this.name = "DatabaseTargetAuthorizationError";
    this.code = code;
  }
}

function normalizeExpectedHost(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeExpectedDatabase(value: string | undefined): string {
  return value?.trim() ?? "";
}

function parseTarget(databaseUrl: string | undefined): AuthorizedDatabaseTarget {
  if (!databaseUrl?.trim()) {
    throw new DatabaseTargetAuthorizationError(
      "INTEGRATION_DB_URL_INVALID",
      "Database target URL is required.",
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new DatabaseTargetAuthorizationError(
      "INTEGRATION_DB_URL_INVALID",
      "Database target URL is invalid.",
    );
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new DatabaseTargetAuthorizationError(
      "INTEGRATION_DB_PROTOCOL_INVALID",
      `Database target protocol ${parsed.protocol || "(empty)"} is not allowed.`,
    );
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

  if (!parsed.hostname || !databaseName) {
    throw new DatabaseTargetAuthorizationError(
      "INTEGRATION_DB_URL_INVALID",
      "Database target URL must include a hostname and database name.",
    );
  }

  return {
    hostname: parsed.hostname.toLowerCase(),
    databaseName,
    port: parsed.port,
  };
}

export function assertAuthorizedDatabaseTarget(
  input: DatabaseTargetAuthorizationInput,
): AuthorizedDatabaseTarget {
  if (
    input.forbidProductionNodeEnv &&
    input.nodeEnv === "production" &&
    input.productionAuthorization !== "true"
  ) {
    throw new DatabaseTargetAuthorizationError(
      "INTEGRATION_DB_PRODUCTION_ENV_FORBIDDEN",
      `${input.operation} requires explicit production database authorization when NODE_ENV is production.`,
    );
  }

  if (input.authorization !== "true") {
    throw new DatabaseTargetAuthorizationError(
      "INTEGRATION_DB_NOT_AUTHORIZED",
      `${input.operation} requires explicit database authorization.`,
    );
  }

  const expectedHost = normalizeExpectedHost(input.expectedHost);

  if (!expectedHost) {
    throw new DatabaseTargetAuthorizationError(
      "INTEGRATION_DB_EXPECTED_HOST_REQUIRED",
      `${input.operation} requires an exact expected database host.`,
    );
  }

  const expectedDatabase = normalizeExpectedDatabase(input.expectedDatabase);

  if (!expectedDatabase) {
    throw new DatabaseTargetAuthorizationError(
      "INTEGRATION_DB_EXPECTED_NAME_REQUIRED",
      `${input.operation} requires an exact expected database name.`,
    );
  }

  const target = parseTarget(input.databaseUrl);

  if (target.hostname !== expectedHost) {
    throw new DatabaseTargetAuthorizationError(
      "INTEGRATION_DB_HOST_MISMATCH",
      `${input.operation} target host ${target.hostname} does not match expected host ${expectedHost}.`,
    );
  }

  if (target.databaseName !== expectedDatabase) {
    throw new DatabaseTargetAuthorizationError(
      "INTEGRATION_DB_NAME_MISMATCH",
      `${input.operation} target database ${target.databaseName} does not match expected database ${expectedDatabase}.`,
    );
  }

  return target;
}
