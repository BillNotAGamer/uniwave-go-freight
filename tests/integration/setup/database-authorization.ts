import {
  assertAuthorizedDatabaseTarget,
  type AuthorizedDatabaseTarget,
} from "@/lib/db/database-target-authorization";

export const INTEGRATION_TEST_DATABASE_AUTHORIZED =
  "INTEGRATION_TEST_DATABASE_AUTHORIZED";
export const INTEGRATION_TEST_DATABASE_EXPECTED_HOST =
  "INTEGRATION_TEST_DATABASE_EXPECTED_HOST";
export const INTEGRATION_TEST_DATABASE_EXPECTED_NAME =
  "INTEGRATION_TEST_DATABASE_EXPECTED_NAME";
export const INTEGRATION_TEST_DATABASE_PRODUCTION_AUTHORIZED =
  "INTEGRATION_TEST_DATABASE_PRODUCTION_AUTHORIZED";

export function assertAuthorizedIntegrationDatabaseTarget(
  env: NodeJS.ProcessEnv = process.env,
): AuthorizedDatabaseTarget {
  return assertAuthorizedDatabaseTarget({
    operation: "integration test database",
    databaseUrl: env.DATABASE_URL,
    authorization: env[INTEGRATION_TEST_DATABASE_AUTHORIZED],
    productionAuthorization: env[INTEGRATION_TEST_DATABASE_PRODUCTION_AUTHORIZED],
    expectedHost: env[INTEGRATION_TEST_DATABASE_EXPECTED_HOST],
    expectedDatabase: env[INTEGRATION_TEST_DATABASE_EXPECTED_NAME],
    nodeEnv: env.NODE_ENV,
    forbidProductionNodeEnv: true,
  });
}
