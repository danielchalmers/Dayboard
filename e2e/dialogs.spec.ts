import { expect, test } from "./fixtures"
import {
  cardByTitle,
  DEFAULT_BOARD_TITLES,
  openNewTab,
  openWidgetMenu
} from "./helpers"

test("canceling the delete dialog keeps the widget", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const dialog = page.getByRole("dialog", { name: "Delete countdown?" })

  await openWidgetMenu(page, "🌅 Tomorrow morning")
  await page.getByRole("menuitem", { name: "Delete 🌅 Tomorrow morning" }).click()
  await expect(dialog).toBeVisible()

  await page.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toHaveCount(0)
  await expect(cardByTitle(page, "🌅 Tomorrow morning")).toBeVisible()
  // A pointer user has no place on the board to keep, so the card is not handed a focus that the next Space would turn into a drag.
  await expect(cardByTitle(page, "🌅 Tomorrow morning")).not.toBeFocused()

  // The three dialogs treat the backdrop differently on purpose, and this is the one where dismissing has to mean "no".
  // The edit dialog commits a change from its backdrop; a destructive dialog that did the same would delete a widget the user only clicked away from.
  await openWidgetMenu(page, "🌅 Tomorrow morning")
  await page.getByRole("menuitem", { name: "Delete 🌅 Tomorrow morning" }).click()
  await expect(dialog).toBeVisible()

  await page.mouse.click(8, 8)
  await expect(dialog).toHaveCount(0)
  await expect(cardByTitle(page, "🌅 Tomorrow morning")).toBeVisible()
})

test("canceling the delete dialog from the keyboard goes back to the card", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const card = cardByTitle(page, "🌅 Tomorrow morning")
  await card.focus()
  await card.press("ContextMenu")
  await page.getByRole("menuitem", { name: "Delete 🌅 Tomorrow morning" }).press("Enter")
  await expect(page.getByRole("dialog", { name: "Delete countdown?" })).toBeVisible()

  // The menu that opened the dialog is gone, so focus goes back to the card it was about rather than falling to the page.
  await page.keyboard.press("Escape")
  await expect(card).toBeFocused()
})

test("canceling an add discards it and the options backdrop closes", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add clock" }).click()
  await expect(page.getByRole("dialog", { name: "Add clock" })).toBeVisible()

  await page.getByLabel("Name").fill("Nope")
  // Cancel sits inside the form, so it only discards while it stays a `type="button"`.
  // A card named "Nope" on the board is exactly what a slip back to the default submit type would look like.
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect(page.getByRole("dialog", { name: "Add clock" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Nope" })).toHaveCount(0)

  // Options has nothing pending to commit or throw away, so its backdrop is plain dismissal.
  await page.getByRole("button", { name: "Options" }).click()
  await expect(page.getByRole("dialog", { name: "Options" })).toBeVisible()

  await page.mouse.click(8, 8)
  await expect(page.getByRole("dialog", { name: "Options" })).toHaveCount(0)
})

test("clicking away from an add only keeps it once something was changed", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const cards = page.locator(".board-row")
  const before = DEFAULT_BOARD_TITLES.length
  await expect(cards).toHaveCount(before)

  // A look at what a kind offers, then a click back onto the board, is not asking for a card.
  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add clock" }).click()
  await expect(page.getByRole("dialog", { name: "Add clock" })).toBeVisible()

  await page.mouse.click(8, 8)
  await expect(page.getByRole("dialog", { name: "Add clock" })).toHaveCount(0)
  await expect(cards).toHaveCount(before)

  // Once anything is picked, even only a color, clicking away commits it like the edit dialog does.
  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add habit" }).click()
  await page.getByRole("radio", { name: "Rose" }).click()

  await page.mouse.click(8, 8)
  await expect(page.getByRole("dialog", { name: "Add habit" })).toHaveCount(0)
  await expect(cards).toHaveCount(before + 1)
})

test("typing replaces a new card's name", async ({ page, extensionId }) => {
  await openNewTab(page, extensionId)

  // The helpers fill fields wholesale, which is exactly what hides a default that typing appends to ("New clockTokyo").
  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add clock" }).click()
  await page.keyboard.type("Tokyo")
  await page.keyboard.press("Enter")
  await expect(cardByTitle(page, "Tokyo", true)).toBeVisible()
})

test("typing replaces a timer's length part", async ({ page, extensionId }) => {
  await openNewTab(page, extensionId)

  // Five minutes and a typed 25 must read 25 minutes, not 525 normalized to eight hours and change.
  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add timer" }).click()
  await page.getByLabel("minutes").click()
  await page.keyboard.type("25")
  await expect(page.getByLabel("minutes")).toHaveValue("25")
  await expect(page.getByLabel("hours")).toHaveValue("0")

  await page.keyboard.press("Tab")
  await page.keyboard.type("30")
  await expect(page.getByLabel("seconds")).toHaveValue("30")
})

test("an outside click the form refuses keeps focus on the field and Escape working", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add note" }).click()
  const dialog = page.getByRole("dialog", { name: "Add note" })
  await page.getByLabel("Name").fill("")

  // The form refuses the save and focuses the empty Name to say why; the press on the backdrop must not then carry focus out to the page.
  // A save that storage refuses is held the same way (see board-state.spec.ts).
  await page.mouse.click(8, 8)
  await expect(dialog).toBeVisible()
  await expect(page.getByLabel("Name")).toBeFocused()

  // Escape listens inside the dialog, so it only still works because focus stayed there.
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
})

test("closing a dialog hands focus back to the card or button that opened it", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const card = cardByTitle(page, "🌅 Tomorrow morning")
  const dialog = page.getByRole("dialog", { name: "Edit countdown" })

  // The menu item that opened the dialog is gone by the time it closes, so without this focus fell to the page and a keyboard user started over from the top.
  await card.focus()
  await card.press("ContextMenu")
  await page.getByRole("menuitem", { name: "Edit 🌅 Tomorrow morning" }).press("Enter")
  await expect(dialog).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(card).toBeFocused()

  // A save closes the dialog only once its write has landed, and focus still finds the card after the wait.
  await card.press("ContextMenu")
  await page.getByRole("menuitem", { name: "Edit 🌅 Tomorrow morning" }).press("Enter")
  await dialog.getByRole("button", { name: "Save changes" }).press("Enter")
  await expect(dialog).toHaveCount(0)
  await expect(card).toBeFocused()

  const addWidgetButton = page.getByRole("button", { name: "Add widget" })
  await addWidgetButton.press("Enter")
  await page.getByRole("button", { name: "Add clock" }).press("Enter")
  await expect(page.getByRole("dialog", { name: "Add clock" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(addWidgetButton).toBeFocused()
})

test("a menu opened by a long press hands focus back to its own card", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const card = cardByTitle(page, "🌅 Tomorrow morning")
  await cardByTitle(page, "👋 Welcome").locator("textarea").focus()

  // A touch long-press opens the menu without the press focusing anything, which a bare contextmenu event reproduces.
  // The note's field was focused before it, and it is where an item chosen with a screen reader or a keyboard would otherwise hand focus back to: off screen on a phone, with the keyboard up.
  await card.dispatchEvent("contextmenu")
  await page.getByRole("menuitem", { name: "Edit 🌅 Tomorrow morning" }).press("Enter")
  await expect(page.getByRole("dialog", { name: "Edit countdown" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(card).toBeFocused()
})

test("picking a color repaints the card and it survives a reload", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await page.getByRole("button", { name: "Add widget" }).click()
  await page.getByRole("button", { name: "Add note" }).click()
  await page.getByLabel("Name").fill("Scratch")

  // Per-item color is limited to the curated presets, so this picker is the only way a user sets one.
  await expect(
    page.getByRole("radiogroup", { name: "Widget color" })
  ).toBeVisible()
  const rose = page.getByRole("radio", { name: "Rose" })
  await rose.click()
  await expect(rose).toHaveAttribute("aria-checked", "true")

  await page.getByRole("button", { name: "Save note" }).click()

  await expect(cardByTitle(page, "Scratch")).toHaveAttribute(
    "data-color-preset",
    "rose"
  )

  // The choice belongs to the widget rather than to the open dialog, so it comes back with the board.
  await page.reload()
  await expect(cardByTitle(page, "Scratch")).toHaveAttribute(
    "data-color-preset",
    "rose"
  )
})

test("the archived toggle flips its label and tucks the list away again", async ({
  page,
  extensionId
}) => {
  // A roomy viewport keeps the board and the expanded archive on one screen, so nothing here has to scroll (scrolling intentionally dismisses an open widget menu).
  await page.setViewportSize({ width: 1280, height: 1600 })
  await openNewTab(page, extensionId)

  await openWidgetMenu(page, "🌅 Tomorrow morning")
  await page
    .getByRole("menuitem", { name: "Archive 🌅 Tomorrow morning" })
    .click()

  // One locator for both states, since the label is the thing under test and an exact name would stop matching the moment it flips.
  const toggle = page.getByRole("button", { name: /archived/ })
  // No count in the label: a tally beside "Show archived" is a little pull on the eye every time the tab opens.
  await expect(toggle).toHaveAccessibleName("Show archived")
  await expect(toggle).toHaveAttribute("aria-expanded", "false")

  // The card, not the line naming it in the archive notice.
  const archived = cardByTitle(page, "🌅 Tomorrow morning")

  await toggle.click()
  await expect(archived).toBeVisible()
  await expect(toggle).toHaveAccessibleName("Hide archived")
  await expect(toggle).toHaveAttribute("aria-expanded", "true")

  // The toggle is a two-way disclosure: clicking again puts the archive back out of sight, which is what keeps the active board the focus.
  await toggle.click()
  await expect(archived).toHaveCount(0)
  await expect(toggle).toHaveAccessibleName("Show archived")
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
})
