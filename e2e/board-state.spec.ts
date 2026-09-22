import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"
import { cardByTitle, readWidgetSettings } from "./helpers"

const openNewTab = async (page: Page, extensionId: string) => {
  await page.goto(`chrome-extension://${extensionId}/newtab.html`)
  await page.evaluate(() => chrome.storage.sync.clear())
  await page.reload()
}

// The whole add flow for the common case: open the menu, pick the kind, name it, save.
const addWidget = async (page: Page, kind: string, title: string) => {
  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: `Add ${kind}` }).click()
  await page.getByLabel("Name").fill(title)
  await page.getByRole("button", { name: `Save ${kind}` }).click()
}

// A rejected write is the one thing the shared browser's guard fails a test over, so the test that goes looking for one says so up front.
test.describe("a board too large to sync", () => {
  test.use({ expectsSaveError: true })

  test("rolls the note back and says why", async ({ page, extensionId }) => {
    await openNewTab(page, extensionId)
    await addWidget(page, "note", "Scratch")

    // Save something worth keeping first, so the rollback below has a visible value to return to rather than an empty field.
    const field = page.getByLabel("Scratch note")
    await field.fill("Keep me")
    await field.blur()
    await expect(field).toHaveValue("Keep me")

    // chrome.storage.sync caps a single item at 8KB and a note has no length cap, so a long paste is a write the browser refuses.
    await field.fill("x".repeat(20_000))
    await field.blur()

    // The notice writes "Couldn't" with a typographic apostrophe, so match the plain half of the sentence instead.
    const notice = page.getByRole("alert")
    await expect(notice).toContainText("too large to sync")

    // The optimistic update is undone, so the card shows what actually persisted instead of quietly diverging from it.
    await expect(field).toHaveValue("Keep me")

    await page.getByRole("button", { name: "Dismiss" }).click()
    await expect(notice).toHaveCount(0)

    await page.reload()
    await expect(page.getByLabel("Scratch note")).toHaveValue("Keep me")
  })
})

test("a note keeps what is being typed in it while an idle one adopts the change", async ({
  context,
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)
  await addWidget(page, "note", "Scratch")

  // A plain goto rather than openNewTab, which clears storage and would take the note with it.
  const secondPage = await context.newPage()
  await secondPage.goto(`chrome-extension://${extensionId}/newtab.html`)

  const field = page.getByLabel("Scratch note")
  const mirrored = secondPage.getByLabel("Scratch note")

  // Blurring flushes the debounced auto-save.
  await field.fill("from tab one")
  await field.blur()

  // Nobody is typing in the second tab, so it takes the change.
  await expect(mirrored).toHaveValue("from tab one")

  await mirrored.click()
  await mirrored.fill("local edit")

  // Let the second tab's own debounced save land before tab one writes again, so the two writes queue rather than race.
  await expect
    .poll(() => readWidgetSettings(secondPage, "Scratch"))
    .toEqual({ text: "local edit" })

  await field.fill("from tab one again")
  await field.blur()

  // A later write to the same key proves the conflicting note write reached the second tab, so the assertion below cannot pass merely by running early.
  // The gate is an added widget rather than a rename, since a note's accessible name comes from its title.
  await addWidget(page, "clock", "Paris")
  await expect(secondPage.getByRole("heading", { name: "Paris" })).toBeVisible()

  // The remote text never lands in the note the user has their cursor in.
  await expect(mirrored).toBeFocused()
  await expect(mirrored).toHaveValue("local edit")

  await secondPage.close()
})

test("a countdown whose span has run out reads as complete", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add countdown" }).click()
  await page.getByLabel("Name").fill("Sprint")
  // A span that closed years ago, which is where every progress countdown ends up.
  await page.getByLabel("When").fill("2020-01-02T09:00")
  await page.getByLabel("Starting from").fill("2020-01-01T09:00")
  await page.getByRole("button", { name: "Save countdown" }).click()

  const card = cardByTitle(page, "Sprint")

  await expect(card.locator(".board-row__value")).toHaveText("100%")
  await expect(
    card.getByRole("progressbar", { name: "Sprint progress" })
  ).toHaveAttribute("aria-valuenow", "100")
  // The finished branch replaces the remaining-time label outright rather than counting on into "ago".
  await expect(card.getByText("Complete")).toBeVisible()
  await expect(card.getByText(/left|ago/)).toHaveCount(0)
})

test("a note typed just before its tab closes keeps every keystroke", async ({
  context,
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)
  await addWidget(page, "note", "Scratch")

  // Typed and closed inside the auto-save's pause, with no blur on the way out: the page being hidden is the last chance to hand the text over.
  await page.getByLabel("Scratch note").pressSequentially("Last thought")
  await page.close({ runBeforeUnload: true })

  const reopened = await context.newPage()
  await reopened.goto(`chrome-extension://${extensionId}/newtab.html`)

  await expect(reopened.getByLabel("Scratch note")).toHaveValue("Last thought")
})

test("a card carrying data this version can't read leaves the rest of the board standing", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  // What a newer Dayboard on another synced device, or a hand-edited import, can put in front of this one: a repeat it doesn't know and a quote list that isn't a list.
  await page.evaluate(() =>
    chrome.storage.sync.set({
      "dayboard-state": {
        widgets: [
          { id: "a", kind: "note", title: "Healthy", colorPreset: "mint", settings: { text: "Still here" } },
          { id: "b", kind: "countdown", title: "Payday", colorPreset: "sky", settings: { targetAt: "2020-01-01T09:00:00.000Z", repeat: "fortnightly" } },
          { id: "c", kind: "quote", title: "Words", colorPreset: "rose", settings: { quotes: "not a list", rotation: "daily" } }
        ],
        settings: { name: "" }
      }
    })
  )
  await page.reload()

  await expect(page.getByLabel("Healthy note")).toHaveValue("Still here")
  // The unknown repeat is dropped, so the countdown reads as a plain one-off in the past rather than throwing on its way to a date.
  await expect(cardByTitle(page, "Payday").getByText("ago")).toBeVisible()
  await expect(cardByTitle(page, "Words")).toContainText("Add a few quotes")
})
