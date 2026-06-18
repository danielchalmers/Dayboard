import path from "node:path"
import { fileURLToPath } from "node:url"

import { test as base, chromium, type BrowserContext } from "@playwright/test"

const extensionPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.output/chrome-mv3"
)

// Loads the real built extension into a persistent context so tests exercise
// chrome.storage.sync and the new tab override exactly as Chrome runs them.
export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    })

    await use(context)
    await context.close()
  },
  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers()
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker", {
        timeout: 10_000
      })
    }

    await use(serviceWorker.url().split("/")[2]!)
  }
})

export const expect = test.expect
