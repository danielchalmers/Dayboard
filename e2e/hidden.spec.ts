import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"
import { cardByTitle, openNewTab, openWidgetMenu, readWidgetSettings } from "./helpers"

// A hidden board is remembered in the profile's localStorage, and stays hidden for every board tab opened after it, so these tests take a browser of their own rather than leaving the next test a covered board.
test.use({ ownBrowser: true })

const GREETING = /^Good (morning|afternoon|evening)$/
const GREETING_BY_NAME = /^Good (morning|afternoon|evening), Daniel$/

const openBoard = async (page: Page, extensionId: string) => {
  await page.goto(`chrome-extension://${extensionId}/newtab.html`)
}

test("hiding the board covers every tab here, and the next one opened, until it is shown again", async ({
  context,
  page,
  extensionId
}) => {
  await openBoard(page, extensionId)
  await page.evaluate(() =>
    chrome.storage.sync.set({
      "dayboard-state": {
        widgets: [
          {
            id: "dentist",
            kind: "note",
            title: "Dentist",
            colorPreset: "sky",
            settings: { text: "Tuesday at three" }
          },
          {
            id: "lisbon",
            kind: "clock",
            title: "Lisbon",
            colorPreset: "rose",
            settings: { timeZone: "Europe/Lisbon" }
          },
          {
            id: "plans",
            kind: "note",
            title: "Old plans",
            colorPreset: "slate",
            archived: true,
            settings: { text: "" }
          }
        ],
        settings: { name: "Daniel" }
      }
    })
  )
  await page.reload()

  const other = await context.newPage()
  await openBoard(other, extensionId)
  await expect(cardByTitle(other, "Dentist")).toBeVisible()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(GREETING_BY_NAME)

  // From the keyboard, the button that hid the board is the one that shows it, so focus is already on the way back.
  await page.getByRole("button", { name: "Hide board" }).focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("button", { name: "Show board" })).toBeFocused()

  // The cards, the archive, and everything that edits the board go; the greeting stays, without the name.
  for (const tab of [page, other]) {
    await expect(tab.locator(".board-row")).toHaveCount(0)
    await expect(tab.getByRole("heading", { level: 1 })).toHaveText(GREETING)
    await expect(tab.locator("body")).not.toContainText("Daniel")
    await expect(tab.locator("body")).not.toContainText("Dentist")
    await expect(tab.getByRole("button", { name: /archived/ })).toHaveCount(0)
    await expect(tab.getByRole("button", { name: "Add widget" })).toHaveCount(0)
    await expect(tab.getByRole("button", { name: "Options" })).toHaveCount(0)
  }

  // A tab opened now has the board in its localStorage mirror to paint from, and must not: a card that shows for a frame has been seen.
  const opened = await context.newPage()
  await opened.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector(".board-row")) {
        ;(window as unknown as { __sawCard: boolean }).__sawCard = true
      }
    }).observe(document, { childList: true, subtree: true })
  })
  await openBoard(opened, extensionId)
  await expect(opened.getByRole("button", { name: "Show board" })).toBeVisible()
  await expect(opened.getByRole("heading", { level: 1 })).toHaveText(GREETING)
  // The page's own read from chrome.storage.sync was asked for first, so by the time this one answers and a frame has passed, a board that was going to arrive late has.
  await opened.evaluate(async () => {
    await chrome.storage.sync.get("dayboard-state")
    await new Promise(requestAnimationFrame)
  })
  expect(
    await opened.evaluate(() => (window as unknown as { __sawCard?: boolean }).__sawCard)
  ).toBeUndefined()

  // Shown from any one of them, the board is back in all of them as it was.
  await opened.getByRole("button", { name: "Show board" }).click()

  for (const tab of [page, other, opened]) {
    await expect(cardByTitle(tab, "Dentist")).toBeVisible()
    await expect(tab.getByRole("heading", { level: 1 })).toHaveText(GREETING_BY_NAME)
    await expect(tab.getByRole("button", { name: "Hide board" })).toBeVisible()
    await expect(tab.getByRole("button", { name: "Show archived" })).toBeVisible()
  }
})

test("a running timer sleeps while the board is hidden and settles when it is shown", async ({
  page,
  extensionId
}) => {
  await page.clock.install({ time: new Date("2026-03-04T10:00:00Z") })
  await openBoard(page, extensionId)
  await page.evaluate(() =>
    chrome.storage.sync.set({
      "dayboard-state": {
        widgets: [
          {
            id: "tea",
            kind: "timer",
            title: "Tea",
            colorPreset: "rose",
            settings: {
              durationMs: 300_000,
              running: true,
              remainingMs: 300_000,
              endsAt: Date.now() + 300_000,
              chime: true
            }
          }
        ],
        settings: { name: "" }
      }
    })
  )
  await expect(cardByTitle(page, "Tea")).toBeVisible()

  await page.getByRole("button", { name: "Hide board" }).click()
  await expect(page.locator(".board-row")).toHaveCount(0)

  // The finish comes and goes with nothing on the page left to take it: the run is still as it was in storage, and the tab says nothing.
  await page.clock.fastForward("10:00")
  await page.clock.runFor(1_000)
  expect(await readWidgetSettings(page, "Tea")).toMatchObject({ running: true })
  expect(await page.title()).toBe("New Tab")

  await page.getByRole("button", { name: "Show board" }).click()
  await expect(cardByTitle(page, "Tea").getByText("Time’s up")).toBeVisible()
  await expect
    .poll(() => readWidgetSettings(page, "Tea"))
    .toMatchObject({ running: false, remainingMs: 0 })
})

test("hiding the board takes a finished timer's name out of a background tab's title", async ({
  context,
  page,
  extensionId
}) => {
  // A headless page never really goes into the background, so this one's visibility is taken over from its first frame.
  await page.addInitScript(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden"
    })
  })
  await openBoard(page, extensionId)
  // The run starts and ends with this the only board open: a second one would race it to the finish, and only the tab that settles a run takes its title.
  await page.evaluate(() =>
    chrome.storage.sync.set({
      "dayboard-state": {
        widgets: [
          {
            id: "steep",
            kind: "timer",
            title: "Steep",
            colorPreset: "rose",
            settings: {
              durationMs: 2_000,
              running: true,
              remainingMs: 2_000,
              endsAt: Date.now() + 2_000
            }
          }
        ],
        settings: { name: "" }
      }
    })
  )

  await expect.poll(() => page.title()).toBe("Time’s up · Steep")

  // The tab strip is the one place a covered board could still be read from, so hiding it from the tab in front clears the one behind.
  const front = await context.newPage()
  await openBoard(front, extensionId)
  await front.getByRole("button", { name: "Hide board" }).click()
  await expect.poll(() => page.title()).toBe("New Tab")
})

test("hiding the board lets an archive's Undo go with it", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await openWidgetMenu(page, "🌅 Morning")
  await page.getByRole("menuitem", { name: "Archive 🌅 Morning" }).click()
  const notice = page.locator(".board-notice")
  await expect(notice).toContainText("Morning")

  // The notice names the card, so it does not stay up over a hidden board, or come back with it.
  await page.getByRole("button", { name: "Hide board" }).click()
  await expect(notice).toHaveCount(0)

  await page.getByRole("button", { name: "Show board" }).click()
  await expect(page.getByRole("button", { name: "Show archived" })).toBeVisible()
  await expect(notice).toHaveCount(0)
})
