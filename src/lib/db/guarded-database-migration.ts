import {
  assertAuthorizedDatabaseTarget,
  type AuthorizedDatabaseTarget,
} from "./database-target-authorization";

export const DATABASE_MIGRATION_AUTHORIZED = "DATABASE_MIGRATION_AUTHORIZED";
export const DATABASE_MIGRATION_EXPECTED_HOST = "DATABASE_MIGRATION_EXPECTED_HOST";
export const DATABASE_MIGRATION_EXPECTED_NAME = "DATABASE_MIGRATION_EXPECTED_NAME";
export const DATABASE_MIGRATION_PRODUCTION_AUTHORIZED =
  "DATABASE_MIGRATION_PRODUCTION_AUTHORIZED";

export function assertAuthorizedDatabaseMigrationTarget(
  env: NodeJS.ProcessEnv = process.env,
): AuthorizedDatabaseTarget {
  return assertAuthorizedDatabaseTarget({
    operation: "database migration",
    databaseUrl: env.DATABASE_URL,
    authorization: env[DATABASE_MIGRATION_AUTHORIZED],
    productionAuthorization: env[DATABASE_MIGRATION_PRODUCTION_AUTHORIZED],
    expectedHost: env[DATABASE_MIGRATION_EXPECTED_HOST],
    expectedDatabase: env[DATABASE_MIGRATION_EXPECTED_NAME],
    nodeEnv: env.NODE_ENV,
    forbidProductionNodeEnv: true,
  });
}

export async function runGuardedDatabaseMigration(input: {
  env?: NodeJS.ProcessEnv;
  runMigration: () => Promise<void> | void;
}): Promise<void> {
  assertAuthorizedDatabaseMigrationTarget(input.env ?? process.env);
  await input.runMigration();
}
