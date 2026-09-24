import { expect, test } from "./fixtures"
import { cardByTitle, openNewTab, openWidgetMenu } from "./helpers"

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

  // The three dialogs treat the backdrop differently on purpose, and this is the one where dismissing has to mean "no".
  // The edit dialog commits from its backdrop; a destructive dialog that did the same would delete a widget the user only clicked away from.
  await openWidgetMenu(page, "🌅 Tomorrow morning")
  await page.getByRole("menuitem", { name: "Delete 🌅 Tomorrow morning" }).click()
  await expect(dialog).toBeVisible()

  await page.mouse.click(8, 8)
  await expect(dialog).toHaveCount(0)
  await expect(cardByTitle(page, "🌅 Tomorrow morning")).toBeVisible()
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

  await toggle.click()
  await expect(page.getByText("🌅 Tomorrow morning")).toBeVisible()
  await expect(toggle).toHaveAccessibleName("Hide archived")
  await expect(toggle).toHaveAttribute("aria-expanded", "true")

  // The toggle is a two-way disclosure: clicking again puts the archive back out of sight, which is what keeps the active board the focus.
  await toggle.click()
  await expect(page.getByText("🌅 Tomorrow morning")).toHaveCount(0)
  await expect(toggle).toHaveAccessibleName("Show archived")
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
})
