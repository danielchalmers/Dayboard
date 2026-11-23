import { defineConfig } from "vitest/config"

// The JSX runtime is not set here.
// Vitest resolves its own Vite, which trails the one WXT builds with, so naming that transform pins this file to whichever of the two is installed today.
// Both read `jsx` from tsconfig instead, which is the setting the editor and `tsc` already follow.
export default defineConfig({
  test: {
    // Most of `src/lib` is pure functions, and booting jsdom for a file costs far more than those tests take to run.
    // The files that touch the DOM or a browser global opt in with a `// @vitest-environment jsdom` docblock, which also documents which helpers are pure.
    environment: "node",
    // Almost everything on the board is a date read in local time, so the suite's results otherwise depend on where it runs: DST assertions that hold on a contributor's machine are vacuous on CI, which is UTC and never changes offset.
    // Pin one zone that observes DST so the whole suite means the same thing everywhere.
    env: { TZ: "America/Chicago" },
    // `.claude` holds agent worktrees, full checkouts whose tests must not be collected into this repo's run.
    exclude: [
      "**/node_modules/**",
      "**/.output/**",
      "**/.wxt/**",
      "**/e2e/**",
      "**/.claude/**"
    ],
    globals: true,
    setupFiles: ["./test/setup.ts"]
  },
  resolve: {
    alias: {
      "~": new URL("./src", import.meta.url).pathname
    }
  }
})
