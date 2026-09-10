import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const nodeConditions = ["node", "import", "default"];

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is a Next.js client-bundle marker. Integration tests run
      // server code in Vitest, so use an explicit no-op test module instead of
      // globally activating React's react-server export condition.
      "server-only": fileURLToPath(
        new URL("./tests/integration/setup/server-only.ts", import.meta.url),
      ),
    },
    conditions: nodeConditions,
  },
  ssr: {
    resolve: {
      conditions: nodeConditions,
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    globals: false,
    hookTimeout: 60_000,
    include: ["tests/integration/**/*.integration.test.ts"],
    maxWorkers: 1,
    minWorkers: 1,
    reporters: ["default"],
    setupFiles: ["./tests/integration/setup/environment.ts"],
    testTimeout: 45_000,
  },
});
