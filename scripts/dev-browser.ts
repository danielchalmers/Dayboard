import path from "node:path"

import { chromium, type BrowserContext, type Page } from "@playwright/test"

export type DevBrowser = {
  context: BrowserContext
  /** chrome-extension://<id>, for telling the extension's pages from the rest. */
  extensionOrigin: string
}

// chrome://extensions has the private API behind its developer mode switch, which @types/chrome doesn't describe.
type DeveloperPrivate = {
  updateProfileConfiguration(update: { inDeveloperMode: boolean }): Promise<void>
}

// Opens the installed Chrome (or Edge) with the unpacked extension loaded and a new tab showing the board, for `npm run dev`. Teichos's dev browser opens the same way.
// Chrome stopped honouring --load-extension in version 137, so the extension is loaded through the DevTools protocol, which Chrome and Edge allow when they start with --enable-unsafe-extension-debugging.
// The browser forgets an extension loaded that way when it closes, so it's loaded again on every launch. Its storage stays in the profile, which is kept under .vscode, so the board you build up while developing survives a restart.
export const openDevBrowser = async (
  extensionPath: string,
  browser: "chrome" | "edge"
): Promise<DevBrowser> => {
  const context = await chromium.launchPersistentContext(
    path.resolve(`.vscode/${browser}-debug-profile`),
    {
      channel: browser === "edge" ? "msedge" : "chrome",
      headless: false,
      // Let the page follow the window, as a browser opened by hand does, instead of Playwright's fixed 1280×720.
      viewport: null,
      // Playwright turns extensions off, which would leave the loaded one disabled, and adds the "controlled by automated test software" bar, which would push the board down.
      ignoreDefaultArgs: ["--disable-extensions", "--enable-automation"],
      args: ["--enable-unsafe-extension-debugging"]
    }
  )

  const cdp = context.browser()
  if (!cdp) {
    throw new Error("Playwright gave no browser to load the extension through.")
  }
  const session = await cdp.newBrowserCDPSession()
  const { id } = await session.send("Extensions.loadUnpacked", { path: extensionPath })
  const extensionOrigin = `chrome-extension://${id}`

  const page = context.pages()[0] ?? (await context.newPage())
  // The browser reloads an unpacked extension into a disabled state unless developer mode is on, and the dev script reloads it whenever the service worker changes.
  await page.goto("chrome://extensions/")
  await page.evaluate(() =>
    (chrome as unknown as { developerPrivate: DeveloperPrivate }).developerPrivate.updateProfileConfiguration({
      inDeveloperMode: true
    })
  )
  await page.goto("chrome://newtab/")

  return { context, extensionOrigin }
}

const isExtensionPage = (url: string, extensionOrigin: string) => url.startsWith(`${extensionOrigin}/`)

// An unpacked extension's pages read its files from disk, so reloading them picks up a rebuild that left the service worker alone. Returns how many reloaded.
export const reloadPages = async ({ context, extensionOrigin }: DevBrowser): Promise<number> => {
  const pages = context.pages().filter((page) => isExtensionPage(page.url(), extensionOrigin))
  // A page closed mid-reload has nothing left to show.
  await Promise.all(pages.map((page) => page.reload().catch(() => {})))
  return pages.length
}

// A running service worker keeps the code it started with, so when a rebuild changes it the whole extension reloads, which restarts the worker on the new files.
// The browser closes the extension's tabs when it reloads, so the ones that were open are opened again. Returns how many.
export const reloadExtension = async ({ context, extensionOrigin }: DevBrowser): Promise<number> => {
  const openUrls = context
    .pages()
    .map((page) => page.url())
    .filter((url) => isExtensionPage(url, extensionOrigin))
  const restarted = context.waitForEvent("serviceworker", {
    predicate: (worker) => isExtensionPage(worker.url(), extensionOrigin)
  })

  // Any of the extension's own contexts can reload it. The board's worker is empty and may be asleep, so a page of the extension does the job when there's no worker to ask.
  const worker = context.serviceWorkers().find((candidate) => isExtensionPage(candidate.url(), extensionOrigin))
  if (worker) {
    await worker.evaluate(() => chrome.runtime.reload())
  } else {
    const page = await openPage(context, `${extensionOrigin}/newtab.html`)
    await page.evaluate(() => chrome.runtime.reload())
  }
  await restarted

  for (const url of openUrls) {
    await openPage(context, url)
  }
  return openUrls.length
}

const openPage = async (context: BrowserContext, url: string): Promise<Page> => {
  const page = await context.newPage()
  await page.goto(url)
  return page
}
