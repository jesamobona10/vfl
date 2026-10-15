import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    globalSetup: ["test/global-setup.ts"],
    // Authorization suites hit a real local Supabase instance.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
