import { expect, test } from "./fixtures"
import { boxOf, cardByTitle, openNewTab, openWidgetMenu } from "./helpers"

test("the widget menu closes on scroll and returns focus to its card", async ({
  page,
  extensionId
}) => {
  // A short viewport makes the default board overflow, the case every other menu test deliberately avoids by going tall.
  await page.setViewportSize({ width: 1000, height: 400 })
  await openNewTab(page, extensionId)

  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollHeight >
      document.documentElement.clientHeight
  )
  // Without a scrollbar there is nothing to scroll, and the assertions below would pass for the wrong reason.
  expect(overflows).toBe(true)

  const card = cardByTitle(page, "📅 This year")
  await card.focus()
  await card.press("ContextMenu")

  const menu = page.locator(".card-menu")
  // Focus reaches the first item without scrolling the page: a menu opened this low would otherwise trip the close-on-scroll handler and vanish on the spot.
  await expect(menu).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: "Move 📅 This year back" })
  ).toBeFocused()

  // The menu is fixed to the viewport, so any scroll drifts it off the card it belongs to and it closes...
  const moved = await page.evaluate(() => {
    const before = window.scrollY
    window.scrollBy(0, -120)
    return window.scrollY !== before
  })
  expect(moved).toBe(true)
  await expect(menu).toHaveCount(0)
  // ...and focus lands back on the card rather than being dropped to the body.
  await expect(card).toBeFocused()
})

test("the menu can't move a card past the ends of the board", async ({
  page,
  extensionId
}) => {
  // A tall viewport keeps the last card and its menu clear of the fold, since scrolling closes the menu.
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openNewTab(page, extensionId)

  const menu = page.locator(".card-menu")

  // The first card has nowhere to move back to, so that item is inert and the opening focus skips past it.
  const first = cardByTitle(page, "🕒 Local time")
  await first.focus()
  await first.press("ContextMenu")
  await expect(menu).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: "Move 🕒 Local time back" })
  ).toBeDisabled()
  await expect(
    page.getByRole("menuitem", { name: "Move 🕒 Local time next" })
  ).toBeFocused()

  await page.keyboard.press("Escape")
  await expect(menu).toHaveCount(0)

  // The last card is the mirror image: Move next is inert and Move back takes the focus.
  const last = cardByTitle(page, "📅 This year")
  await last.focus()
  await last.press("ContextMenu")
  await expect(menu).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: "Move 📅 This year next" })
  ).toBeDisabled()
  await expect(
    page.getByRole("menuitem", { name: "Move 📅 This year back" })
  ).toBeFocused()
})

test("the widget menu traps Tab inside itself", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  // "🌅 Tomorrow morning" sits among other widgets, so every item is enabled and the cycle covers the whole menu.
  const card = cardByTitle(page, "🌅 Tomorrow morning")

  await card.focus()
  await card.press("ContextMenu")

  const menu = page.locator(".card-menu")
  await expect(menu).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: "Move 🌅 Tomorrow morning back" })
  ).toBeFocused()

  // The menu renders in the top layer, so the board behind it is still in the page's tab order; trapping Tab is what keeps a stray keypress from stranding focus out there with the menu still up.
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("menuitem", { name: "Move 🌅 Tomorrow morning next" })
  ).toBeFocused()

  await page.keyboard.press("Shift+Tab")
  await expect(
    page.getByRole("menuitem", { name: "Move 🌅 Tomorrow morning back" })
  ).toBeFocused()

  // Shift+Tab from the first item wraps to the last rather than leaving.
  await page.keyboard.press("Shift+Tab")
  await expect(
    page.getByRole("menuitem", { name: "Delete 🌅 Tomorrow morning" })
  ).toBeFocused()

  // Moving the focus around is all that happened; the menu is still open.
  await expect(menu).toBeVisible()
})

test("clicking between menu items leaves the widget menu open", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  await openWidgetMenu(page, "🕒 Local time")

  const menu = page.locator(".card-menu")
  const archive = page.getByRole("menuitem", { name: "Archive 🕒 Local time" })
  const remove = page.getByRole("menuitem", { name: "Delete 🕒 Local time" })
  await expect(remove).toBeVisible()

  // Let the scale-up animation finish so the gap between the items is measured at full size.
  await menu
    .locator(".card-menu__panel")
    .evaluate((panel) =>
      Promise.all(panel.getAnimations().map((animation) => animation.finished))
    )

  const archiveBox = await boxOf(archive, "the Archive item")
  const deleteBox = await boxOf(remove, "the Delete item")

  // The separator strip between Archive and Delete: the near miss a native menu shrugs off, rather than dropping the user back to the board.
  await page.mouse.click(
    archiveBox.x + archiveBox.width / 2,
    (archiveBox.y + archiveBox.height + deleteBox.y) / 2
  )

  await expect(menu).toBeVisible()
  await expect(remove).toBeVisible()

  // Choosing a real item still dismisses it.
  await page.getByRole("menuitem", { name: "Edit 🕒 Local time" }).click()
  await expect(menu).toHaveCount(0)
})

test("starting a keyboard drag puts away an open widget menu", async ({
  page,
  extensionId
}) => {
  // A tall viewport keeps the cards and the menu on screen: focusing a card must not scroll, since a scroll closes the menu on its own and would pass this test for the wrong reason.
  await page.setViewportSize({ width: 1280, height: 1000 })
  await openNewTab(page, extensionId)

  await openWidgetMenu(page, "🕒 Local time")
  await expect(
    page.getByRole("menuitem", { name: "Move 🕒 Local time next" })
  ).toBeVisible()

  const menu = page.locator(".card-menu")

  // The card whose menu is open ignores drag keys, so the drag has to start from a neighbour, which is also the only way a user could reach one: light dismiss covers pointer drags, and this is the keyboard path it never sees.
  const neighbour = cardByTitle(page, "🌅 Tomorrow morning")
  await neighbour.focus()
  // Guard against a stray scroll or the focus change itself having dismissed the menu before the drag even starts.
  await expect(menu).toHaveCount(1)

  await page.keyboard.press("Space")
  await expect(page.locator(".board-row--overlay")).toBeVisible()
  await expect(menu).toHaveCount(0)

  await page.keyboard.press("Escape")
  await expect(page.locator(".board-row--overlay")).toHaveCount(0)
})
