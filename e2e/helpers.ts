import type { Locator, Page } from "@playwright/test"

import type { DayboardState } from "../src/lib/types"

// The first-run board's titles, in the order it lays them out (`createDefaultWidgets` in src/lib/types.ts).
// Spelled out here rather than imported so a change to the product's default board fails these tests loudly instead of moving along with it.
export const DEFAULT_BOARD_TITLES = [
  "🕒 Local time",
  "🌅 Tomorrow morning",
  "👋 Welcome",
  "💬 Today's reminder",
  "🚶 Daily walk",
  "📅 This year"
] as const

// A fresh new tab on the first-run board.
// The worker's browser is shared between tests, so storage is cleared on arrival and the page reloaded onto the empty store.
export const openNewTab = async (page: Page, extensionId: string) => {
  await page.goto(`chrome-extension://${extensionId}/newtab.html`)
  await page.evaluate(() => chrome.storage.sync.clear())
  await page.reload()
}

// The whole add flow for the common case: open the menu, pick the kind, name it, save.
// Anything that needs to assert mid-flow or fill an extra field still writes the steps out.
export const addWidget = async (page: Page, kind: string, title: string) => {
  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: `Add ${kind}` }).click()
  await page.getByLabel("Name").fill(title)
  await page.getByRole("button", { name: `Save ${kind}` }).click()
}

// Right-clicks the card, which opens its menu under the cursor.
// The click lands in the card's middle, which for a note or a habit is a control with a menu of its own; open those from the keyboard instead.
export const openWidgetMenu = async (page: Page, title: string) => {
  await cardByTitle(page, title).click({ button: "right" })
}

// A board card, found by the heading it shows.
// Pass `exact` when a shorter title would otherwise also match a longer one, such as "Today" against "Today's reminder".
export const cardByTitle = (page: Page, title: string, exact = false): Locator =>
  page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: title, exact }) })

// A bounding box that is known to exist, so the caller can do arithmetic on it without a null check of its own.
// `what` names the thing being measured, since a bare "no bounds" failure gives nothing to go on.
export const boxOf = async (locator: Locator, what: string) => {
  const box = await locator.boundingBox()

  if (!box) {
    throw new Error(`Unable to measure ${what}`)
  }

  return box
}

// What a widget actually persisted, read back out of chrome.storage.sync.
// The title is what identifies it, since the default board ships cards of every kind alongside the one a test added.
export const readWidgetSettings = (page: Page, title: string) =>
  page.evaluate(async (name) => {
    const stored = await chrome.storage.sync.get("dayboard-state")
    const { widgets } = stored["dayboard-state"] as DayboardState

    return widgets.find((widget) => widget.title === name)?.settings
  }, title)
