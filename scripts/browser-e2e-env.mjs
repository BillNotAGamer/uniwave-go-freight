const DEFAULT_PORT = "3100";

export function buildBrowserE2EEnv(baseEnv = process.env) {
  const port = baseEnv.E2E_PORT || DEFAULT_PORT;
  const baseURL = baseEnv.E2E_BASE_URL || `http://127.0.0.1:${port}`;

  return {
    ...baseEnv,
    NODE_ENV: "production",
    E2E_PORT: port,
    E2E_BASE_URL: baseURL,
    NEXT_PUBLIC_AUTH_URL: baseURL,
    AUTH_URL: baseURL,
    AUTH_SECRET:
      "browser-e2e-local-only-auth-secret-not-for-real-credentials",
    DATABASE_URL: "postgresql://browser-e2e.invalid/uniwave_e2e_no_db",
    ARTIFACT_R2_ACCOUNT_ID: "browser-e2e-disabled",
    ARTIFACT_R2_ACCESS_KEY_ID: "browser-e2e-disabled",
    ARTIFACT_R2_SECRET_ACCESS_KEY: "browser-e2e-disabled",
    ARTIFACT_R2_BUCKET_NAME: "browser-e2e-disabled",
    GOOGLE_SERVICE_ACCOUNT_JSON: "{}",
    GOOGLE_DRIVE_ROOT_FOLDER_ID: "browser-e2e-disabled",
  };
}
