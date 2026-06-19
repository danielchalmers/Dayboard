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
  await expect(page.getByRole("heading", { name: "Clockboard" })).toBeVisible()
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
  await page.getByRole("heading", { name: "Clockboard" }).click()
  await expect(page.getByRole("button", { name: "Add clock" })).not.toBeVisible()

  await openWidgetMenu(page, "Tomorrow morning")
  await expect(
    page.getByRole("menuitem", { name: "Move Tomorrow morning up" })
  ).toBeVisible()
  await page.getByRole("heading", { name: "Clockboard" }).click()
  await expect(
    page.getByRole("menuitem", { name: "Move Tomorrow morning up" })
  ).not.toBeVisible()
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
