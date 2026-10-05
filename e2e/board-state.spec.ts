import type { Page } from "@playwright/test"

import type { DayboardState } from "../src/lib/types"
import { expect, test } from "./fixtures"
import {
  DEFAULT_BOARD_TITLES,
  addWidget,
  boxOf,
  cardByTitle,
  openNewTab,
  openWidgetMenu,
  readWidgetSettings
} from "./helpers"

// A rejected write is the one thing the shared browser's guard fails a test over, so the test that goes looking for one says so up front.
test.describe("a board too large to sync", () => {
  test.use({ expectsSaveError: true })

  test("keeps the note's words on screen, says why, and saves once they fit", async ({
    page,
    extensionId
  }) => {
    await openNewTab(page, extensionId)
    await addWidget(page, "note", "Scratch")

    // Save something first, so there is a stored value the refused paste could be traded back for.
    const field = page.getByLabel("Scratch note")
    await field.fill("Keep me")
    await field.blur()
    await expect.poll(() => readWidgetSettings(page, "Scratch")).toEqual({ text: "Keep me" })

    // chrome.storage.sync caps a single item at 8KB and a note has no length cap, so a long paste is a write the browser refuses.
    const pasted = `Keep me ${"x".repeat(20_000)}`
    await field.fill(pasted)
    await field.blur()

    // The notice writes "Couldn't" with a typographic apostrophe, so match the plain half of the sentence instead.
    const notice = page.getByRole("alert")
    await expect(notice).toContainText("more than browser sync can hold")

    // Storage still holds what it had, but the words stay in the field, so trimming them is all it takes rather than typing them again.
    await expect(field).toHaveValue(pasted)
    expect(await readWidgetSettings(page, "Scratch")).toEqual({ text: "Keep me" })

    // Another card saving fine says nothing about the note, so the notice stays for as long as the note holds words storage doesn't.
    await page.getByRole("button", { name: "Mark today" }).click()
    await expect
      .poll(() => readWidgetSettings(page, "🚶 Daily walk"))
      .toEqual({ history: [expect.any(String)] })
    await expect(notice).toContainText("more than browser sync can hold")

    await field.fill(pasted.slice(0, 2_000))
    await field.blur()

    await expect(notice).toHaveCount(0)
    await expect.poll(() => readWidgetSettings(page, "Scratch")).toEqual({
      text: pasted.slice(0, 2_000)
    })
  })

  // A quote list has no length cap either, and it is typed into a dialog that used to close before its write was refused.
  const longQuotes = Array.from(
    { length: 150 },
    (_, line) => `Quote ${line + 1}: you have power over your mind, not outside events.`
  ).join("\n")

  const addLongQuote = async (page: Page) => {
    await page.getByRole("button", { name: "Add widget" }).click()
    await page.getByRole("button", { name: "Add quote" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Name").fill("Stoics")
    await dialog.getByLabel("Quotes (one per line)").fill(longQuotes)

    return dialog
  }

  test("keeps a dialog open on what was typed into it and says why", async ({
    page,
    extensionId
  }) => {
    await openNewTab(page, extensionId)
    const dialog = await addLongQuote(page)
    await dialog.getByRole("button", { name: "Save quote" }).click()

    await expect(dialog.getByRole("alert")).toContainText("more than browser sync can hold")
    await expect(dialog.getByLabel("Quotes (one per line)")).toHaveValue(longQuotes)
    await expect(cardByTitle(page, "Stoics")).toHaveCount(0)

    // Trimmed back under the limit, the same draft saves and the dialog closes.
    const trimmed = longQuotes.split("\n").slice(0, 20).join("\n")
    await dialog.getByLabel("Quotes (one per line)").fill(trimmed)
    await dialog.getByRole("button", { name: "Save quote" }).click()

    await expect(dialog).toHaveCount(0)
    await expect(cardByTitle(page, "Stoics")).toBeVisible()
    await expect(page.getByRole("alert")).toHaveCount(0)
  })

  // On a short screen Save stays pinned however far up the form is scrolled, while the reason it was refused is written at the form's end.
  test("brings the reason into view when a pinned Save is refused", async ({
    page,
    extensionId
  }) => {
    // About what a 1366x768 laptop leaves under the browser's own bars.
    await page.setViewportSize({ width: 1366, height: 625 })
    await openNewTab(page, extensionId)
    const dialog = await addLongQuote(page)

    await dialog.evaluate((el) => (el.scrollTop = 0))
    await dialog.getByRole("button", { name: "Save quote" }).click()
    const reason = dialog.getByRole("alert")
    await expect(reason).toContainText("more than browser sync can hold")

    const dialogBox = await boxOf(dialog, "the quote dialog")
    const reasonBox = await boxOf(reason, "the reason the save was refused")
    const actionsBox = await boxOf(
      dialog.locator(".modal-dialog__actions"),
      "the pinned actions row"
    )
    expect(reasonBox.y).toBeGreaterThanOrEqual(dialogBox.y)
    expect(reasonBox.y + reasonBox.height).toBeLessThanOrEqual(actionsBox.y)

    // Scrolled back up and refused again for the same reason, the dialog brings it into view afresh, or the pinned Save would look as if it did nothing.
    // The press lands where the pinned button sits, since a locator click would first scroll the form to its end.
    await dialog.evaluate((el) => (el.scrollTop = 0))
    const save = await boxOf(
      dialog.getByRole("button", { name: "Save quote" }),
      "the pinned Save"
    )
    await page.mouse.click(save.x + save.width / 2, save.y + save.height / 2)
    await expect
      .poll(async () => {
        const box = await reason.boundingBox()

        return box !== null && box.y + box.height <= actionsBox.y
      })
      .toBe(true)
  })

  test("lets a dialog refused from the backdrop go with Escape", async ({
    page,
    extensionId
  }) => {
    await openNewTab(page, extensionId)
    const dialog = await addLongQuote(page)

    // The backdrop saves rather than discards, so a press on it is refused like Save and the dialog stays.
    await page.mouse.click(4, 4)
    await expect(dialog.getByRole("alert")).toContainText("more than browser sync can hold")

    // Focus is still in the dialog, so the keyboard can still let the draft go.
    await page.keyboard.press("Escape")

    await expect(dialog).toHaveCount(0)
    await expect(cardByTitle(page, "Stoics")).toHaveCount(0)
    await expect(page.getByRole("alert")).toHaveCount(0)
  })

  // Words storage refused matter more than an Undo for a card that is safe in the archive either way.
  test("keeps the notice for refused words over an archive's Undo", async ({
    page,
    extensionId
  }) => {
    await page.clock.install()
    await openNewTab(page, extensionId)
    await addWidget(page, "note", "Scratch")

    const field = page.getByLabel("Scratch note")
    await field.fill("x".repeat(20_000))
    await field.blur()
    const notice = page.getByRole("alert")
    await expect(notice).toContainText("more than browser sync can hold")

    await openWidgetMenu(page, "🌅 Morning")
    await page.getByRole("menuitem", { name: "Archive 🌅 Morning" }).click()
    await expect(cardByTitle(page, "🌅 Morning")).toHaveCount(0)

    await expect(notice).toContainText("more than browser sync can hold")
    await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0)

    // The archive's few seconds run out underneath, so the words saving later does not bring back an Undo for an archive long past.
    await page.clock.runFor(7_000)
    await field.fill("Short again")
    await field.blur()

    await expect(notice).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0)
  })
})

test.describe("a board saved too often", () => {
  test.use({ expectsSaveError: true })

  // Refuses the next write the way Chrome's write-rate quota does, then lets writes through again.
  const refuseNextWrite = (page: Page) =>
    page.evaluate(() => {
      const sync = chrome.storage.sync
      const set = sync.set.bind(sync)
      let refusals = 1

      sync.set = ((items: Record<string, unknown>) =>
        refusals-- > 0
          ? Promise.reject(
              new Error("This request exceeds the MAX_WRITE_OPERATIONS_PER_MINUTE quota.")
            )
          : set(items)) as typeof sync.set
    })

  test("archives a note still holding refused words, and saves them with it", async ({
    page,
    extensionId
  }) => {
    await openNewTab(page, extensionId)
    await addWidget(page, "note", "Scratch")
    await refuseNextWrite(page)

    const field = page.getByLabel("Scratch note")
    await field.fill("Typed while saving too often")
    await field.blur()
    await expect(page.getByRole("alert")).toContainText("too many changes in a row")

    // The note's field takes a right-click for its copy/paste menu, so its card menu comes from the keyboard.
    await cardByTitle(page, "Scratch").focus()
    await page.keyboard.press("Shift+F10")
    await page.getByRole("menuitem", { name: "Archive Scratch" }).click()

    // Leaving the board unmounts the card, which offers its words once more from the copy it last rendered, from before the archive.
    await expect(cardByTitle(page, "Scratch")).toHaveCount(0)
    await expect(page.getByRole("alert")).toHaveCount(0)
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const stored = await chrome.storage.sync.get("dayboard-state")
          const { widgets } = stored["dayboard-state"] as DayboardState

          return widgets.find((widget) => widget.title === "Scratch")
        })
      )
      .toMatchObject({ archived: true, settings: { text: "Typed while saving too often" } })
    await expect(cardByTitle(page, "Scratch")).toHaveCount(0)
  })

  // A refusal is only news until something saves, and an archive that saves is news of its own.
  test("offers an archive's Undo once its save clears a refusal", async ({
    page,
    extensionId
  }) => {
    await openNewTab(page, extensionId)
    await refuseNextWrite(page)

    await page.getByRole("button", { name: "Mark today" }).click()
    const notice = page.getByRole("alert")
    await expect(notice).toContainText("too many changes in a row")

    await openWidgetMenu(page, "🌅 Morning")
    await page.getByRole("menuitem", { name: "Archive 🌅 Morning" }).click()

    await expect(notice).toHaveCount(0)
    await page.getByRole("status").getByRole("button", { name: "Undo" }).click()
    await expect(page.locator(".board-list").first().locator("h2")).toHaveText([
      ...DEFAULT_BOARD_TITLES
    ])
  })
})

test("an edit dialog left open keeps what changed on the card meanwhile", async ({
  context,
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)
  await addWidget(page, "note", "Ideas")

  // A plain goto rather than openNewTab, which clears storage and would take the note with it.
  const other = await context.newPage()
  await other.goto(`chrome-extension://${extensionId}/newtab.html`)

  // The note's own field takes a right-click for its copy/paste menu, so its card menu comes from the keyboard.
  await cardByTitle(page, "Ideas").focus()
  await page.keyboard.press("Shift+F10")
  await page.getByRole("menuitem", { name: "Edit Ideas" }).click()

  await other.getByLabel("Ideas note").fill("Eggs, milk, bread")
  await other.getByLabel("Ideas note").blur()
  await expect
    .poll(() => readWidgetSettings(page, "Ideas"))
    .toEqual({ text: "Eggs, milk, bread" })

  await page.getByRole("dialog").getByLabel("Name").fill("Groceries")
  await page.getByRole("button", { name: "Save changes" }).click()

  // The rename lands on the note as it is now, rather than putting back the empty one the dialog opened on.
  await expect
    .poll(() => readWidgetSettings(page, "Groceries"))
    .toEqual({ text: "Eggs, milk, bread" })
  await expect(other.getByLabel("Groceries note")).toHaveValue("Eggs, milk, bread")

  await other.close()
})

test("a save that lands late leaves a dialog opened since alone", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)
  await addWidget(page, "note", "Ideas")

  // Hold the next write the way a slow sync does, until the test lets it land.
  await page.evaluate(() => {
    const sync = chrome.storage.sync
    const set = sync.set.bind(sync)
    const held = window as typeof window & { landWrite?: () => Promise<void> }

    sync.set = ((items: Record<string, unknown>) => {
      sync.set = set

      return new Promise<void>((resolve) => {
        held.landWrite = async () => {
          await set(items)
          resolve()
          // A moment for the page to act on the write before the test looks.
          await new Promise((settle) => setTimeout(settle, 100))
        }
      })
    }) as typeof sync.set
  })

  // The note's own field takes a right-click for its copy/paste menu, so its card menu comes from the keyboard.
  await cardByTitle(page, "Ideas").focus()
  await page.keyboard.press("Shift+F10")
  await page.getByRole("menuitem", { name: "Edit Ideas" }).click()
  await page.getByRole("dialog").getByLabel("Name").fill("Groceries")
  await page.getByRole("button", { name: "Save changes" }).click()

  // Let that dialog go while its write is still out, then open the card's dialog again.
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await cardByTitle(page, "Groceries").focus()
  await page.keyboard.press("Shift+F10")
  await page.getByRole("menuitem", { name: "Edit Groceries" }).click()

  // The first dialog's write landing is no reason to close the second.
  await page.evaluate(() =>
    (window as typeof window & { landWrite: () => Promise<void> }).landWrite()
  )
  await expect
    .poll(() => readWidgetSettings(page, "Groceries"))
    .toEqual({ text: "" })
  await expect(page.getByRole("dialog").getByLabel("Name")).toHaveValue("Groceries")
})

test("a board from a newer Dayboard keeps what this one can't show through a save", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const agenda = {
    id: "agenda",
    kind: "calendar",
    title: "Agenda",
    colorPreset: "sky",
    settings: { calendarId: "work" }
  }
  const walk = {
    id: "walk",
    kind: "habit",
    title: "Walk",
    colorPreset: "amber",
    settings: { history: [], goalPerWeek: 4 }
  }
  await page.evaluate(
    (widgets) =>
      chrome.storage.sync.set({
        "dayboard-state": { widgets, settings: { name: "", theme: "dusk" } }
      }),
    [walk, agenda]
  )
  await page.reload()

  // Only the card this version can draw is on the board.
  await expect(page.locator(".board-row")).toHaveCount(1)

  await page.getByRole("button", { name: "Mark today" }).click()

  await expect
    .poll(() => readWidgetSettings(page, "Walk"))
    .toMatchObject({ history: [expect.any(String)], goalPerWeek: 4 })
  const stored = await page.evaluate(
    async () =>
      (await chrome.storage.sync.get("dayboard-state"))["dayboard-state"] as DayboardState
  )
  expect(stored.widgets[1]).toEqual(agenda)
  expect(stored.settings).toEqual({ name: "", theme: "dusk" })
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
