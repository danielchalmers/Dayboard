import { readFileSync } from "node:fs"

import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"
import {
  addWidget,
  boxOf,
  cardByTitle,
  DEFAULT_BOARD_TITLES,
  openNewTab,
  openWidgetMenu,
  readWidgetSettings
} from "./helpers"

const dragWidget = async (page: Page, sourceTitle: string, targetTitle: string) => {
  const sourceBox = await boxOf(cardByTitle(page, sourceTitle), "the dragged card")
  const targetBox = await boxOf(cardByTitle(page, targetTitle), "the drop target card")

  // Grab the card background near the top edge, clear of the title text (text in front of the frame selects rather than drags).
  // Move by the center-to-center delta so the card still lands on the target's position regardless of where it was grabbed.
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

// The whole delete flow for a card, opened from the keyboard rather than with `openWidgetMenu`.
// A right-click lands in the middle of the card, and for a note that is its textarea and for a habit its dot row — controls that keep their own menu — so clearing a mixed board needs the one route every kind answers.
const deleteWidget = async (page: Page, title: string) => {
  const card = cardByTitle(page, title)

  await card.focus()
  await card.press("ContextMenu")
  await page.getByRole("menuitem", { name: `Delete ${title}` }).click()
  await page.getByRole("button", { name: "Delete widget" }).click()
  await expect(card).toHaveCount(0)
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
  await expect(
    page.getByRole("heading", { name: /Good (morning|afternoon|evening|night)/ })
  ).toBeVisible()
  await expect(page.getByText("🕒 Local time")).toBeVisible()
  await expect(page.getByText("🌅 Tomorrow morning")).toBeVisible()
  await expect(page.getByRole("button", { name: "Add widget" })).toBeVisible()
  await expect(page.getByLabel("Actions for 🕒 Local time")).toHaveCount(0)

  await page.getByRole("button", { name: "Add widget" }).click()
  await expect(page.getByRole("button", { name: "Add clock" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Add countdown" })).toBeVisible()

  await openWidgetMenu(page, "🌅 Tomorrow morning")
  await expect(
    page.getByRole("menuitem", { name: "Move 🌅 Tomorrow morning back" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Reorder 🌅 Tomorrow morning" })
  ).toHaveCount(0)

  const titles = page.locator(".board-row h2")
  await expect(titles).toHaveText(DEFAULT_BOARD_TITLES)

  // The first-run clock pins no zone: it follows the system clock, so it stays right when the device changes zones.
  // (The card's detail line is the observable truth here; a fresh board lives in memory until the first edit writes it to storage.)
  await expect(
    cardByTitle(page, "🕒 Local time").getByText("System time zone")
  ).toBeVisible()
})

test("centers the board in the viewport with no docking option", async ({
  page,
  extensionId
}) => {
  // A tall viewport keeps the short default board well within one screen.
  const viewport = { width: 1280, height: 1000 }
  await page.setViewportSize(viewport)
  await openNewTab(page, extensionId)

  // The board floats in the middle: clear of the omnibox suggestions that drop over the top of a new tab, without hugging the bottom.
  // There is no setting for this; it just works.
  const header = await boxOf(page.locator(".page-header"), "the page header")
  const board = await boxOf(page.locator(".board-list"), "the board")

  const above = header.y
  const below = viewport.height - (board.y + board.height)

  expect(above).toBeGreaterThan(0)
  expect(below).toBeGreaterThan(0)
  // The auto margins split the free space evenly (padding skews it slightly).
  expect(Math.abs(above - below)).toBeLessThan(60)
})

test("keeps the board from shifting when a scrollbar appears", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  // A tall viewport: the short default board fits with no vertical scrollbar.
  await page.setViewportSize({ width: 1000, height: 1600 })
  const roomy = await boxOf(page.locator(".page"), "the page at a tall viewport")

  // A short viewport: the same board now overflows and a scrollbar appears.
  await page.setViewportSize({ width: 1000, height: 400 })
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollHeight >
      document.documentElement.clientHeight
  )
  expect(overflows).toBe(true)
  const scrolled = await boxOf(page.locator(".page"), "the page once it scrolls")

  // The reserved gutter keeps the page the same width and in the same place, so the board doesn't jump sideways when the scrollbar shows up.
  expect(scrolled.width).toBeCloseTo(roomy.width, 0)
  expect(scrolled.x).toBeCloseTo(roomy.x, 0)
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
  expect(readFileSync(path, "utf8")).toContain("🕒 Local time")

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
    settings: { name: "" }
  }
  await page.locator('input[type="file"]').setInputFiles({
    name: "board.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(board))
  })

  await expect(
    page.getByRole("heading", { name: "Imported City" })
  ).toBeVisible()
  await expect(page.getByText("🕒 Local time")).toHaveCount(0)
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
  await expect(page.getByText("🕒 Local time")).toBeVisible()
})

test("the board just works: drag handles on, responsive grid, knob-free options", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  // Every card is draggable and the grid is responsive, with no way (and no need) to configure either.
  await expect(page.locator(".board-row__frame")).toHaveCount(6)
  await expect(page.locator(".board-list")).not.toHaveAttribute("data-columns")

  await page.getByRole("button", { name: "Options" }).click()
  await expect(page.getByRole("dialog", { name: "Options" })).toBeVisible()

  const dialog = page.getByRole("dialog", { name: "Options" })
  await expect(dialog.getByRole("switch")).toHaveCount(0)
  await expect(dialog.getByRole("combobox")).toHaveCount(0)

  await page.getByRole("button", { name: "Done" }).click()
  await expect(page.getByRole("dialog", { name: "Options" })).toHaveCount(0)
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

  const card = cardByTitle(page, "🕒 Local time")
  const cardBox = await boxOf(card, "the widget card")

  // Right-click near the card's bottom-right corner.
  const cursorX = cardBox.x + cardBox.width - 12
  const cursorY = cardBox.y + cardBox.height - 12
  await page.mouse.move(cursorX, cursorY)
  await page.mouse.down({ button: "right" })
  await page.mouse.up({ button: "right" })

  const menu = page.locator(".card-menu")
  await expect(menu).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: "Edit 🕒 Local time" })
  ).toBeVisible()

  const menuBox = await boxOf(menu, "the widget menu")

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
  const viewport = { width: 420, height: 800 }
  await page.setViewportSize(viewport)
  await openNewTab(page, extensionId)

  const card = cardByTitle(page, "🕒 Local time")
  const cardBox = await boxOf(card, "the widget card")

  // Right-click near the card's right edge (at mid-height, clear of the rounded corners), where an unclamped menu would spill off screen.
  const cursorX = cardBox.x + cardBox.width - 6
  const cursorY = cardBox.y + cardBox.height / 2
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

  const menuBox = await boxOf(menu, "the widget menu")

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

  const card = cardByTitle(page, "🌅 Tomorrow morning")

  // Open the menu from the keyboard, with no pointer involved.
  await card.focus()
  await card.press("ContextMenu")

  const menu = page.locator(".card-menu")
  await expect(menu).toBeVisible()

  // Focus lands on the first enabled item, and arrow keys move between items.
  // "🌅 Tomorrow morning" sits among other widgets, so both Move back and Move next are enabled and arrow keys step through every item in turn.
  await expect(
    page.getByRole("menuitem", { name: "Move 🌅 Tomorrow morning back" })
  ).toBeFocused()

  await page.keyboard.press("ArrowDown")
  await expect(
    page.getByRole("menuitem", { name: "Move 🌅 Tomorrow morning next" })
  ).toBeFocused()

  await page.keyboard.press("ArrowDown")
  await expect(
    page.getByRole("menuitem", { name: "Edit 🌅 Tomorrow morning" })
  ).toBeFocused()

  await page.keyboard.press("End")
  await expect(
    page.getByRole("menuitem", { name: "Delete 🌅 Tomorrow morning" })
  ).toBeFocused()

  await page.keyboard.press("ArrowDown")
  await expect(
    page.getByRole("menuitem", { name: "Move 🌅 Tomorrow morning back" })
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

  const card = cardByTitle(page, "🌅 Tomorrow morning")

  await card.focus()
  await card.press("ContextMenu")

  const menu = page.locator(".card-menu")
  await expect(menu).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: "Move 🌅 Tomorrow morning back" })
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
  const [clock, tomorrow, ...rest] = DEFAULT_BOARD_TITLES
  const swappedOrder = [tomorrow, clock, ...rest]

  await expect(titles).toHaveText(DEFAULT_BOARD_TITLES)
  await dragWidget(page, "🌅 Tomorrow morning", "🕒 Local time")

  await expect(titles).toHaveText(swappedOrder)

  await page.reload()

  await expect(titles).toHaveText(swappedOrder)
})

test("the menu's Move back reorders even after a widget was archived", async ({
  page,
  extensionId
}) => {
  // A tall viewport keeps the appended widget and its context menu on screen.
  await page.setViewportSize({ width: 1280, height: 1600 })
  await openNewTab(page, extensionId)

  // Archive one widget, then add a new one.
  // The new widget lands after the archived one in storage, so the active widgets are no longer contiguous, the case where Move back/next used to silently do nothing.
  await openWidgetMenu(page, "📅 This year")
  await page.getByRole("menuitem", { name: "Archive 📅 This year" }).click()

  await addWidget(page, "clock", "New clock")

  const titles = page.locator(".board-list").first().locator("h2")
  // "📅 This year" is archived, so the board is the first five defaults with the new card taking its place.
  await expect(titles).toHaveText([...DEFAULT_BOARD_TITLES.slice(0, 5), "New clock"])

  // Moving the freshly added widget up steps above its visible neighbor instead of no-opping against the hidden archived widget beside it in storage.
  await openWidgetMenu(page, "New clock")
  await page.getByRole("menuitem", { name: "Move New clock back" }).click()

  await expect(titles).toHaveText([
    "🕒 Local time",
    "🌅 Tomorrow morning",
    "👋 Welcome",
    "💬 Today's reminder",
    "New clock",
    "🚶 Daily walk"
  ])
})

test("right-clicking selected text gets the browser's menu, not the card's", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const quote = page.locator(".quote-text")
  const box = await boxOf(quote, "the quote")

  // Triple-click is the ordinary way to select a line, and it is the case that matters: the range Chrome builds runs past the end of the block, so the card has to notice a selection that overlaps it rather than one contained by it.
  await quote.click({ clickCount: 3 })
  await page.mouse.click(box.x + 40, box.y + 12, { button: "right" })
  await expect(page.locator(".card-menu__panel")).toHaveCount(0)

  // With nothing selected, the card's own menu is back.
  await page.mouse.click(box.x + 40, box.y + box.height + 4)
  await page.mouse.click(box.x + 40, box.y + 12, { button: "right" })
  await expect(page.locator(".card-menu__panel")).toHaveCount(1)
})

test("dragging across a widget body selects text instead of reordering", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const titles = page.locator(".board-row h2")
  await expect(titles).toHaveText(DEFAULT_BOARD_TITLES)

  const heading = page.getByRole("heading", { name: "🕒 Local time" })
  const box = await boxOf(heading, "the widget heading")

  // Start the drag a little in from the edge so the press lands squarely on the title text (which is selectable) rather than the card's padded draggable edge, then drag across the rest of the title.
  await page.mouse.move(box.x + 24, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, {
    steps: 12
  })
  await page.mouse.up()

  // The body is not a drag handle, so the order does not change...
  await expect(titles).toHaveText(DEFAULT_BOARD_TITLES)

  // ...and dragging over the text selects it instead.
  const selection = await page.evaluate(
    () => window.getSelection()?.toString() ?? ""
  )
  expect(selection.length).toBeGreaterThan(0)
})

test("the empty middle of a card is a drag handle too", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const titles = page.locator(".board-row h2")
  await expect(titles).toHaveText(DEFAULT_BOARD_TITLES)

  const card = cardByTitle(page, "🕒 Local time")
  const cardBox = await boxOf(card, "the card")
  const headerBox = await boxOf(card.locator(".board-row__header"), "the card header")

  // A point in the empty gap between the header and the body: card background, so pressing and moving here grabs the card, not just the padded edge.
  const x = cardBox.x + cardBox.width / 2
  const y = headerBox.y + headerBox.height + 12

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 24, { steps: 6 })

  // The card entered the dragging state from its background.
  await expect(page.locator(".board-row--dragging")).toHaveCount(1)

  // Released over its own slot, so nothing reorders.
  await page.mouse.up()
  await expect(page.locator(".board-row--dragging")).toHaveCount(0)
  await expect(titles).toHaveText(DEFAULT_BOARD_TITLES)
})

test("only the draggable frame lights the card up on hover", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const card = page.locator(".board-row--draggable").first()
  const box = await boxOf(card, "the widget card")

  const readStyle = () =>
    card.evaluate((el) => {
      const style = getComputedStyle(el)
      return `${style.borderColor}|${style.boxShadow}`
    })

  // Hovering the body (the heading text) leaves the card calm.
  const heading = page.getByRole("heading", { name: "🕒 Local time" })
  await heading.hover()
  const calm = await readStyle()

  // Hovering the frame (the padded top edge) lights the card up.
  // Poll so the border/shadow transition settles, but never pin an exact color-mix value.
  await page.mouse.move(box.x + box.width / 2, box.y + 8)
  await expect.poll(() => readStyle()).not.toBe(calm)

  // Returning to the body calms it back down, proving the lit state tracks the frame rather than the whole card.
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
  await page
    .getByRole("heading", { name: /Good (morning|afternoon|evening|night)/ })
    .click()
  await expect(page.getByRole("button", { name: "Add clock" })).not.toBeVisible()

  await openWidgetMenu(page, "🌅 Tomorrow morning")
  await expect(
    page.getByRole("menuitem", { name: "Move 🌅 Tomorrow morning back" })
  ).toBeVisible()
  await page
    .getByRole("heading", { name: /Good (morning|afternoon|evening|night)/ })
    .click()
  await expect(
    page.getByRole("menuitem", { name: "Move 🌅 Tomorrow morning back" })
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

test("clicking the time zone box offers every zone, not just matches", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add clock" }).click()

  const field = page.getByLabel("Time zone")
  await field.click()

  // The whole list opens on a plain click: the system option leads it, and zones from anywhere are on offer rather than only ones matching the box's contents.
  const listbox = page.locator(".tz-field__listbox")
  await expect(listbox).toBeVisible()
  await expect(
    listbox.getByRole("option", { name: "System time zone" })
  ).toBeVisible()
  await expect(listbox.getByRole("option", { name: "Asia/Tokyo" })).toHaveCount(1)
  await expect(listbox.getByRole("option", { name: "Europe/Berlin" })).toHaveCount(1)

  // Typing narrows it; choosing fills the box.
  await field.pressSequentially("tokyo")
  await expect(listbox.getByRole("option")).toHaveCount(1)
  await listbox.getByRole("option", { name: "Asia/Tokyo" }).click()
  await expect(field).toHaveValue("Asia/Tokyo")
  await expect(listbox).toHaveCount(0)

  // Clicking the filled box brings back the whole list, with the current zone marked.
  await field.click()
  await expect(
    listbox.getByRole("option", { name: "Europe/Berlin" })
  ).toHaveCount(1)
  await expect(listbox.getByRole("option", { name: "Asia/Tokyo" })).toHaveAttribute(
    "aria-selected",
    "true"
  )

  // Escape puts the list away without taking the dialog with it.
  await page.keyboard.press("Escape")
  await expect(listbox).toHaveCount(0)
  await expect(page.getByRole("dialog", { name: "Add clock" })).toBeVisible()

  await page.getByLabel("Name").fill("Tokyo")
  await page.getByRole("button", { name: "Save clock" }).click()
  expect(await readWidgetSettings(page, "Tokyo")).toEqual({
    timeZone: "Asia/Tokyo"
  })
})

test("multiple open tabs stay synchronized", async ({
  context,
  page,
  extensionId
}) => {
  // A tall viewport keeps the whole board (the default widgets plus the clock added below) and its context menus on screen, so clicking a menu item never has to scroll; scrolling intentionally dismisses an open widget menu.
  const tall = { width: 1280, height: 1600 }
  await page.setViewportSize(tall)
  await openNewTab(page, extensionId)

  const secondPage = await context.newPage()
  const thirdPage = await context.newPage()

  await secondPage.setViewportSize(tall)
  await thirdPage.setViewportSize(tall)
  await secondPage.goto(`chrome-extension://${extensionId}/newtab.html`)
  await thirdPage.goto(`chrome-extension://${extensionId}/newtab.html`)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add clock" }).click()
  await page.getByLabel("Name").fill("Paris")
  await page.getByLabel("Time zone").fill("Europe/Paris")
  await page.getByRole("button", { name: "Save clock" }).click()

  await expect(page.getByRole("heading", { name: "Paris" })).toBeVisible()
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
  await page
    .getByRole("heading", { name: /Good (morning|afternoon|evening|night)/ })
    .click()

  await page.reload()
  await expect(page.getByLabel("Reminders note")).toHaveValue("Buy milk")
})

test("typing in a note does not start a drag or open the widget menu", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await addWidget(page, "note", "Scratch")

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

  // Scope to the Mantras card; the default board ships its own quote widget too.
  const mantras = cardByTitle(page, "Mantras")
  const quote = mantras.locator(".quote-text")
  const shown = (await quote.textContent())?.trim() ?? ""
  expect(["Stay curious.", "Keep going."]).toContain(shown)

  // Daily rotation is deterministic, so the same quote returns after a reload.
  await page.reload()
  await expect(mantras.locator(".quote-text")).toHaveText(shown)
})

test("all widgets share one card size, even with a long quote", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  // A quote long enough to overflow the old content-driven sizing.
  const longQuote =
    "The best way to get started is to quit talking and begin doing, because " +
    "vision without execution is merely a daydream that never survives its " +
    "first contact with an ordinary Tuesday morning."

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add quote" }).click()
  await page.getByLabel("Name").fill("Long read")
  await page.getByLabel("Quotes").fill(longQuote)
  await page.getByRole("button", { name: "Save quote" }).click()
  await expect(page.getByRole("heading", { name: "Long read" })).toBeVisible()

  // The new card scales up as it enters, so it measures short until the entrance settles.
  await cardByTitle(page, "Long read").evaluate((card) =>
    Promise.all(card.getAnimations().map((animation) => animation.finished))
  )

  const cards = page.locator(".board-row")
  const count = await cards.count()
  const heights = new Set<number>()

  for (let index = 0; index < count; index += 1) {
    const box = await boxOf(cards.nth(index), "a card")
    heights.add(Math.round(box.height))
  }

  // Every card (clock, countdown, note, quote, habit) is the same height.
  expect(heights.size).toBe(1)
})

test("stopwatch counts up, keeps running across a reload, and resets", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await addWidget(page, "stopwatch", "Focus")

  const card = cardByTitle(page, "Focus")
  const value = card.locator(".board-row__value")

  await expect(value).toHaveText("0:00")
  await card.getByRole("button", { name: "Start" }).click()
  await expect.poll(async () => value.textContent()).not.toBe("0:00")

  // The running state is anchored to wall-clock time, so it keeps ticking after a reload.
  await page.reload()
  const reloaded = cardByTitle(page, "Focus")
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

  const card = cardByTitle(page, "Steep")

  await expect(card.locator(".board-row__value")).toHaveText("0:01")

  await card.getByRole("button", { name: "Start" }).click()
  await expect(card.getByText("Time’s up")).toBeVisible()
  await expect(card.locator(".board-row__value")).toHaveText("0:00")

  await card.getByRole("button", { name: "Reset" }).click()
  await expect(card.locator(".board-row__value")).toHaveText("0:01")
})

test("a timer's per-widget chime is opt-in, persists, and still finishes", async ({
  page,
  extensionId
}) => {
  // A tall viewport keeps the appended timer and its context menu on screen, so re-opening it after a reload never has to scroll (scrolling dismisses the widget menu).
  await page.setViewportSize({ width: 1280, height: 1600 })
  await openNewTab(page, extensionId)

  // The chime is set per timer in its dialog; there is no global toggle.
  await page.getByRole("button", { name: "Options" }).click()
  await expect(page.getByRole("switch", { name: "Timer chime" })).toHaveCount(0)
  await page.getByRole("button", { name: "Done" }).click()

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add timer" }).click()
  await page.getByLabel("Name").fill("Steep")
  await page.getByLabel("minutes").fill("0")
  await page.getByLabel("seconds").fill("1")
  // Opt this timer into the chime.
  await expect(
    page.getByRole("switch", { name: "Chime when it ends" })
  ).not.toBeChecked()
  await page.getByRole("switch", { name: "Chime when it ends" }).click()
  await page.getByRole("button", { name: "Save timer" }).click()

  const card = cardByTitle(page, "Steep")
  await card.getByRole("button", { name: "Start" }).click()
  await expect(card.getByText("Time’s up")).toBeVisible()

  // The per-timer choice persists across a reload.
  await page.reload()
  await openWidgetMenu(page, "Steep")
  await page.getByRole("menuitem", { name: "Edit Steep" }).click()
  await expect(
    page.getByRole("switch", { name: "Chime when it ends" })
  ).toBeChecked()
})

test("add habit flow marks today and persists", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await addWidget(page, "habit", "Read")

  const card = cardByTitle(page, "Read")

  await expect(card.getByRole("toolbar", { name: "This week" })).toBeVisible()
  await expect(card.locator(".habit-day")).toHaveCount(7)

  const today = card.locator(".habit-day--today")
  await expect(today).toHaveAttribute("aria-pressed", "false")
  await card.getByRole("button", { name: "Mark today" }).click()
  await expect(today).toHaveAttribute("aria-pressed", "true")
  await expect(card.getByRole("button", { name: "Done today ✓" })).toBeVisible()

  // The marked day persists across a reload.
  await page.reload()
  const reloaded = cardByTitle(page, "Read")
  await expect(reloaded.locator(".habit-day--today")).toHaveAttribute(
    "aria-pressed",
    "true"
  )
})

test("a habit dot fills in a day that was missed", async ({
  page,
  extensionId
}) => {
  // Wednesday, so the week has days behind today to go back and fill in.
  await page.clock.install({ time: new Date("2026-03-04T10:00:00Z") })
  await openNewTab(page, extensionId)

  await addWidget(page, "habit", "Read")

  const card = cardByTitle(page, "Read")

  await card.getByRole("button", { name: "Monday, March 2" }).click()
  await expect(
    card.getByRole("button", { name: "Monday, March 2" })
  ).toHaveAttribute("aria-pressed", "true")

  // Today stays untouched, and a day that hasn't arrived can't be marked.
  await expect(card.getByRole("button", { name: "Mark today" })).toBeVisible()
  await expect(
    card.getByRole("button", { name: "Thursday, March 5" })
  ).toBeDisabled()

  // Arrows walk the row and mark a day without waking the card's own keyboard drag, which listens for the same keys one level up.
  await card.getByRole("button", { name: "Wednesday, March 4" }).focus()
  await page.keyboard.press("ArrowLeft")
  const tuesday = card.getByRole("button", { name: "Tuesday, March 3" })
  await expect(tuesday).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(tuesday).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator(".board-row--dragging")).toHaveCount(0)

  expect(await readWidgetSettings(page, "Read")).toEqual({ history: ["2026-03-02", "2026-03-03"] })
})

test("a todo list fills up on the card, persists, and clears again", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await addWidget(page, "todo", "Today")

  // Exact, or this also picks up the default board's "Today's reminder" quote.
  const todoCard = () =>
    cardByTitle(page, "Today", true)
  const card = todoCard()

  // Tasks are written on the card itself, so Enter is the whole interaction.
  for (const task of ["Buy milk", "Call the vet", "Book a table", "Water plants"]) {
    await card.getByLabel("Add a task to Today").fill(task)
    await card.getByLabel("Add a task to Today").press("Enter")
  }

  // The card holds four, and the field goes rather than sitting there disabled.
  await expect(card.getByLabel("Add a task to Today")).toHaveCount(0)
  await card.getByRole("checkbox", { name: "Buy milk" }).check()

  // Every task is on screen: the last one ends inside the card that clips it.
  const fits = await card.evaluate((node) => {
    const tasks = [...node.querySelectorAll(".todo-task")]

    return (
      tasks.length === 4 &&
      tasks.at(-1)!.getBoundingClientRect().bottom <
        node.getBoundingClientRect().bottom
    )
  })
  expect(fits).toBe(true)

  // The list and what is checked both survive a reload.
  await page.reload()
  await expect(todoCard().getByRole("checkbox")).toHaveCount(4)
  await expect(
    todoCard().getByRole("checkbox", { name: "Buy milk" })
  ).toBeChecked()

  // Clearing a task leaves the rest alone and brings the field back with it.
  await todoCard().getByRole("button", { name: "Remove Buy milk" }).click()
  await expect(
    todoCard().getByRole("checkbox", { name: "Buy milk" })
  ).toHaveCount(0)
  await expect(todoCard().getByLabel("Add a task to Today")).toBeVisible()
})

test("a todo card keeps the keyboard's place as tasks come and go", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await addWidget(page, "todo", "Today")

  const card = cardByTitle(page, "Today", true)
  const field = () => card.getByLabel("Add a task to Today")

  for (const task of ["One", "Two", "Three", "Four"]) {
    await field().fill(task)
    await field().press("Enter")
  }

  // The fourth task takes the field away, so focus follows it onto the task rather than being dropped on the page body.
  await expect(card.getByRole("checkbox", { name: "Four" })).toBeFocused()

  // Removing a task hands focus to the row that takes its place.
  await card.getByRole("checkbox", { name: "One" }).focus()
  await page.keyboard.press("Tab")
  await expect(card.getByRole("button", { name: "Remove One" })).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(card.getByRole("button", { name: "Remove Two" })).toBeFocused()

  // Removing the last row falls back to the field, which is back by then.
  await card.getByRole("button", { name: "Remove Four" }).focus()
  await page.keyboard.press("Enter")
  await expect(field()).toBeFocused()
})

test("a habit marked after midnight credits the new day", async ({
  page,
  extensionId
}) => {
  // A new tab commonly sits open overnight, so the board has to roll over on its own: marking the habit must credit the day the user is actually in.
  await page.clock.install({ time: new Date("2026-03-02T23:59:00Z") })
  await openNewTab(page, extensionId)

  await addWidget(page, "habit", "Read")

  const card = cardByTitle(page, "Read")
  await expect(card.getByRole("button", { name: "Mark today" })).toBeVisible()

  // Jump the clock past local midnight the way a sleeping laptop would.
  await page.clock.fastForward("00:05:00")
  await expect(page.locator(".page-header__date")).toContainText("March 3")

  await card.getByRole("button", { name: "Mark today" }).click()
  await expect(card.getByRole("button", { name: "Done today ✓" })).toBeVisible()

  // The default board ships its own habit card, so read back the one added here.
  expect(await readWidgetSettings(page, "Read")).toEqual({ history: ["2026-03-03"] })
})

test("add and edit countdown works without a time-zone field", async ({
  page,
  extensionId
}) => {
  // A tall viewport keeps the appended widget and its context menu on screen, so editing it never has to scroll (scrolling dismisses an open widget menu).
  await page.setViewportSize({ width: 1280, height: 1600 })
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

test("a countdown's start is empty by default and setting one makes a bar", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add countdown" }).click()

  // The start is not prefilled: a new countdown shows the time remaining, and the progress bar is opt-in from this field.
  await expect(page.getByLabel("Starting from")).toHaveValue("")
  await page.getByLabel("Name").fill("Project")
  await page.getByLabel("When").fill("2099-12-31T00:00")
  await page.getByLabel("Starting from").fill("2020-01-01T00:00")
  await page.getByRole("button", { name: "Save countdown" }).click()

  const card = cardByTitle(page, "Project")

  await expect(
    card.getByRole("progressbar", { name: "Project progress" })
  ).toBeVisible()
  await expect(card.locator(".board-row__value")).toContainText("%")

  // The progress display persists across a reload.
  await page.reload()
  await expect(
    cardByTitle(page, "Project")
      .getByRole("progressbar")
  ).toBeVisible()
})

test("the clear button empties a countdown's start and goes back to the time remaining", async ({
  page,
  extensionId
}) => {
  // A tall viewport keeps the appended widget and its context menu on screen, so editing it never has to scroll (scrolling dismisses an open widget menu).
  await page.setViewportSize({ width: 1280, height: 1600 })
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add countdown" }).click()
  await page.getByLabel("Name").fill("Project")
  await page.getByLabel("When").fill("2099-12-31T00:00")
  // An empty start has no clear button to press; it appears once there is something to clear.
  await expect(
    page.getByRole("button", { name: "Clear starting from" })
  ).toHaveCount(0)
  await page.getByLabel("Starting from").fill("2020-01-01T00:00")
  await page.getByRole("button", { name: "Save countdown" }).click()

  const card = cardByTitle(page, "Project")
  await expect(card.getByRole("progressbar")).toBeVisible()

  await openWidgetMenu(page, "Project")
  await page.getByRole("menuitem", { name: "Edit Project" }).click()
  await page.getByRole("button", { name: "Clear starting from" }).click()
  await expect(page.getByLabel("Starting from")).toHaveValue("")
  await page.getByRole("button", { name: "Save changes" }).click()

  await expect(card.getByRole("progressbar")).toHaveCount(0)
  await expect(card.getByText("from now")).toBeVisible()
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

  const card = cardByTitle(page, "Standup")

  // It reads as upcoming (not "ago") and notes the cadence.
  await expect(card.getByText("from now")).toBeVisible()
  await expect(card.locator(".board-row__detail")).toContainText(
    "repeats weekly"
  )
})

test("an hourly countdown rolls forward within the hour", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add countdown" }).click()
  await page.getByLabel("Name").fill("Stand up and stretch")
  // Years of missed occurrences still resolve to the coming hour.
  await page.getByLabel("When").fill("2020-01-06T09:15")
  await page.getByLabel("Repeats").selectOption("hourly")
  await page.getByRole("button", { name: "Save countdown" }).click()

  const card = cardByTitle(page, "Stand up and stretch")

  // The next occurrence is always under an hour out, so it never reads as past.
  await expect(card.getByText("ago")).toHaveCount(0)
  await expect(card.locator(".board-row__detail")).toContainText(
    "repeats hourly"
  )
})

test("editing a recurring countdown's time keeps its other settings", async ({
  page,
  extensionId
}) => {
  // A tall viewport keeps the appended widget and its context menu on screen, so editing it never has to scroll (scrolling dismisses an open widget menu).
  await page.setViewportSize({ width: 1280, height: 1600 })
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add countdown" }).click()
  await page.getByLabel("Name").fill("Standup")
  await page.getByLabel("When").fill("2020-01-06T09:00")
  await page.getByLabel("Repeats").selectOption("weekly")
  await page.getByRole("button", { name: "Save countdown" }).click()

  const card = cardByTitle(page, "Standup")
  await expect(card.locator(".board-row__detail")).toContainText("repeats weekly")

  // Changing only the time must not wipe the repeat setting.
  await openWidgetMenu(page, "Standup")
  await page.getByRole("menuitem", { name: "Edit Standup" }).click()
  await page.getByLabel("When").fill("2020-01-07T08:30")
  await page.getByRole("button", { name: "Save changes" }).click()

  await expect(
    cardByTitle(page, "Standup")
      .locator(".board-row__detail")
  ).toContainText("repeats weekly")
})

test("clicking the backdrop saves the edit dialog", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await openWidgetMenu(page, "🕒 Local time")
  await page.getByRole("menuitem", { name: "Edit 🕒 Local time" }).click()
  await expect(page.getByRole("dialog", { name: "Edit clock" })).toBeVisible()

  await page.getByLabel("Name").fill("Local HQ")

  // Click the backdrop, well clear of the centered dialog.
  // This commits the edit and closes the dialog rather than doing nothing.
  await page.mouse.click(8, 8)

  await expect(page.getByRole("dialog", { name: "Edit clock" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Local HQ" })).toBeVisible()

  // The save persists across a reload.
  await page.reload()
  await expect(page.getByRole("heading", { name: "Local HQ" })).toBeVisible()
})

test("pressing Escape closes the edit dialog and discards changes", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await openWidgetMenu(page, "🕒 Local time")
  await page.getByRole("menuitem", { name: "Edit 🕒 Local time" }).click()
  await expect(page.getByRole("dialog", { name: "Edit clock" })).toBeVisible()
  // The dialog opens seeded with the widget's current title, so Escape has a real edit to discard.
  await expect(page.getByLabel("Name")).toHaveValue("🕒 Local time")

  await page.getByLabel("Name").fill("Should not stick")
  await page.keyboard.press("Escape")

  // The dialog closes and the edit is thrown away.
  await expect(page.getByRole("dialog", { name: "Edit clock" })).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Should not stick" })
  ).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "🕒 Local time" })).toBeVisible()
})

test("delete flow removes an existing widget", async ({ page, extensionId }) => {
  await openNewTab(page, extensionId)

  await openWidgetMenu(page, "🌅 Tomorrow morning")
  await page.getByRole("menuitem", { name: "Delete 🌅 Tomorrow morning" }).click()
  await expect(
    page.getByRole("dialog", { name: "Delete countdown?" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Delete widget" }).click()

  await expect(page.getByText("🌅 Tomorrow morning")).toHaveCount(0)
})

test("deleting the last widget hands the board over to the empty state", async ({
  page,
  extensionId
}) => {
  // A tall viewport keeps every card and its context menu on screen; scrolling dismisses an open widget menu.
  await page.setViewportSize({ width: 1280, height: 1600 })
  await openNewTab(page, extensionId)

  for (const title of DEFAULT_BOARD_TITLES) {
    await deleteWidget(page, title)
  }

  // The board goes from one card to none while the list stays mounted, which is the render that used to take the whole page down with it.
  await expect(page.locator(".board-row")).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "A fresh start" })
  ).toBeVisible()
  await expect(page.getByText("The + button up top has them all")).toBeVisible()
  // And the page is still around the empty state, rather than the blank body React leaves behind when a render throws.
  await expect(page.getByRole("button", { name: "Add widget" })).toBeVisible()
})

test("archiving from the menu hides a widget and it can be restored", async ({
  page,
  extensionId
}) => {
  // A roomy viewport keeps the active board and the expanded archive on one screen, so revealing and acting on an archived card never has to scroll (scrolling intentionally dismisses an open widget menu).
  await page.setViewportSize({ width: 1280, height: 1600 })
  await openNewTab(page, extensionId)

  // Archive from the keyboard-accessible context menu.
  await openWidgetMenu(page, "🌅 Tomorrow morning")
  await page
    .getByRole("menuitem", { name: "Archive 🌅 Tomorrow morning" })
    .click()

  // It leaves the board and the archived section stays collapsed by default.
  await expect(
    page.locator(".board-list").first().getByText("🌅 Tomorrow morning")
  ).toHaveCount(0)
  const toggle = page.getByRole("button", { name: "Show archived" })
  await expect(toggle).toBeVisible()

  // Reveal it, then restore it back to the board.
  await toggle.click()
  await expect(page.getByText("🌅 Tomorrow morning")).toBeVisible()
  await openWidgetMenu(page, "🌅 Tomorrow morning")
  await page
    .getByRole("menuitem", { name: "Restore 🌅 Tomorrow morning" })
    .click()

  await expect(
    page.locator(".board-list").first().getByText("🌅 Tomorrow morning")
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Show archived/ })
  ).toHaveCount(0)
})

test("a keyboard drag is released by reaching for the mouse", async ({
  page,
  extensionId
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openNewTab(page, extensionId)

  const card = cardByTitle(page, "🕒 Local time")

  await card.focus()
  await page.keyboard.press("Space")
  await expect(page.locator(".board-row--overlay")).toBeVisible()

  // Space and Escape are not the only ways out.
  // Pressing anywhere with the pointer puts the card down, instead of leaving it stranded over the board with a sensor holding every later drag hostage.
  await page.mouse.click(6, 6)
  await expect(page.locator(".board-row--overlay")).toHaveCount(0)

  // And dragging works straight afterwards, which it would not if the keyboard drag were still the active one.
  await dragWidget(page, "🌅 Tomorrow morning", "🕒 Local time")
  await expect(page.locator(".board-row h2").first()).toHaveText(
    "🌅 Tomorrow morning"
  )
})

test("dragging a widget onto the archive zone archives it", async ({
  page,
  extensionId
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openNewTab(page, extensionId)

  const card = cardByTitle(page, "🕒 Local time")
  const box = await boxOf(card, "the card being archived")

  // Grab the draggable frame (top edge) and drag down onto the floating archive zone pinned near the bottom of the viewport.
  const grabX = box.x + box.width / 2
  const grabY = box.y + 12
  await page.mouse.move(grabX, grabY)
  await page.mouse.down()
  await page.mouse.move(grabX, grabY + 24, { steps: 6 })

  const dropzone = page.locator(".archive-dropzone")
  await expect(dropzone).toBeVisible()
  const zoneBox = await boxOf(dropzone, "the archive drop zone")

  await page.mouse.move(
    zoneBox.x + zoneBox.width / 2,
    zoneBox.y + zoneBox.height / 2,
    { steps: 20 }
  )
  await expect(page.locator(".archive-dropzone--over")).toBeVisible()
  await page.mouse.up()

  await expect(
    page.locator(".board-list").first().getByText("🕒 Local time")
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Show archived" })).toBeVisible()
})

test("a card dragged toward the archive follows the cursor instead of snapping back", async ({
  page,
  extensionId
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openNewTab(page, extensionId)

  const card = cardByTitle(page, "🕒 Local time")
  const box = await boxOf(card, "the card")

  const grabX = box.x + box.width / 2
  await page.mouse.move(grabX, box.y + 12)
  await page.mouse.down()
  await page.mouse.move(grabX, box.y + 36, { steps: 6 })

  const dropzone = page.locator(".archive-dropzone")
  await expect(dropzone).toBeVisible()
  const zoneBox = await boxOf(dropzone, "the archive drop zone")

  const cursorY = zoneBox.y + zoneBox.height / 2
  await page.mouse.move(zoneBox.x + zoneBox.width / 2, cursorY, { steps: 20 })
  await expect(page.locator(".archive-dropzone--over")).toBeVisible()

  // The lifted card (the drag overlay) tracks the cursor all the way down to the archive zone rather than snapping back up to the card's original slot.
  const overlay = page.locator(".board-row--overlay")
  await expect(overlay).toBeVisible()
  const overlayBox = await boxOf(overlay, "the drag overlay")

  const overlayCenterY = overlayBox.y + overlayBox.height / 2
  expect(Math.abs(overlayCenterY - cursorY)).toBeLessThan(200)
  // And it has clearly left its origin near the top of the board.
  expect(overlayBox.y).toBeGreaterThan(box.y + 120)

  await page.mouse.up()
  await expect(
    page.locator(".board-list").first().getByText("🕒 Local time")
  ).toHaveCount(0)
})

test("dragging an archived widget onto a board card restores it into that slot", async ({
  page,
  extensionId
}) => {
  // A tall viewport keeps the active board plus the revealed archive on screen, so the archived card and its board target are both reachable without mid-drag scrolling.
  await page.setViewportSize({ width: 1280, height: 1600 })
  await openNewTab(page, extensionId)

  // Archive then reveal the archived section.
  await openWidgetMenu(page, "🌅 Tomorrow morning")
  await page.getByRole("menuitem", { name: "Archive 🌅 Tomorrow morning" }).click()
  await page.getByRole("button", { name: "Show archived" }).click()

  const box = await boxOf(cardByTitle(page, "🌅 Tomorrow morning"), "the archived card")

  // Aim for the first board card: dropping there must restore into slot one, not just back onto the board somewhere.
  const targetBox = await boxOf(cardByTitle(page, "🕒 Local time"), "the board card it is dropped onto")

  // Grab the archived card by its frame and nudge it to start the drag.
  await page.mouse.move(box.x + box.width / 2, box.y + 12)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + 36, { steps: 6 })

  // The board announces itself as the restore target while the card is up.
  await expect(page.locator(".board-list--restore-target")).toBeVisible()

  // Carry the card up over the first board card, whose slot the drop will take.
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 20 }
  )

  // The board makes room mid-drag: the card claims a slot in the board grid (leaving the archived list) while the lifted copy follows the cursor, the same gap preview a normal reorder shows.
  // The slot holds the space but is transparent, so this checks that it is there rather than that it shows.
  await expect(
    page
      .locator(".board-list")
      .first()
      .locator(".board-row--dragging")
      .filter({ hasText: "🌅 Tomorrow morning" })
  ).toHaveCount(1)

  await page.mouse.up()

  // It is back on the board in the exact slot it was dropped on, ahead of "🕒 Local time", and the archived section is gone.
  await expect(page.locator(".board-row h2").first()).toHaveText(
    "🌅 Tomorrow morning"
  )
  await expect(
    page.getByRole("button", { name: /Show archived/ })
  ).toHaveCount(0)
})

test("dragging an archived widget onto an empty board restores it", async ({
  page,
  extensionId
}) => {
  // A tall viewport keeps the empty board and the revealed archive on one screen, so the drag never has to scroll.
  await page.setViewportSize({ width: 1280, height: 1600 })
  await openNewTab(page, extensionId)

  // Delete every card but one, then archive that one.
  // The board empties the other way it can: the last active card leaves for the archive, and the archived list renders below where it used to be.
  const [last, ...others] = DEFAULT_BOARD_TITLES

  for (const title of others) {
    await deleteWidget(page, title)
  }

  const lastCard = cardByTitle(page, last!)
  await lastCard.focus()
  await lastCard.press("ContextMenu")
  await page.getByRole("menuitem", { name: `Archive ${last}` }).click()

  await expect(page.locator(".board-row")).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "A fresh start" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Show archived" }).click()

  const box = await boxOf(cardByTitle(page, last!), "the archived card")

  // Grab the archived card by its frame and nudge it to start the drag.
  await page.mouse.move(box.x + box.width / 2, box.y + 12)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + 36, { steps: 6 })

  // With no board card left to aim at, the empty state is the drop target itself, and it changes what it says to offer the landing.
  const emptyState = page.locator(".empty-state")
  await expect(emptyState).toHaveClass(/empty-state--restore/)
  await expect(
    emptyState.getByRole("heading", { name: "Drop it here to restore" })
  ).toBeVisible()

  const emptyBox = await boxOf(emptyState, "the empty board drop target")
  await page.mouse.move(
    emptyBox.x + emptyBox.width / 2,
    emptyBox.y + emptyBox.height / 2,
    { steps: 20 }
  )

  await page.mouse.up()

  // It is back on the board, and the archive is gone with it.
  await expect(
    page.locator(".board-list").first().getByRole("heading", { name: last! })
  ).toBeVisible()
  await expect(page.locator(".empty-state")).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: /Show archived/ })
  ).toHaveCount(0)
})

test("edit and delete controls still work after reordering", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await dragWidget(page, "🌅 Tomorrow morning", "🕒 Local time")

  const titles = page.locator(".board-row h2")
  const [clock, tomorrow, ...rest] = DEFAULT_BOARD_TITLES
  await expect(titles).toHaveText([tomorrow, clock, ...rest])

  await openWidgetMenu(page, "🌅 Tomorrow morning")
  await page.getByRole("menuitem", { name: "Edit 🌅 Tomorrow morning" }).click()
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
