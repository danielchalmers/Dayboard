import path from "node:path"
import { fileURLToPath } from "node:url"

import { test as base, chromium, type BrowserContext } from "@playwright/test"

const extensionPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.output/chrome-mv3"
)

// Loads the real built extension into a persistent context so tests exercise chrome.storage.sync and the new tab override exactly as Chrome runs them.
// The locale and time zone are pinned because the board formats dates, weekday names, and greetings through `Intl` with no explicit locale, so an unpinned runner asserts against whatever the machine happens to be set to.
const launchExtension = () =>
  chromium.launchPersistentContext("", {
    channel: "chromium",
    locale: "en-US",
    timezoneId: "UTC",
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })

// An unpacked extension's id is derived from its path, so it is the same for every launch; resolving it once per worker keeps each test off the service-worker startup race.
const resolveExtensionId = async (context: BrowserContext) => {
  let [serviceWorker] = context.serviceWorkers()

  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", {
      timeout: 10_000
    })
  }

  return serviceWorker.url().split("/")[2]!
}

// One browser per worker with a fresh page per test, rather than a whole browser per test.
// Launching Chromium with the extension costs about a second; opening a page in a warm one costs about a tenth of that, which is what makes a suite this size affordable.
//
// Playwright refuses to re-register a built-in fixture under a new scope, so the shared context needs a name of its own and `context`/`page` stay test-scoped wrappers over it.
export const test = base.extend<
  {
    extensionId: string
    ownBrowser: boolean
    expectsSaveError: boolean
    failOnSaveError: void
  },
  { workerContext: BrowserContext; workerExtensionId: string }
>({
  // `test.use({ ownBrowser: true })` opts a file or describe block back out to a browser of its own, for anything that would dirty the profile for its neighbours.
  ownBrowser: [false, { option: true }],

  // `test.use({ expectsSaveError: true })` is for the test that drives a failed write on purpose, so the guard below does not fail it for finding what it went looking for.
  expectsSaveError: [false, { option: true }],

  workerContext: [
    async ({}, use) => {
      const context = await launchExtension()

      await use(context)
      await context.close()
    },
    { scope: "worker" }
  ],

  workerExtensionId: [
    async ({ workerContext }, use) => {
      await use(await resolveExtensionId(workerContext))
    },
    { scope: "worker" }
  ],

  context: async ({ workerContext, ownBrowser }, use) => {
    if (ownBrowser) {
      const context = await launchExtension()

      await use(context)
      await context.close()
      return
    }

    await use(workerContext)

    // Close whatever the test left open, including any extra tabs it made, so a failure part way through cannot strand live boards that keep listening for storage changes.
    await Promise.all(workerContext.pages().map((page) => page.close()))
  },

  extensionId: async ({ context, workerContext, workerExtensionId }, use) => {
    await use(
      context === workerContext
        ? workerExtensionId
        : await resolveExtensionId(context)
    )
  },

  page: async ({ context }, use) => {
    await use(await context.newPage())
  },

  // A write rejected by chrome.storage.sync rolls back and leaves a notice rather than throwing, which reads downstream as a widget that simply never appeared.
  // Tests share a profile now, and the sync write quota is per profile, so name that cause instead of leaving it to look like an ordinary selector timeout.
  failOnSaveError: [
    async ({ page, expectsSaveError }, use) => {
      await use()

      if (expectsSaveError || page.isClosed()) {
        return
      }

      const notice = await page
        .getByText(/Couldn’t save/)
        .count()
        .catch(() => 0)

      if (notice > 0) {
        throw new Error(
          "A board write was rejected. This is usually the chrome.storage.sync write-rate quota, which is shared across the tests running in one worker's browser profile."
        )
      }
    },
    { auto: true }
  ]
})

export const expect = test.expect
