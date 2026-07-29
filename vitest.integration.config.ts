import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const serverConditions = ["react-server", "node", "import", "module", "default"];

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    conditions: serverConditions,
  },
  ssr: {
    resolve: {
      conditions: serverConditions,
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
