import type { Locator, Page } from "@playwright/test"

import type { DayboardState } from "../src/lib/types"

// The first-run board's titles, in the order it lays them out (`createDefaultWidgets` in src/lib/types.ts).
// Spelled out here rather than imported so a change to the product's default board fails these tests loudly instead of moving along with it.
export const DEFAULT_BOARD_TITLES = [
  "🕒 Local time",
  "🌅 Morning",
  "👋 Welcome",
  "💬 Today's reminder",
  "🚶 Daily walk",
  "📅 This year"
] as const

// A fresh new tab on the first-run board.
// The worker's browser is shared between tests, so both places a board is kept are emptied first: chrome.storage.sync, and the localStorage mirror a new tab paints from before it has read storage.
// They are emptied from the extension's manifest rather than from the board, because an open board hears storage change and writes the mirror straight back.
// With no mirror the page stays blank until its first read lands, as on a real first run, and the board is waited for here, so a test starts on a board that has caught up with storage.
// Painted from a mirror, the board was there to act on while the read was still out, and on a busy machine the read came back a second or two later and put the board back to how storage had it when it was asked: a card just added went and came back empty, and whatever had been typed on it was gone.
export const openNewTab = async (page: Page, extensionId: string) => {
  await page.goto(`chrome-extension://${extensionId}/manifest.json`)
  await page.evaluate(async () => {
    localStorage.clear()
    await chrome.storage.sync.clear()
  })
  await page.goto(`chrome-extension://${extensionId}/newtab.html`)
  await page.locator(".board-row").first().waitFor()
}

// Lifts a card from the keyboard and waits until the keys that move, drop or cancel it will be heard.
// dnd-kit's keyboard sensor starts listening for those in a timeout it sets as the card lifts, and on a busy machine a key sent straight after the lift got there first and was lost.
// A timeout set once the lifted card is showing runs behind the sensor's own.
export const liftWithKeyboard = async (page: Page, card: Locator) => {
  await card.focus()
  await page.keyboard.press("Space")
  await page.locator(".board-row--overlay").waitFor()
  await page.evaluate(
    () => new Promise<void>((resolve) => window.setTimeout(resolve))
  )
}

// The whole add flow for the common case: open the menu, pick the kind, name it, save.
// Anything that needs to assert mid-flow or fill an extra field still writes the steps out.
export const addWidget = async (page: Page, kind: string, title: string) => {
  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: `Add ${kind}` }).click()
  await page.getByLabel("Name").fill(title)
  await page.getByRole("button", { name: `Save ${kind}` }).click()
  // Save closes the dialog once its write lands, so wait for that before the caller reaches for the board.
  await page.getByRole("dialog").waitFor({ state: "hidden" })
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
