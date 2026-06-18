import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  // Each test launches its own full Chromium persistent context with the
  // extension loaded; cap workers on CI so the runner does not run out of memory.
  workers: process.env.CI ? 2 : undefined,
  globalSetup: "./e2e/global-setup.ts",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium"
    }
  ]
})
