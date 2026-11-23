import { defineConfig } from "@playwright/test"

const isCI = Boolean(process.env["CI"])

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  // A stray `test.only` must not turn a CI run green while quietly skipping the rest.
  forbidOnly: isCI,
  // One retry on CI absorbs runner noise without hiding it: Playwright reports a test that only passed on the retry as flaky.
  // Locally it stays at zero, so a flake shows itself while you are in a position to look at it.
  retries: isCI ? 1 : 0,
  // Each worker runs one Chromium persistent context with the extension loaded (`e2e/fixtures.ts`), reused across its tests, so live browsers now match the worker count rather than the test count.
  // Locally, Playwright picks its own default (half the logical cores).
  ...(isCI ? { workers: 4 } : {}),
  // Stop early when something systemic breaks, instead of spending the runner on the same failure fifty times.
  maxFailures: isCI ? 10 : 0,
  globalTimeout: 20 * 60_000,
  globalSetup: "./e2e/global-setup.ts",
  reporter: isCI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    // Kept on failure rather than on retry: the first failure is the one worth having a trace for.
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium"
    }
  ]
})
