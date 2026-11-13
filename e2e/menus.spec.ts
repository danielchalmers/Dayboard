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

test("a menu opened as focus brings its card into view stays open", async ({
  page,
  extensionId
}) => {
  await page.setViewportSize({ width: 1000, height: 400 })
  await openNewTab(page, extensionId)

  // Focus and open in one task, the way Shift+F10 straight after Tab or a screen reader can: the page has scrolled to the card, but the browser only reports that scroll on its next frame, after the menu is up.
  const scrolled = await page.evaluate(() => {
    const cards = document.querySelectorAll<HTMLElement>("article.board-row")
    const card = cards[cards.length - 1]!
    card.focus()
    const { left, top } = card.getBoundingClientRect()
    card.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        button: 2,
        cancelable: true,
        clientX: left + 20,
        clientY: top + 20
      })
    )
    return window.scrollY
  })
  // Without the scroll, the late report this guards against never comes.
  expect(scrolled).toBeGreaterThan(0)

  // Let the browser deliver that scroll before looking.
  await page.evaluate(
    () =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  )
  await expect(page.locator(".card-menu")).toBeVisible()
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

  // "🌅 Morning" sits among other widgets, so every item is enabled and the cycle covers the whole menu.
  const card = cardByTitle(page, "🌅 Morning")

  await card.focus()
  await card.press("ContextMenu")

  const menu = page.locator(".card-menu")
  await expect(menu).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: "Move 🌅 Morning back" })
  ).toBeFocused()

  // The menu renders in the top layer, so the board behind it is still in the page's tab order; trapping Tab is what keeps a stray keypress from stranding focus out there with the menu still up.
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("menuitem", { name: "Move 🌅 Morning next" })
  ).toBeFocused()

  await page.keyboard.press("Shift+Tab")
  await expect(
    page.getByRole("menuitem", { name: "Move 🌅 Morning back" })
  ).toBeFocused()

  // Shift+Tab from the first item wraps to the last rather than leaving.
  await page.keyboard.press("Shift+Tab")
  await expect(
    page.getByRole("menuitem", { name: "Delete 🌅 Morning" })
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
  const neighbour = cardByTitle(page, "🌅 Morning")
  await neighbour.focus()
  // Guard against a stray scroll or the focus change itself having dismissed the menu before the drag even starts.
  await expect(menu).toHaveCount(1)

  await page.keyboard.press("Space")
  await expect(page.locator(".board-row--overlay")).toBeVisible()
  await expect(menu).toHaveCount(0)

  await page.keyboard.press("Escape")
  await expect(page.locator(".board-row--overlay")).toHaveCount(0)
})

// Edit, Archive and Delete are otherwise behind a right-click that nothing on the card mentions.
test("the kind badge opens the widget menu under itself and closes it again", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const card = cardByTitle(page, "🕒 Local time")
  const badge = card.getByRole("button", { name: "Actions for 🕒 Local time" })
  const menu = page.locator(".card-menu")

  await badge.click()
  await expect(menu).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: "Edit 🕒 Local time" })
  ).toBeVisible()
  await expect(badge).toHaveAttribute("aria-expanded", "true")
  // Pressing the badge is a click on a button, not a grab of the card.
  await expect(page.locator(".archive-dropzone")).toHaveCount(0)

  await menu
    .locator(".card-menu__panel")
    .evaluate((panel) =>
      Promise.all(panel.getAnimations().map((animation) => animation.finished))
    )
  const badgeBox = await boxOf(badge, "the badge")
  const menuBox = await boxOf(
    menu.locator(".card-menu__panel"),
    "the widget menu"
  )

  // The menu hangs from the badge's corner, over its own card, rather than from wherever the pointer was.
  expect(
    Math.abs(menuBox.x + menuBox.width - (badgeBox.x + badgeBox.width))
  ).toBeLessThan(2)
  expect(menuBox.y).toBeGreaterThan(badgeBox.y + badgeBox.height)
  expect(menuBox.y).toBeLessThan(badgeBox.y + badgeBox.height + 16)

  // A second press puts it away, the way a menu button does, rather than closing and reopening it.
  await badge.click()
  await expect(menu).toHaveCount(0)
  await expect(badge).toHaveAttribute("aria-expanded", "false")
})

test("the kind badge opens the menu from the keyboard and Escape hands focus back to it", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const badge = cardByTitle(page, "🕒 Local time").getByRole("button", {
    name: "Actions for 🕒 Local time"
  })

  await badge.focus()
  await page.keyboard.press("Enter")
  await expect(
    page.getByRole("menuitem", { name: "Move 🕒 Local time next" })
  ).toBeFocused()

  await page.keyboard.press("Escape")
  await expect(page.locator(".card-menu")).toHaveCount(0)
  await expect(badge).toBeFocused()
  // Enter on the badge is a press of a button: it must not lift the card.
  await expect(page.locator(".archive-dropzone")).toHaveCount(0)
})

test("right-clicking a second card swaps to that card's menu", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  // Bottom corners: card background on both, clear of the text and controls.
  const first = await boxOf(cardByTitle(page, "🕒 Local time"), "the first card")
  const second = await boxOf(cardByTitle(page, "🌅 Morning"), "the second card")

  await page.mouse.click(first.x + 14, first.y + first.height - 14, {
    button: "right"
  })
  await expect(
    page.getByRole("menu", { name: "Actions for 🕒 Local time" })
  ).toBeVisible()

  // The correction anyone makes after right-clicking the wrong card.
  await page.mouse.click(second.x + 14, second.y + second.height - 14, {
    button: "right"
  })
  await expect(
    page.getByRole("menu", { name: "Actions for 🌅 Morning" })
  ).toBeVisible()
  await expect(
    page.getByRole("menu", { name: "Actions for 🕒 Local time" })
  ).toHaveCount(0)

  // The same correction, landing before the open menu has reported that it closed.
  // A real right-click can arrive in that window, since the press that dismisses one menu is the press that asks for the next, but a scripted pointer never does, so the order is set by hand: dismiss the menu, then right-click the first card before the "closed" event is delivered.
  // The menu used to be reused from one card to the next. It only shows itself when it mounts, so it stayed hidden, and then took the late event as its own dismissal: nothing opened at all.
  await page.evaluate(
    ({ x, y }) => {
      document.querySelector<HTMLElement>(":popover-open")?.hidePopover()
      document.elementFromPoint(x, y)?.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          button: 2,
          cancelable: true,
          clientX: x,
          clientY: y
        })
      )
    },
    { x: first.x + 14, y: first.y + first.height - 14 }
  )
  await expect(
    page.getByRole("menu", { name: "Actions for 🕒 Local time" })
  ).toBeVisible()
  await expect(
    page.getByRole("menu", { name: "Actions for 🌅 Morning" })
  ).toHaveCount(0)
})

test("a double-click on a card's background leaves its menu a right-click away", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const box = await boxOf(cardByTitle(page, "🕒 Local time"), "the card")
  const x = box.x + box.width - 14
  const y = box.y + box.height - 14

  // Double-clicking is the first thing many people try on a card.
  // On blank background Chrome selects a lone line break there, never highlighted, and the next right-click must not mistake it for text to copy.
  await page.mouse.dblclick(x, y)
  await page.mouse.click(x, y, { button: "right" })
  await expect(
    page.getByRole("menu", { name: "Actions for 🕒 Local time" })
  ).toBeVisible()
})

test("the add menu takes the same arrow keys as a card's menu", async ({
  page,
  extensionId
}) => {
  await openNewTab(page, extensionId)

  const trigger = page.getByRole("button", { name: "Add widget" })
  const panel = page.locator(".add-menu__panel")
  const item = (kind: string) => page.getByRole("button", { name: `Add ${kind}` })

  // Down on the + button opens the menu onto its first kind, the way a menu button does.
  await trigger.focus()
  await page.keyboard.press("ArrowDown")
  await expect(panel).toBeVisible()
  await expect(item("clock")).toBeFocused()

  await page.keyboard.press("ArrowDown")
  await expect(item("countdown")).toBeFocused()
  await page.keyboard.press("ArrowUp")
  await expect(item("clock")).toBeFocused()

  // The ends wrap, and Home and End reach them in one press.
  await page.keyboard.press("ArrowUp")
  await expect(item("quote")).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await expect(item("clock")).toBeFocused()
  await page.keyboard.press("End")
  await expect(item("quote")).toBeFocused()
  await page.keyboard.press("Home")
  await expect(item("clock")).toBeFocused()

  // The keys move focus and nothing else: the page under the menu stays where it was.
  expect(await page.evaluate(() => window.scrollY)).toBe(0)

  await page.keyboard.press("Escape")
  await expect(panel).toBeHidden()
  await expect(trigger).toBeFocused()

  // Up opens it from the other end.
  await page.keyboard.press("ArrowUp")
  await expect(item("quote")).toBeFocused()

  // And the kind under focus is still chosen with Enter.
  await page.keyboard.press("ArrowUp")
  await expect(item("habit")).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("dialog", { name: "Add habit" })).toBeVisible()
})
