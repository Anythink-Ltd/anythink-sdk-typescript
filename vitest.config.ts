import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    restoreMocks: true,
    setupFiles: ["./src/tests/setup.ts"],
    reporters: ["default", "junit"],
    outputFile: { junit: "./reports/junit.xml" },
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/**/tests/**", "src/**/*.test.*", "src/index.ts", "src/types/**"],
      reporter: ["text", "json-summary", "lcov"],
      thresholds: { lines: 91, statements: 91, functions: 95, branches: 80 },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
