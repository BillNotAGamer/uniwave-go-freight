import { describe, expect, it } from "vitest";

import {
  assertAuthorizedDatabaseTarget,
  DatabaseTargetAuthorizationError,
  type DatabaseTargetAuthorizationInput,
} from "./database-target-authorization";

const validUrl =
  "postgresql://test-user:test-password@staging-db.example.invalid:5432/test_db?sslmode=require";

function validInput(
  overrides: Partial<DatabaseTargetAuthorizationInput> = {},
): DatabaseTargetAuthorizationInput {
  return {
    operation: "integration test database",
    databaseUrl: validUrl,
    authorization: "true",
    expectedHost: "staging-db.example.invalid",
    expectedDatabase: "test_db",
    nodeEnv: "test",
    forbidProductionNodeEnv: true,
    ...overrides,
  };
}

function expectDenied(
  overrides: Partial<DatabaseTargetAuthorizationInput>,
): DatabaseTargetAuthorizationError {
  try {
    assertAuthorizedDatabaseTarget(validInput(overrides));
  } catch (error) {
    expect(error).toBeInstanceOf(DatabaseTargetAuthorizationError);
    return error as DatabaseTargetAuthorizationError;
  }

  throw new Error("Expected database target authorization to be denied.");
}

describe("database target authorization", () => {
  it("denies missing authorization", () => {
    expect(expectDenied({ authorization: undefined }).code).toBe(
      "INTEGRATION_DB_NOT_AUTHORIZED",
    );
  });

  it("denies false authorization", () => {
    expect(expectDenied({ authorization: "false" }).code).toBe(
      "INTEGRATION_DB_NOT_AUTHORIZED",
    );
  });

  it("denies uppercase TRUE authorization", () => {
    expect(expectDenied({ authorization: "TRUE" }).code).toBe(
      "INTEGRATION_DB_NOT_AUTHORIZED",
    );
  });

  it("denies production NODE_ENV without explicit production authorization", () => {
    expect(expectDenied({ nodeEnv: "production" }).code).toBe(
      "INTEGRATION_DB_PRODUCTION_ENV_FORBIDDEN",
    );
  });

  it("denies production NODE_ENV with non-exact production authorization", () => {
    expect(
      expectDenied({
        nodeEnv: "production",
        productionAuthorization: "TRUE",
      }).code,
    ).toBe("INTEGRATION_DB_PRODUCTION_ENV_FORBIDDEN");
  });

  it("allows production NODE_ENV only with explicit production authorization and exact target", () => {
    const target = assertAuthorizedDatabaseTarget(
      validInput({
        nodeEnv: "production",
        productionAuthorization: "true",
      }),
    );

    expect(target).toEqual({
      hostname: "staging-db.example.invalid",
      databaseName: "test_db",
      port: "5432",
    });
  });

  it("denies missing expected host", () => {
    expect(expectDenied({ expectedHost: undefined }).code).toBe(
      "INTEGRATION_DB_EXPECTED_HOST_REQUIRED",
    );
  });

  it("denies blank expected host", () => {
    expect(expectDenied({ expectedHost: "   " }).code).toBe(
      "INTEGRATION_DB_EXPECTED_HOST_REQUIRED",
    );
  });

  it("denies missing expected database name", () => {
    expect(expectDenied({ expectedDatabase: undefined }).code).toBe(
      "INTEGRATION_DB_EXPECTED_NAME_REQUIRED",
    );
  });

  it("denies blank expected database name", () => {
    expect(expectDenied({ expectedDatabase: "   " }).code).toBe(
      "INTEGRATION_DB_EXPECTED_NAME_REQUIRED",
    );
  });

  it("denies missing DATABASE_URL", () => {
    expect(expectDenied({ databaseUrl: undefined }).code).toBe(
      "INTEGRATION_DB_URL_INVALID",
    );
  });

  it("denies malformed DATABASE_URL", () => {
    expect(expectDenied({ databaseUrl: "not a url" }).code).toBe(
      "INTEGRATION_DB_URL_INVALID",
    );
  });

  it("denies unsupported URL protocol", () => {
    expect(expectDenied({ databaseUrl: "https://staging-db.example.invalid/test_db" }).code).toBe(
      "INTEGRATION_DB_PROTOCOL_INVALID",
    );
  });

  it("denies host mismatch", () => {
    expect(
      expectDenied({
        databaseUrl: "postgresql://user:pass@other-db.example.invalid/test_db",
      }).code,
    ).toBe("INTEGRATION_DB_HOST_MISMATCH");
  });

  it("denies database name mismatch", () => {
    expect(
      expectDenied({
        databaseUrl: "postgresql://user:pass@staging-db.example.invalid/other_db",
      }).code,
    ).toBe("INTEGRATION_DB_NAME_MISMATCH");
  });

  it("denies similar host prefix", () => {
    expect(
      expectDenied({
        databaseUrl:
          "postgresql://user:pass@production-staging-db.example.invalid/test_db",
      }).code,
    ).toBe("INTEGRATION_DB_HOST_MISMATCH");
  });

  it("denies similar host suffix", () => {
    expect(
      expectDenied({
        databaseUrl:
          "postgresql://user:pass@staging-db.example.invalid.evil.example/test_db",
      }).code,
    ).toBe("INTEGRATION_DB_HOST_MISMATCH");
  });

  it("handles encoded database name deterministically", () => {
    const target = assertAuthorizedDatabaseTarget(
      validInput({
        databaseUrl:
          "postgresql://user:pass@staging-db.example.invalid/test%5Fdb",
      }),
    );

    expect(target.databaseName).toBe("test_db");
  });

  it("allows exact host and database with lowercase true in nonproduction", () => {
    expect(assertAuthorizedDatabaseTarget(validInput())).toEqual({
      hostname: "staging-db.example.invalid",
      databaseName: "test_db",
      port: "5432",
    });
  });

  it("normalizes hostname casing for exact DNS identity", () => {
    const target = assertAuthorizedDatabaseTarget(
      validInput({
        databaseUrl:
          "postgresql://user:pass@STAGING-DB.EXAMPLE.INVALID:5432/test_db",
        expectedHost: "staging-db.example.invalid",
      }),
    );

    expect(target.hostname).toBe("staging-db.example.invalid");
  });

  it("does not include credentials, full URL, or query tokens in error text", () => {
    const error = expectDenied({
      databaseUrl:
        "postgresql://secret-user:SUPER_SECRET_PASSWORD@staging-db.example.invalid:5432/test_db?sslmode=require&token=VERY_SECRET_TOKEN",
      expectedHost: "other-db.example.invalid",
    });

    expect(error.message).not.toContain("secret-user");
    expect(error.message).not.toContain("SUPER_SECRET_PASSWORD");
    expect(error.message).not.toContain("VERY_SECRET_TOKEN");
    expect(error.message).not.toContain("sslmode=require");
    expect(error.message).not.toContain("postgresql://");
  });
});
