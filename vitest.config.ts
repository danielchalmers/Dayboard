import { defineConfig } from "vitest/config"

export default defineConfig({
  esbuild: {
    jsx: "automatic"
  },
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/build/**", "**/e2e/**"],
    globals: true,
    setupFiles: ["./test/setup.ts"],
    coverage: {
      reporter: ["text", "lcov"]
    }
  },
  resolve: {
    alias: {
      "~": new URL("./src", import.meta.url).pathname
    }
  }
})
