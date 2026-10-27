import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    env: {
      JWT_SECRET: "test-secret-key-for-vitest-32chars",
      TMDB_API_TOKEN: "eyJtb2NrLXRva2VuLWZvci10ZXN0aW5n",
    },
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "playwright-report"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        ".next/",
        "vitest.config.ts",
        "vitest.setup.ts",
        "next.config.js",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
