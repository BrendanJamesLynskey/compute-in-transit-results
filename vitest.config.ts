import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    testTimeout: 120_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**/*.ts"],
      // the loaders, types, quoting helpers and constants run in the pages (build)
      exclude: [
        "src/lib/data/**",
        "src/lib/quote.ts",
        "src/lib/site.ts",
        "src/lib/viz/palette.ts",
      ],
      thresholds: {
        // The model port and the run-log views.
        "src/lib/transit/**": {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 85,
        },
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
