import { readFileSync } from "node:fs"

import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const openNewTab = async (page: Page, extensionId: string) => {
  await page.goto(`chrome-extension://${extensionId}/newtab.html`)
  await page.evaluate(() => chrome.storage.sync.clear())
  await page.reload()
}

const dragWidget = async (page: Page, sourceTitle: string, targetTitle: string) => {
  const source = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: sourceTitle }) })
  const target = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: targetTitle }) })

  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()

  if (!sourceBox || !targetBox) {
    throw new Error("Unable to locate widget bounds for dragging")
  }

  // Grab the draggable frame (the padded top edge), not the body, which is no
  // longer a drag handle. Move by the center-to-center delta so the card still
  // lands on the target's position regardless of where it was grabbed.
  const grabX = sourceBox.x + sourceBox.width / 2
  const grabY = sourceBox.y + 12
  const deltaX =
    targetBox.x + targetBox.width / 2 - (sourceBox.x + sourceBox.width / 2)
  const deltaY =
    targetBox.y + targetBox.height / 2 - (sourceBox.y + sourceBox.height / 2)

  await page.mouse.move(grabX, grabY)
  await page.mouse.down()
  await page.mouse.move(grabX + deltaX, grabY + deltaY, { steps: 20 })
  await page.mouse.up()
}

const openWidgetMenu = async (page: Page, title: string) => {
  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: title }) })

  await card.click({ button: "right" })
}

test("new tab page renders the default widgets and editing controls", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute(
    "href",
    /icon32\.png$/
  )
  await expect(page.getByRole("heading", { name: "Dayboard" })).toBeVisible()
  await expect(page.getByText("Local time")).toBeVisible()
  await expect(page.getByText("Tomorrow morning")).toBeVisible()
  await expect(page.getByRole("button", { name: "Add widget" })).toBeVisible()
  await expect(page.getByLabel("Actions for Local time")).toHaveCount(0)

  await page.getByRole("button", { name: "Add widget" }).click()
  await expect(page.getByRole("button", { name: "Add clock" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Add countdown" })).toBeVisible()

  await openWidgetMenu(page, "Tomorrow morning")
  await expect(
    page.getByRole("menuitem", { name: "Move Tomorrow morning up" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Reorder Tomorrow morning" })
  ).toHaveCount(0)

  const titles = page.locator(".board-row h2")
  await expect(titles).toHaveText(["Local time", "Tomorrow morning"])
})

test("anchors the board to the bottom so the omnibox does not cover it", async ({
  page,
  extensionId
}) => {
  // A tall viewport keeps the short default board well within one screen.
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openNewTab(page, extensionId)

  const viewport = page.viewportSize()
  const header = await page.locator(".page-header").boundingBox()
  const board = await page.locator(".board-list").boundingBox()

  if (!viewport || !header || !board) {
    throw new Error("Unable to measure board layout")
  }

  const spaceAbove = header.y
  const spaceBelow = viewport.height - (board.y + board.height)

  // The content is weighted toward the bottom: more empty room sits above the
  // header (where the omnibox suggestions drop down) than below the board.
  expect(spaceAbove).toBeGreaterThan(spaceBelow)
  // And the board still ends a comfortable distance from the very bottom edge.
  expect(spaceBelow).toBeGreaterThan(0)
})

test("shows a time-aware greeting that can be personalized", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const greeting = page.locator(".page-header__greeting")
  await expect(greeting).toHaveText(/Good (morning|afternoon|evening|night)/)

  // Setting a name in Options personalizes and persists the greeting.
  await page.getByRole("button", { name: "Options" }).click()
  await page.getByLabel("Your name").fill("Sam")
  await page.getByRole("button", { name: "Done" }).click()
  await expect(greeting).toHaveText(/, Sam$/)

  await page.reload()
  await expect(page.locator(".page-header__greeting")).toHaveText(/, Sam$/)
})

test("exports the board to a file and imports one back", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)
  await page.getByRole("button", { name: "Options" }).click()

  // Export downloads the current board as JSON.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export" }).click()
  ])
  expect(download.suggestedFilename()).toBe("dayboard.json")
  const path = await download.path()
  expect(readFileSync(path, "utf8")).toContain("Local time")

  // Importing a different board replaces what is on screen.
  const board = {
    widgets: [
      {
        id: "imp",
        kind: "clock",
        title: "Imported City",
        colorPreset: "slate",
        settings: { timeZone: "UTC" }
      }
    ],
    settings: { dragToMove: true, columns: "auto", name: "", chimeOnTimerEnd: false }
  }
  await page.locator('input[type="file"]').setInputFiles({
    name: "board.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(board))
  })

  await expect(
    page.getByRole("heading", { name: "Imported City" })
  ).toBeVisible()
  await expect(page.getByText("Local time")).toHaveCount(0)
  await expect(page.getByRole("dialog", { name: "Options" })).toHaveCount(0)
})

test("a bad import shows an error and leaves the board intact", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)
  await page.getByRole("button", { name: "Options" }).click()

  // A valid-JSON file that is not a board should be rejected with a message.
  await page.locator('input[type="file"]').setInputFiles({
    name: "notaboard.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ nope: true }))
  })

  await expect(
    page.getByText("That file is not a Dayboard board.")
  ).toBeVisible()
  // The dialog stays open and the existing board is untouched.
  await expect(page.getByRole("dialog", { name: "Options" })).toBeVisible()
  await expect(page.getByText("Local time")).toBeVisible()
})

test("global options toggle drag and columns and persist across reloads", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  // Drag handles exist by default and the grid is responsive (no fixed columns).
  await expect(page.locator(".board-row__frame")).toHaveCount(2)
  await expect(page.locator(".board-list")).not.toHaveAttribute("data-columns")

  await page.getByRole("button", { name: "Options" }).click()
  await expect(page.getByRole("dialog", { name: "Options" })).toBeVisible()

  // Turning off drag-to-move removes the draggable frames from every card.
  await page.getByRole("switch", { name: "Drag to rearrange" }).click()
  await expect(page.locator(".board-row__frame")).toHaveCount(0)

  // Choosing a fixed column count drives the grid.
  await page.getByLabel("Columns").selectOption("2")
  await expect(page.locator(".board-list")).toHaveAttribute("data-columns", "2")

  await page.getByRole("button", { name: "Done" }).click()
  await expect(page.getByRole("dialog", { name: "Options" })).toHaveCount(0)

  // Settings persist across a reload...
  await page.reload()
  await expect(page.locator(".board-row__frame")).toHaveCount(0)
  await expect(page.locator(".board-list")).toHaveAttribute("data-columns", "2")

  // ...and the overlay reflects the saved choices when reopened.
  await page.getByRole("button", { name: "Options" }).click()
  await expect(
    page.getByRole("switch", { name: "Drag to rearrange" })
  ).not.toBeChecked()
  await expect(page.getByLabel("Columns")).toHaveValue("2")
})

test("the options dialog moves, traps, and restores focus", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const gear = page.getByRole("button", { name: "Options" })
  await gear.click()
  await expect(page.getByRole("dialog", { name: "Options" })).toBeVisible()

  // Focus moves into the dialog (the first control).
  await expect(page.getByLabel("Your name")).toBeFocused()

  // Tab is trapped: from the last control it wraps to the first.
  await page.getByRole("button", { name: "Done" }).focus()
  await page.keyboard.press("Tab")
  await expect(page.getByLabel("Your name")).toBeFocused()

  // ...and Shift+Tab from the first wraps to the last.
  await page.keyboard.press("Shift+Tab")
  await expect(page.getByRole("button", { name: "Done" })).toBeFocused()

  // Escape closes the dialog and returns focus to the opener.
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Options" })).toHaveCount(0)
  await expect(gear).toBeFocused()
})

test("opening the page as the options view shows the overlay", async ({
  page,
  extensionId
}) => {
  await page.goto(`chrome-extension://${extensionId}/newtab.html?view=settings`)

  await expect(page.getByRole("dialog", { name: "Options" })).toBeVisible()
})

test("widget menu spawns under the cursor and breaks free of the card", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Local time" }) })
  const cardBox = await card.boundingBox()

  if (!cardBox) {
    throw new Error("Unable to locate widget bounds")
  }

  // Right-click near the card's bottom-right corner.
  const cursorX = cardBox.x + cardBox.width - 12
  const cursorY = cardBox.y + cardBox.height - 12
  await page.mouse.move(cursorX, cursorY)
  await page.mouse.down({ button: "right" })
  await page.mouse.up({ button: "right" })

  const menu = page.locator(".card-menu")
  await expect(menu).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: "Edit Local time" })
  ).toBeVisible()

  const menuBox = await menu.boundingBox()

  if (!menuBox) {
    throw new Error("Unable to locate widget menu bounds")
  }

  // The menu opens at the cursor instead of a fixed corner of the card...
  expect(menuBox.x).toBeGreaterThan(cardBox.x + cardBox.width / 2)
  // ...and is allowed to extend past the card's edges rather than being clipped.
  expect(menuBox.x + menuBox.width).toBeGreaterThan(cardBox.x + cardBox.width)
})

test("widget menu stays within the viewport when opened near the screen edge", async ({
  page,
  extensionId
}) => {
  // A narrow viewport keeps the board single-column so a card spans to the right edge.
  await page.setViewportSize({ width: 420, height: 800 })
  await openNewTab(page, extensionId)

  const viewport = page.viewportSize()

  if (!viewport) {
    throw new Error("Unable to determine viewport size")
  }

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Local time" }) })
  const cardBox = await card.boundingBox()

  if (!cardBox) {
    throw new Error("Unable to locate widget bounds")
  }

  // Right-click near the card's right edge, where an unclamped menu would spill off screen.
  const cursorX = cardBox.x + cardBox.width - 6
  const cursorY = cardBox.y + cardBox.height - 6
  await page.mouse.move(cursorX, cursorY)
  await page.mouse.down({ button: "right" })
  await page.mouse.up({ button: "right" })

  const menu = page.locator(".card-menu")
  await expect(menu).toBeVisible()

  // Wait for the scale-up animation to settle so we measure the menu at full size.
  await menu
    .locator(".card-menu__panel")
    .evaluate((panel) =>
      Promise.all(panel.getAnimations().map((animation) => animation.finished))
    )

  const menuBox = await menu.boundingBox()

  if (!menuBox) {
    throw new Error("Unable to locate widget menu bounds")
  }

  // The cursor sat past the right edge minus the menu width, so it must have been clamped back.
  expect(menuBox.x).toBeLessThan(cursorX)
  expect(menuBox.x).toBeGreaterThanOrEqual(0)
  expect(menuBox.y).toBeGreaterThanOrEqual(0)
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width)
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height)
})

test("widget menu supports keyboard navigation", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Tomorrow morning" }) })

  // Open the menu from the keyboard, with no pointer involved.
  await card.focus()
  await card.press("ContextMenu")

  const menu = page.locator(".card-menu")
  await expect(menu).toBeVisible()

  // Focus lands on the first enabled item, and arrow keys move between items.
  await expect(
    page.getByRole("menuitem", { name: "Move Tomorrow morning up" })
  ).toBeFocused()

  await page.keyboard.press("ArrowDown")
  await expect(
    page.getByRole("menuitem", { name: "Edit Tomorrow morning" })
  ).toBeFocused()

  await page.keyboard.press("End")
  await expect(
    page.getByRole("menuitem", { name: "Delete Tomorrow morning" })
  ).toBeFocused()

  await page.keyboard.press("ArrowDown")
  await expect(
    page.getByRole("menuitem", { name: "Move Tomorrow morning up" })
  ).toBeFocused() // wraps back to the first item

  // Escape closes the menu and returns focus to the card that opened it.
  await page.keyboard.press("Escape")
  await expect(menu).toHaveCount(0)
  await expect(card).toBeFocused()
})

test("widget menu closes on resize and returns focus to its card", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Tomorrow morning" }) })

  await card.focus()
  await card.press("ContextMenu")

  const menu = page.locator(".card-menu")
  await expect(menu).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: "Move Tomorrow morning up" })
  ).toBeFocused()

  // The menu is pinned to the cursor, so a resize closes it...
  await page.setViewportSize({ width: 900, height: 700 })
  await expect(menu).toHaveCount(0)
  // ...and focus returns to the card rather than being dropped to the body.
  await expect(card).toBeFocused()
})

test("reordering changes the visible order and persists after reload", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const titles = page.locator(".board-row h2")
  await expect(titles).toHaveText(["Local time", "Tomorrow morning"])
  await dragWidget(page, "Tomorrow morning", "Local time")

  await expect(titles).toHaveText(["Tomorrow morning", "Local time"])

  await page.reload()

  await expect(titles).toHaveText(["Tomorrow morning", "Local time"])
})

test("dragging across a widget body selects text instead of reordering", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const titles = page.locator(".board-row h2")
  await expect(titles).toHaveText(["Local time", "Tomorrow morning"])

  const heading = page.getByRole("heading", { name: "Local time" })
  const box = await heading.boundingBox()

  if (!box) {
    throw new Error("Unable to locate widget heading bounds")
  }

  await page.mouse.move(box.x + 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, {
    steps: 12
  })
  await page.mouse.up()

  // The body is not a drag handle, so the order does not change...
  await expect(titles).toHaveText(["Local time", "Tomorrow morning"])

  // ...and dragging over the text selects it instead.
  const selection = await page.evaluate(
    () => window.getSelection()?.toString() ?? ""
  )
  expect(selection.length).toBeGreaterThan(0)
})

test("only the draggable frame lights the card up on hover", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const card = page.locator(".board-row--draggable").first()
  const box = await card.boundingBox()

  if (!box) {
    throw new Error("Unable to locate widget bounds")
  }

  const readStyle = () =>
    card.evaluate((el) => {
      const style = getComputedStyle(el)
      return `${style.borderColor}|${style.boxShadow}`
    })

  // Hovering the body (the heading text) leaves the card calm.
  const heading = page.getByRole("heading", { name: "Local time" })
  await heading.hover()
  const calm = await readStyle()

  // Hovering the frame (the padded top edge) lights the card up. Poll so the
  // border/shadow transition settles, but never pin an exact color-mix value.
  await page.mouse.move(box.x + box.width / 2, box.y + 8)
  await expect.poll(() => readStyle()).not.toBe(calm)

  // Returning to the body calms it back down, proving the lit state tracks the
  // frame rather than the whole card.
  await heading.hover()
  await expect.poll(() => readStyle()).toBe(calm)
})

test("dropdowns close when clicking outside them", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await expect(page.getByRole("button", { name: "Add clock" })).toBeVisible()
  await page.getByRole("heading", { name: "Dayboard" }).click()
  await expect(page.getByRole("button", { name: "Add clock" })).not.toBeVisible()

  await openWidgetMenu(page, "Tomorrow morning")
  await expect(
    page.getByRole("menuitem", { name: "Move Tomorrow morning up" })
  ).toBeVisible()
  await page.getByRole("heading", { name: "Dayboard" }).click()
  await expect(
    page.getByRole("menuitem", { name: "Move Tomorrow morning up" })
  ).not.toBeVisible()
})

test("the add menu closes on Escape and returns focus to its button", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const trigger = page.getByRole("button", { name: "Add widget" })
  await trigger.click()
  await expect(page.getByRole("button", { name: "Add clock" })).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "Add clock" })).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

test("add clock flow works from the new tab page", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add clock" }).click()
  await expect(page.getByRole("dialog", { name: "Add clock" })).toBeVisible()
  await page.getByLabel("Name").fill("Paris")
  await page.getByLabel("Time zone").fill("Europe/Paris")
  await page.getByRole("button", { name: "Save clock" }).click()

  await expect(page.getByRole("heading", { name: "Paris" })).toBeVisible()
})

test("multiple open tabs stay synchronized", async ({
  context,
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const secondPage = await context.newPage()
  const thirdPage = await context.newPage()

  await secondPage.goto(`chrome-extension://${extensionId}/newtab.html`)
  await thirdPage.goto(`chrome-extension://${extensionId}/newtab.html`)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add clock" }).click()
  await page.getByLabel("Name").fill("Paris")
  await page.getByLabel("Time zone").fill("Europe/Paris")
  await page.getByRole("button", { name: "Save clock" }).click()

  await expect(secondPage.getByRole("heading", { name: "Paris" })).toBeVisible()
  await expect(thirdPage.getByRole("heading", { name: "Paris" })).toBeVisible()

  await openWidgetMenu(secondPage, "Paris")
  await secondPage.getByRole("menuitem", { name: "Edit Paris" }).click()
  await secondPage.getByLabel("Name").fill("Tokyo")
  await secondPage.getByLabel("Time zone").fill("Asia/Tokyo")
  await secondPage.getByRole("button", { name: "Save changes" }).click()

  await expect(page.getByRole("heading", { name: "Tokyo" })).toBeVisible()
  await expect(thirdPage.getByRole("heading", { name: "Tokyo" })).toBeVisible()

  await openWidgetMenu(thirdPage, "Tokyo")
  await thirdPage.getByRole("menuitem", { name: "Delete Tokyo" }).click()
  await thirdPage.getByRole("button", { name: "Delete widget" }).click()

  await expect(page.getByRole("heading", { name: "Tokyo" })).toHaveCount(0)
  await expect(secondPage.getByRole("heading", { name: "Tokyo" })).toHaveCount(0)

  await secondPage.close()
  await thirdPage.close()
})

test("add note flow saves typed text and persists across reloads", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add note" }).click()
  await expect(page.getByRole("dialog", { name: "Add note" })).toBeVisible()
  await expect(page.getByLabel("Time zone")).toHaveCount(0)
  await page.getByLabel("Name").fill("Reminders")
  await page.getByRole("button", { name: "Save note" }).click()

  await expect(page.getByRole("heading", { name: "Reminders" })).toBeVisible()

  const field = page.getByLabel("Reminders note")
  await field.fill("Buy milk")
  // Blurring flushes the debounced auto-save.
  await page.getByRole("heading", { name: "Dayboard" }).click()

  await page.reload()
  await expect(page.getByLabel("Reminders note")).toHaveValue("Buy milk")
})

test("typing in a note does not start a drag or open the widget menu", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add note" }).click()
  await page.getByLabel("Name").fill("Scratch")
  await page.getByRole("button", { name: "Save note" }).click()

  const field = page.getByLabel("Scratch note")
  await field.click()
  // A space must land in the note instead of triggering a keyboard drag.
  await page.keyboard.type("a b c")
  await expect(field).toHaveValue("a b c")
  await expect(page.locator(".card-menu")).toHaveCount(0)
})

test("add quote flow shows a quote and keeps the daily pick across reloads", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add quote" }).click()
  await expect(page.getByRole("dialog", { name: "Add quote" })).toBeVisible()
  await page.getByLabel("Name").fill("Mantras")
  await page.getByLabel("Quotes").fill("Stay curious.\nKeep going.")
  await page.getByLabel("Show a new one").selectOption("daily")
  await page.getByRole("button", { name: "Save quote" }).click()

  await expect(page.getByRole("heading", { name: "Mantras" })).toBeVisible()

  const quote = page.locator(".quote-text")
  const shown = (await quote.textContent())?.trim() ?? ""
  expect(["Stay curious.", "Keep going."]).toContain(shown)

  // Daily rotation is deterministic, so the same quote returns after a reload.
  await page.reload()
  await expect(page.locator(".quote-text")).toHaveText(shown)
})

test("stopwatch counts up, keeps running across a reload, and resets", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add stopwatch" }).click()
  await page.getByLabel("Name").fill("Focus")
  await page.getByRole("button", { name: "Save stopwatch" }).click()

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Focus" }) })
  const value = card.locator(".board-row__value")

  await expect(value).toHaveText("0:00")
  await card.getByRole("button", { name: "Start" }).click()
  await expect.poll(async () => value.textContent()).not.toBe("0:00")

  // The running state is anchored to wall-clock time, so it keeps ticking after
  // a reload.
  await page.reload()
  const reloaded = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Focus" }) })
  await expect(reloaded.getByRole("button", { name: "Pause" })).toBeVisible()
  await expect(reloaded.locator(".board-row__value")).not.toHaveText("0:00")

  await reloaded.getByRole("button", { name: "Pause" }).click()
  await reloaded.getByRole("button", { name: "Reset" }).click()
  await expect(reloaded.locator(".board-row__value")).toHaveText("0:00")
})

test("timer counts down to a finished state and resets", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add timer" }).click()
  await page.getByLabel("Name").fill("Steep")
  await page.getByLabel("minutes").fill("0")
  await page.getByLabel("seconds").fill("1")
  await page.getByRole("button", { name: "Save timer" }).click()

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Steep" }) })

  await expect(card.locator(".board-row__value")).toHaveText("0:01")

  await card.getByRole("button", { name: "Start" }).click()
  await expect(card.getByText("Time’s up")).toBeVisible()
  await expect(card.locator(".board-row__value")).toHaveText("0:00")

  await card.getByRole("button", { name: "Reset" }).click()
  await expect(card.locator(".board-row__value")).toHaveText("0:01")
})

test("timer chime setting persists and the timer still finishes", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Options" }).click()
  await page.getByRole("switch", { name: "Timer chime" }).click()
  await page.getByRole("button", { name: "Done" }).click()

  // A short timer still reaches the finished state with the chime enabled.
  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add timer" }).click()
  await page.getByLabel("Name").fill("Steep")
  await page.getByLabel("minutes").fill("0")
  await page.getByLabel("seconds").fill("1")
  await page.getByRole("button", { name: "Save timer" }).click()

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Steep" }) })
  await card.getByRole("button", { name: "Start" }).click()
  await expect(card.getByText("Time’s up")).toBeVisible()

  // The preference persists across a reload.
  await page.reload()
  await page.getByRole("button", { name: "Options" }).click()
  await expect(page.getByRole("switch", { name: "Timer chime" })).toBeChecked()
})

test("add habit flow tracks a streak and persists", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add habit" }).click()
  await page.getByLabel("Name").fill("Read")
  await page.getByRole("button", { name: "Save habit" }).click()

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Read" }) })

  await expect(card.getByLabel("0 day streak")).toBeVisible()
  await card.getByRole("button", { name: "Mark today" }).click()
  await expect(card.getByLabel("1 day streak")).toBeVisible()
  await expect(card.getByRole("button", { name: "Done today ✓" })).toBeVisible()

  // The streak persists across a reload.
  await page.reload()
  const reloaded = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Read" }) })
  await expect(reloaded.getByLabel("1 day streak")).toBeVisible()
})

test("add and edit countdown works without a time-zone field", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add countdown" }).click()
  await expect(page.getByRole("dialog", { name: "Add countdown" })).toBeVisible()
  await expect(page.getByLabel("Time zone")).toHaveCount(0)
  await page.getByLabel("Name").fill("Launch")
  await page.getByLabel("When").fill("2026-01-02T09:00")
  await page.getByRole("button", { name: "Save countdown" }).click()

  await expect(page.getByRole("heading", { name: "Launch" })).toBeVisible()
  await openWidgetMenu(page, "Launch")
  await page.getByRole("menuitem", { name: "Edit Launch" }).click()
  await expect(page.getByRole("dialog", { name: "Edit countdown" })).toBeVisible()
  await expect(page.getByLabel("Time zone")).toHaveCount(0)
  await page.getByLabel("Name").fill("Launch day")
  await page.getByRole("button", { name: "Save changes" }).click()

  await expect(page.getByRole("heading", { name: "Launch day" })).toBeVisible()
})

test("a widget can be made wide to span two columns", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await openWidgetMenu(page, "Tomorrow morning")
  await page.getByRole("menuitem", { name: "Edit Tomorrow morning" }).click()
  await page.getByLabel("Size").selectOption("wide")
  await page.getByRole("button", { name: "Save changes" }).click()

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Tomorrow morning" }) })

  await expect(card).toHaveClass(/board-row--wide/)
  expect(
    await card.evaluate((el) => getComputedStyle(el).gridColumn)
  ).toContain("span 2")

  // The size persists across a reload.
  await page.reload()
  await expect(
    page
      .locator(".board-row")
      .filter({ has: page.getByRole("heading", { name: "Tomorrow morning" }) })
  ).toHaveClass(/board-row--wide/)
})

test("a countdown can be shown as a progress bar", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add countdown" }).click()
  await page.getByLabel("Name").fill("Project")
  await page.getByLabel("When").fill("2026-12-31T00:00")
  await page.getByLabel("Display").selectOption("progress")
  await page.getByLabel("Starting from").fill("2026-01-01T00:00")
  await page.getByRole("button", { name: "Save countdown" }).click()

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Project" }) })

  await expect(
    card.getByRole("progressbar", { name: "Project progress" })
  ).toBeVisible()
  await expect(card.locator(".board-row__value")).toContainText("%")

  // The progress display persists across a reload.
  await page.reload()
  await expect(
    page
      .locator(".board-row")
      .filter({ has: page.getByRole("heading", { name: "Project" }) })
      .getByRole("progressbar")
  ).toBeVisible()
})

test("a recurring countdown rolls forward to its next occurrence", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add countdown" }).click()
  await page.getByLabel("Name").fill("Standup")
  // A target well in the past; weekly repeat should surface a future occurrence.
  await page.getByLabel("When").fill("2020-01-06T09:00")
  await page.getByLabel("Repeats").selectOption("weekly")
  await page.getByRole("button", { name: "Save countdown" }).click()

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Standup" }) })

  // It reads as upcoming (not "ago") and notes the cadence.
  await expect(card.getByText("from now")).toBeVisible()
  await expect(card.locator(".board-row__detail")).toContainText(
    "repeats weekly"
  )
})

test("editing a recurring countdown's time keeps its other settings", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add countdown" }).click()
  await page.getByLabel("Name").fill("Standup")
  await page.getByLabel("When").fill("2020-01-06T09:00")
  await page.getByLabel("Repeats").selectOption("weekly")
  await page.getByRole("button", { name: "Save countdown" }).click()

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Standup" }) })
  await expect(card.locator(".board-row__detail")).toContainText("repeats weekly")

  // Changing only the time must not wipe the repeat setting.
  await openWidgetMenu(page, "Standup")
  await page.getByRole("menuitem", { name: "Edit Standup" }).click()
  await page.getByLabel("When").fill("2020-01-07T08:30")
  await page.getByRole("button", { name: "Save changes" }).click()

  await expect(
    page
      .locator(".board-row")
      .filter({ has: page.getByRole("heading", { name: "Standup" }) })
      .locator(".board-row__detail")
  ).toContainText("repeats weekly")
})

test("edit dialog opens for an existing clock", async ({ page, extensionId }) => {
  await openNewTab(page, extensionId)

  await openWidgetMenu(page, "Local time")
  await page.getByRole("menuitem", { name: "Edit Local time" }).click()
  await expect(page.getByRole("dialog", { name: "Edit clock" })).toBeVisible()
  await expect(page.getByLabel("Name")).toHaveValue("Local time")
  await expect(page.getByLabel("Time zone")).toBeVisible()
})

test("delete flow removes an existing widget", async ({ page, extensionId }) => {
  await openNewTab(page, extensionId)

  await openWidgetMenu(page, "Tomorrow morning")
  await page.getByRole("menuitem", { name: "Delete Tomorrow morning" }).click()
  await expect(
    page.getByRole("dialog", { name: "Delete countdown?" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Delete widget" }).click()

  await expect(page.getByText("Tomorrow morning")).toHaveCount(0)
})

test("archiving from the menu hides a widget and it can be restored", async ({
  page,
  extensionId
}) => {
  // A roomy viewport keeps the expanded archive on one screen so revealing it
  // never has to scroll (scrolling intentionally dismisses an open widget menu).
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openNewTab(page, extensionId)

  // Archive from the keyboard-accessible context menu.
  await openWidgetMenu(page, "Tomorrow morning")
  await page
    .getByRole("menuitem", { name: "Archive Tomorrow morning" })
    .click()

  // It leaves the board and the archived section stays collapsed by default.
  await expect(
    page.locator(".board-list").first().getByText("Tomorrow morning")
  ).toHaveCount(0)
  const toggle = page.getByRole("button", { name: "Show archived (1)" })
  await expect(toggle).toBeVisible()

  // Reveal it, then restore it back to the board.
  await toggle.click()
  await expect(page.getByText("Tomorrow morning")).toBeVisible()
  await openWidgetMenu(page, "Tomorrow morning")
  await page
    .getByRole("menuitem", { name: "Restore Tomorrow morning" })
    .click()

  await expect(
    page.locator(".board-list").first().getByText("Tomorrow morning")
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Show archived/ })
  ).toHaveCount(0)
})

test("dragging a widget onto the archive zone archives it", async ({
  page,
  extensionId
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openNewTab(page, extensionId)

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Local time" }) })
  const box = await card.boundingBox()
  const viewport = page.viewportSize()

  if (!box || !viewport) {
    throw new Error("Unable to measure layout for archive drag")
  }

  // Grab the draggable frame (top edge) and drag down onto the floating archive
  // zone pinned near the bottom of the viewport.
  const grabX = box.x + box.width / 2
  const grabY = box.y + 12
  await page.mouse.move(grabX, grabY)
  await page.mouse.down()
  await page.mouse.move(grabX, grabY + 24, { steps: 6 })

  const dropzone = page.locator(".archive-dropzone")
  await expect(dropzone).toBeVisible()
  const zoneBox = await dropzone.boundingBox()

  if (!zoneBox) {
    throw new Error("Archive zone has no bounds")
  }

  await page.mouse.move(
    zoneBox.x + zoneBox.width / 2,
    zoneBox.y + zoneBox.height / 2,
    { steps: 20 }
  )
  await expect(page.locator(".archive-dropzone--over")).toBeVisible()
  await page.mouse.up()

  await expect(
    page.locator(".board-list").first().getByText("Local time")
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Show archived (1)" })).toBeVisible()
})

test("dragging an archived widget onto the restore zone brings it back", async ({
  page,
  extensionId
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openNewTab(page, extensionId)

  // Archive then reveal the archived section.
  await openWidgetMenu(page, "Tomorrow morning")
  await page.getByRole("menuitem", { name: "Archive Tomorrow morning" }).click()
  await page.getByRole("button", { name: "Show archived (1)" }).click()

  const card = page
    .locator(".board-row")
    .filter({ has: page.getByRole("heading", { name: "Tomorrow morning" }) })
  const box = await card.boundingBox()

  if (!box) {
    throw new Error("Unable to measure archived card")
  }

  // Drag the archived card (by its frame) down onto the floating restore zone.
  await page.mouse.move(box.x + box.width / 2, box.y + 12)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + 36, { steps: 6 })

  const zone = page.locator(".archive-dropzone")
  await expect(zone).toBeVisible()
  const zoneBox = await zone.boundingBox()

  if (!zoneBox) {
    throw new Error("Restore zone has no bounds")
  }

  await page.mouse.move(
    zoneBox.x + zoneBox.width / 2,
    zoneBox.y + zoneBox.height / 2,
    { steps: 20 }
  )
  await expect(page.locator(".archive-dropzone--over")).toBeVisible()
  await page.mouse.up()

  // It is back on the board, and the archived section is gone.
  await expect(
    page.locator(".board-list").first().getByText("Tomorrow morning")
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Show archived/ })
  ).toHaveCount(0)
})

test("edit and delete controls still work after reordering", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await dragWidget(page, "Tomorrow morning", "Local time")

  const titles = page.locator(".board-row h2")
  await expect(titles).toHaveText(["Tomorrow morning", "Local time"])

  await openWidgetMenu(page, "Tomorrow morning")
  await page.getByRole("menuitem", { name: "Edit Tomorrow morning" }).click()
  await expect(
    page.getByRole("dialog", { name: "Edit countdown" })
  ).toBeVisible()
  await page.getByLabel("Name").fill("Morning plans")
  await page.getByRole("button", { name: "Save changes" }).click()

  await expect(page.getByRole("heading", { name: "Morning plans" })).toBeVisible()

  await openWidgetMenu(page, "Morning plans")
  await page.getByRole("menuitem", { name: "Delete Morning plans" }).click()
  await page.getByRole("button", { name: "Delete widget" }).click()

  await expect(page.getByText("Morning plans")).toHaveCount(0)
})
